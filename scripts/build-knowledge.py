"""Build a portable teaching corpus. Never reads the student-assessment folders."""
import argparse
import hashlib
import json
import logging
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from pypdf import PdfReader

SCOPES = ('01 Curriculum and Planning', '02 Weekly Lesson Materials', '03 Teaching Resource Library')
CHUNK_CHARS = 8000


def office_text(file):
    with zipfile.ZipFile(file) as archive:
        if file.suffix.lower() == '.docx':
            names = ['word/document.xml']
        elif file.suffix.lower() == '.pptx':
            names = sorted((n for n in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)),
                           key=lambda n: int(re.search(r'(\d+)\.xml', n).group(1)))
        else:
            names = [n for n in archive.namelist() if n == 'xl/sharedStrings.xml' or n.startswith('xl/worksheets/sheet')]
        lines = []
        for name in names:
            root = ET.fromstring(archive.read(name))
            for element in root.iter():
                if element.tag.rsplit('}', 1)[-1] in ('t', 'v') and element.text:
                    lines.append(element.text)
        return '\n'.join(lines)


def chunks(text):
    # Keep page labels and paragraphs together where possible; bound model context size.
    current = ''
    for line in text.splitlines():
        while len(line) > CHUNK_CHARS:
            if current:
                yield current
                current = ''
            yield line[:CHUNK_CHARS]
            line = line[CHUNK_CHARS:]
        if len(current) + len(line) + 1 > CHUNK_CHARS:
            yield current
            current = ''
        current += line + '\n'
    if current.strip():
        yield current


def markdown(title, source, document_type, body, **extra):
    fields = {'title': title, 'source_file': source, 'documentType': document_type, **extra}
    metadata = '\n'.join(f'{key}: {json.dumps(value, ensure_ascii=False)}' for key, value in fields.items())
    return f'---\n{metadata}\n---\n# {title}\n\n{body}\n'


def build(source, output, section_file):
    source = source.resolve(strict=True)
    output = output.resolve()
    if output == source or output in source.parents:
        raise ValueError('Output must not replace the original collection')
    # Original folders are an explicit allowlist; student submissions are never indexed.
    files = sorted(p for scope in SCOPES for p in (source / scope).rglob('*') if p.is_file())
    sections = json.loads(section_file.read_text(encoding='utf-8'))
    expected = {s['worksheetId']: s for s in sections if s.get('catalogueMode') == 'live'}
    documents, assets, matched, issues = [], {}, set(), []
    total_text_files = 0
    pdf_pages_without_text = 0
    (output / '_manifests').mkdir(parents=True, exist_ok=True)

    def emit(relative_path, content):
        target = output / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')
        documents.append({'path': relative_path})

    for number, file in enumerate(files, 1):
        if file.is_symlink() or not file.resolve().is_relative_to(source):
            raise ValueError('Source file escapes the teaching collection')
        relative = file.relative_to(source).as_posix()
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        resource_id = 'azure-' + digest[:16]  # Preserve the existing stable approved IDs.
        try:
            if file.suffix.lower() == '.pdf':
                reader = PdfReader(file)
                pages = [page.extract_text() or '' for page in reader.pages]
                pdf_pages_without_text += sum(not p.strip() for p in pages)
                text = '\n\n'.join(f'## Page {i + 1}\n{p}' for i, p in enumerate(pages))
                if resource_id in expected:
                    section = expected[resource_id]
                    if section['pageEnd'] > len(pages):
                        raise ValueError('Approved range exceeds the PDF page count')
                    pdf_path = f'_raw/{digest}.pdf'
                    target = output / pdf_path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(file, target)
                    assets[digest] = {'path': pdf_path, 'sha256': digest, 'displayName': file.name,
                                      'sourceFile': relative, 'pageCount': len(pages)}
                    focused = '\n\n'.join(f'## Page {i + 1}\n{pages[i]}'
                                          for i in range(section['pageStart'] - 1, section['pageEnd']))
                    if not any(pages[i].strip() for i in range(section['pageStart'] - 1, section['pageEnd'])):
                        issues.append({'source': relative, 'reason': 'Approved pages need OCR; searchable title and curated skill retained'})
                    focused = f"{section['skill']}\n{section['description']}\n" + focused
                    emit(f'wiki/resources/approved-{digest[:16]}.md',
                         markdown(section['title'], relative, 'resource', focused,
                                  resource_id=resource_id, level=section['difficulty'],
                                  addresses_error_types=section['targetCategories']))
                    matched.add(resource_id)
            elif file.suffix.lower() in ('.docx', '.pptx', '.xlsx'):
                text = office_text(file)
            else:
                issues.append({'source': relative, 'reason': 'Unsupported source format'})
                continue
            if not re.sub(r'## Page \d+', '', text).strip():
                issues.append({'source': relative, 'reason': 'No extractable text; needs OCR or manual transcription'})
                continue
            total_text_files += 1
            document_type = 'resource' if relative.startswith(SCOPES[2]) else 'teacher_knowledge'
            role_folder = 'resources' if document_type == 'resource' else 'teacher-knowledge'
            path_id = hashlib.sha256(relative.encode()).hexdigest()[:12]
            for index, chunk in enumerate(chunks(text), 1):
                emit(f'wiki/{role_folder}/{path_id}-{digest[:12]}-{index:03d}.md',
                     markdown(file.stem, relative, document_type, chunk))
        except Exception as error:
            # Source paths are teaching metadata; never include document text in diagnostics.
            issues.append({'source': relative, 'reason': type(error).__name__})
        if number % 50 == 0:
            print(json.dumps({'processedTeachingFiles': number, 'total': len(files)}), flush=True)

    missing = set(expected) - matched
    if missing:
        raise ValueError(f'{len(missing)} approved PDFs were not found; no complete corpus was published')
    (output / '_manifests/gemini-canonical-markdown.jsonl').write_text(
        ''.join(json.dumps(item) + '\n' for item in documents), encoding='utf-8')
    (output / '_manifests/blob-upload-manifest.json').write_text(
        json.dumps({'files': list(assets.values())}, indent=2), encoding='utf-8')
    # Portable approved ranges travel with the corpus to its Google Cloud bucket.
    (output / '_manifests/worksheet-sections.json').write_text(json.dumps(sections, indent=2), encoding='utf-8')
    report = {'sourceFiles': len(files), 'filesWithText': total_text_files,
              'markdownChunks': len(documents), 'approvedPdfs': len(assets), 'approvedSections': len(matched),
              'pdfPagesWithoutExtractableText': pdf_pages_without_text, 'issues': issues,
              'includedFolders': list(SCOPES), 'excludedFolders': ['04 Student Work and Assessment', '05 Organisation Records'],
              'notes': ['Text extraction only; image-only content has not been OCRed.',
                        'Original source files were preserved.', 'No student submissions were indexed.']}
    (output / '_manifests/build-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'issues'}), flush=True)


if __name__ == '__main__':
    logging.getLogger('pypdf').setLevel(logging.ERROR)
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--sections', type=Path, default=Path(__file__).resolve().parents[1] / 'server/data/worksheetSections.live.json')
    args = parser.parse_args()
    build(args.source, args.output, args.sections)
