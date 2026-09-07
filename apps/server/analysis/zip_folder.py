"""
Creates a .zip archive from a checkpoint folder.

Usage:
    python zip_folder.py --src <folder> --out <output.zip>
"""
import argparse
import os
import sys
import zipfile


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if not os.path.isdir(args.src):
        print(f"ERR: source folder not found: {args.src}", file=sys.stderr)
        sys.exit(1)

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _dirs, files in os.walk(args.src):
            for f in files:
                fp = os.path.join(root, f)
                arcname = os.path.relpath(fp, args.src)
                z.write(fp, arcname)

    print("ZIP_OK")


if __name__ == "__main__":
    main()
