#!/usr/bin/env python3
"""Download the pinned GNHK mirror and optionally unpack its handwriting splits."""
import argparse
import hashlib
from pathlib import Path, PurePosixPath
import shutil
import stat
import urllib.request
import zipfile

REVISION = "eaa67d396fd29b8b04e38d630da79f67db11b212"
URL = f"https://huggingface.co/datasets/staghado/GNHK-Dataset/resolve/{REVISION}/GNHK-dataset.zip"
EXPECTED_SIZE = 1_010_143_400
EXPECTED_SHA256 = "5f4b470030b41cd80e32d3a5ae7bc8bc41acc79b4bf770a451e7ec54ca3be34d"
DEFAULT_DIRECTORY = Path(__file__).resolve().parents[1] / "Data" / "GNHK"


def verify(archive):
    if archive.stat().st_size != EXPECTED_SIZE:
        raise ValueError(f"Wrong archive size: expected {EXPECTED_SIZE:,} bytes")
    digest = hashlib.sha256()
    with archive.open("rb") as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != EXPECTED_SHA256:
        raise ValueError("Archive checksum mismatch; remove it and download again")


def download(directory):
    archive = directory / "GNHK-dataset.zip"
    if archive.exists():
        verify(archive)
        print("Existing archive verified; no download needed.")
        return archive
    partial = directory / "GNHK-dataset.zip.part"
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > EXPECTED_SIZE:
        raise ValueError("Partial archive is too large; remove the .part file")
    if offset < EXPECTED_SIZE:
        headers = {"User-Agent": "LexiHacks-dataset-downloader/1.0"}
        if offset:
            headers["Range"] = f"bytes={offset}-"
        request = urllib.request.Request(URL, headers=headers)
        with urllib.request.urlopen(request, timeout=120) as response:
            resume = offset > 0 and response.status == 206
            if resume and not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
                raise ValueError("Server returned an unexpected download range")
            received = offset if resume else 0
            print(f"Downloading approximately 1 GB (starting at {received:,} bytes).")
            with partial.open("ab" if resume else "wb") as target:
                for chunk in iter(lambda: response.read(8 * 1024 * 1024), b""):
                    received += len(chunk)
                    if received > EXPECTED_SIZE:
                        raise ValueError("Download exceeds the pinned archive size")
                    target.write(chunk)
                    print(f"\r{received / EXPECTED_SIZE:.0%}", end="", flush=True)
            print()
    verify(partial)
    partial.replace(archive)
    print("Download verified with SHA-256.")
    return archive


def safe_extract(archive, destination):
    """Reject traversal and symlinks before writing any member."""
    root = destination.resolve()
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            name = PurePosixPath(member.filename)
            target = (root / member.filename).resolve()
            if (name.is_absolute() or ".." in name.parts or "\\" in member.filename
                    or ":" in member.filename or not target.is_relative_to(root)
                    or stat.S_ISLNK(member.external_attr >> 16)):
                raise ValueError(f"Unsafe archive member: {member.filename}")
        source.extractall(root)


def extract(archive, directory, split):
    destination = directory / "extracted"
    destination.mkdir(exist_ok=True)
    splits = ("train", "test") if split == "both" else (split,)
    with zipfile.ZipFile(archive) as source:
        for name in splits:
            nested = destination / f"{name}_data.zip"
            with source.open(f"{name}_data.zip") as incoming, nested.open("wb") as target:
                shutil.copyfileobj(incoming, target)
            safe_extract(nested, destination)
            nested.unlink()
            print(f"Extracted {name} images and word annotations into {destination / name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", type=Path, default=DEFAULT_DIRECTORY)
    parser.add_argument("--extract", action="store_true", help="Unpack images and annotations")
    parser.add_argument("--split", choices=("train", "test", "both"), default="both")
    parser.add_argument("--verify-only", action="store_true", help="Verify the existing archive without downloading")
    args = parser.parse_args()
    directory = args.destination.expanduser().resolve()
    directory.mkdir(parents=True, exist_ok=True)
    try:
        if args.verify_only:
            archive = directory / "GNHK-dataset.zip"
            verify(archive)
            print("Existing archive verified.")
        else:
            archive = download(directory)
        if args.extract:
            extract(archive, directory, args.split)
    except (OSError, ValueError, zipfile.BadZipFile, KeyError) as error:
        parser.exit(1, f"Dataset setup failed: {error}\n")
    print(f"Archive: {archive}")


if __name__ == "__main__":
    main()
