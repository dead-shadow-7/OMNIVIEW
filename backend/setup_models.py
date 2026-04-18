"""Download pre-trained model weights from the OMNIVIEW GitHub release.

Usage:
    python setup_models.py              # download missing / corrupt files
    python setup_models.py --force      # re-download everything
    python setup_models.py --verify     # verify existing files only, no download
"""

import argparse
import hashlib
import sys
from pathlib import Path

import requests
from tqdm import tqdm

RELEASE_TAG = "v1.0-models-alpha"
BASE_URL = f"https://github.com/Vinit710/OMNIVIEW/releases/download/{RELEASE_TAG}"
MODELS_DIR = Path(__file__).resolve().parent / "ml_models"

# Paste SHA-256 hashes here once generated (certutil -hashfile <file> SHA256).
# Leave as None to skip hash verification (size check still runs).
MODELS = {
    "unet_builtup_cd.pth": {
        "size": 124_273_482,
        "sha256": None,
    },
    "road_detection_resnet_e50.h5": {
        "size": 66_242_392,
        "sha256": None,
    },
    "unet_poland_ds_modelv1.onnx": {
        "size": 97_796_058,
        "sha256": None,
    },
}

CHUNK = 1024 * 1024  # 1 MiB


def sha256sum(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def file_ok(path: Path, meta: dict) -> bool:
    if not path.exists():
        return False
    if path.stat().st_size != meta["size"]:
        return False
    if meta["sha256"] and sha256sum(path) != meta["sha256"]:
        return False
    return True


def download(filename: str, dest: Path) -> None:
    url = f"{BASE_URL}/{filename}"
    with requests.get(url, stream=True, timeout=30) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        tmp = dest.with_suffix(dest.suffix + ".part")
        with tmp.open("wb") as f, tqdm(
            total=total, unit="B", unit_scale=True, desc=filename, ncols=80
        ) as bar:
            for chunk in r.iter_content(CHUNK):
                f.write(chunk)
                bar.update(len(chunk))
        tmp.replace(dest)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-download all files")
    parser.add_argument("--verify", action="store_true", help="verify only, no download")
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Target directory: {MODELS_DIR}")
    print(f"Release: {RELEASE_TAG}\n")

    failures = []
    for name, meta in MODELS.items():
        path = MODELS_DIR / name

        if args.verify:
            if file_ok(path, meta):
                print(f"OK       {name}")
            else:
                print(f"MISSING/BAD  {name}")
                failures.append(name)
            continue

        if not args.force and file_ok(path, meta):
            print(f"skip     {name} (already present)")
            continue

        print(f"fetch    {name}")
        try:
            download(name, path)
        except Exception as e:
            print(f"  ERROR: {e}")
            failures.append(name)
            continue

        if path.stat().st_size != meta["size"]:
            print(f"  ERROR: size mismatch (got {path.stat().st_size}, expected {meta['size']})")
            failures.append(name)
            continue

        if meta["sha256"]:
            got = sha256sum(path)
            if got != meta["sha256"]:
                print(f"  ERROR: sha256 mismatch (got {got})")
                failures.append(name)
                continue
            print(f"  verified sha256")
        else:
            print(f"  downloaded ({path.stat().st_size:,} bytes) - sha256 not configured")

    print()
    if failures:
        print(f"FAILED: {', '.join(failures)}")
        return 1
    print("All models ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
