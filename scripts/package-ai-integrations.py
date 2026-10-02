#!/usr/bin/env python3
"""Deterministic review archives: explicit files, no credentials or dependencies."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "integrations" / "packages"
COMMON = ["plugin.json", "mcp.json", "README.md", "LICENSE", "NOTICE"]
FILES = {
    "zodiacs-sky": COMMON,
    "zodiacs-developer": COMMON + ["package.json", "package-lock.json", ".mcp.json", "ENGINE-LICENSE", "ENGINE-NOTICE", "ENGINE-LICENSING"],
}
DIRS = {"zodiacs-sky": ["assets", "skills"], "zodiacs-developer": ["assets", "skills", "examples", "mcp", ".codex-plugin"]}


def archive(name):
    root = ROOT / "plugins" / name
    paths = [root / filename for filename in FILES[name]]
    for directory in DIRS[name]:
        paths.extend(path for path in (root / directory).rglob("*") if path.is_file())
    data = io.BytesIO()
    members = []
    with zipfile.ZipFile(data, "w", compression=zipfile.ZIP_STORED) as bundle:
        for path in sorted(paths, key=lambda path: path.relative_to(root).as_posix()):
            if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
                raise ValueError("Package files must stay inside the plugin without symlinks")
            relative = path.relative_to(root).as_posix()
            if any(part in {"node_modules", ".git", ".plugin-data", "__pycache__"} or part.startswith('.env') for part in path.relative_to(root).parts):
                raise ValueError("Excluded package material")
            payload = path.read_bytes()
            info = zipfile.ZipInfo(relative, (2026, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, payload)
            members.append({"path": relative, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})
    return data.getvalue(), members


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"schema": "zodiacs.ai-review-packages.v1", "status": "Unpublished review candidates; bounded host evidence recorded, release gates pending", "packages": []}
    for name in FILES:
        version = json.loads((ROOT / "plugins" / name / "plugin.json").read_text())["version"]
        filename = f"{name}-{version}.zip"
        payload, members = archive(name)
        target = OUT / filename
        if args.check:
            if not target.exists() or target.read_bytes() != payload:
                raise ValueError(f"Stale {filename}; run npm run ai:package")
        else:
            target.write_bytes(payload)
        manifest["packages"].append({"name": name, "version": version, "file": filename, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(), "members": members})
        print(f"{'Verified' if args.check else 'Built'} {filename} ({len(payload)} bytes)")
    serialized = (json.dumps(manifest, indent=2) + "\n").encode()
    path = OUT / "manifest.json"
    if args.check:
        if not path.exists() or path.read_bytes() != serialized:
            raise ValueError("Stale package manifest; run npm run ai:package")
    else:
        path.write_bytes(serialized)


if __name__ == "__main__":
    main()
