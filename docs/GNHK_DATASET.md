# Download the optional GNHK handwriting dataset

From the repository root, using Python 3.11 or newer:

```sh
python3 scripts/download_gnhk.py --extract --split test
```

On Windows, use `py -3` instead of `python3` if needed. No Python packages or API
credentials are required to download the dataset. The archive is approximately
1 GB; allow extra disk space for extracted images. An interrupted download resumes
from its `.part` file. Existing archives are verified and reused.

The command saves the original archive in `Data/GNHK/GNHK-dataset.zip` and test
images plus JSON word annotations in `Data/GNHK/extracted/test/`. These files are
ignored by Git. For both splits, omit `--split test`. Use `--verify-only` to check
an existing archive without downloading, or `--destination PATH` for another location.

Create a separate fictional dataset-demo student in the app, then upload a JPG
from the extracted folder with the **Essay** task type. Live analysis needs the
normal server `GEMINI_API_KEY` setup. Analysis applies EXIF orientation, detects
90-degree handwriting rotations and generates suggestions using the upright page.
Original uploads remain unchanged; existing samples are not retroactively rotated.
This is page orientation correction, not perspective correction or slight-angle deskew.
Uncertain orientation keeps the EXIF-adjusted page; mock AI does not perform vision-based rotation.

The transcriptions and word polygons are handwriting-recognition annotations,
not verified literacy-error labels. Writer ages and grades are unknown. Some
pages contain names or other personal information; use the samples thoughtfully.
Do not label the mixed dataset as children's schoolwork or count AI suggestions
as human-verified errors.

Two optional examples inspected locally:

- `eng_AF_041.jpg`: a page of quotations; includes “untill”. Several other AI
  flags were line-break or handwriting-reading errors.
- `eng_AF_095.jpg`: a course outline; includes a possible misspelling of
  “peripheral”. Its suggestions still need review.

The original student-work dataset remains the stronger source of error-heavy
examples for the demo. Downloading GNHK does not import or seed the app database.

## Source and verification

Original dataset: [GoodNotes/GNHK-dataset](https://github.com/GoodNotes/GNHK-dataset).
Credit Alex W. C. Lee, Jonathan Chung and Marco Lee (2021), CC BY 4.0.
Download mirror: [staghado/GNHK-Dataset](https://huggingface.co/datasets/staghado/GNHK-Dataset).

The download is pinned to revision `eaa67d396fd29b8b04e38d630da79f67db11b212`.
Expected size: `1,010,143,400` bytes. SHA-256:

```text
5f4b470030b41cd80e32d3a5ae7bc8bc41acc79b4bf770a451e7ec54ca3be34d
```
