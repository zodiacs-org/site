#!/usr/bin/env python3
"""Deterministic review archives: explicit files, no credentials or dependencies."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "integrations" / "packages"
COMMON = ["plugin.json", "mcp.json", "README.md", "LICENSE", "NOTICE"]
FILES = {
    "zodiacs-sky": COMMON + [".mcp.json"],
    "zodiacs-developer": COMMON + ["package.json", "package-lock.json", ".mcp.json", "ENGINE-LICENSE", "ENGINE-NOTICE", "ENGINE-LICENSING"],
}
DIRS = {"zodiacs-sky": ["assets", "skills", ".codex-plugin", ".claude-plugin"], "zodiacs-developer": ["assets", "skills", "examples", "mcp", ".codex-plugin"]}
DEVELOPER_COMPATIBILITY_FILES = ("mcp/server.mjs", "ENGINE-LICENSE", "ENGINE-NOTICE", "ENGINE-LICENSING", "NOTICE")


def developer_compatibility(check):
    receipt = json.loads((ROOT / "docs/platform/evidence/site-engine-1-1-0/connector-transition.json").read_text())["developer"]
    archive = (ROOT / receipt["baselineArchive"]).read_bytes()
    if hashlib.sha256(archive).hexdigest() != receipt["baselineArchiveSha256"]:
        raise ValueError("The baseline developer archive has changed")
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        for member in DEVELOPER_COMPATIBILITY_FILES:
            path = ROOT / "plugins/zodiacs-developer" / member
            expected = bundle.read(member)
            if check:
                if path.read_bytes() != expected:
                    raise ValueError(f"The developer compatibility file {member} has changed")
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(expected)


APPLE_DOUBLE = bytes([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00])


def macos_sidecar(relative):
    """macOS metadata, never package material: the ._ AppleDouble file an ExFAT volume keeps beside every file, and __MACOSX folders."""
    return any(part == "__MACOSX" or part.startswith("._") for part in relative.parts)


def archive(name, plugin_root=None):
    root = plugin_root if plugin_root is not None else ROOT / "plugins" / name
    paths = [root / filename for filename in FILES[name]]
    for directory in DIRS[name]:
        paths.extend(path for path in (root / directory).rglob("*") if path.is_file() and not macos_sidecar(path.relative_to(root)))
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


def verify_macos_sidecar_exclusion(expected_archives):
    """Self-check inside the Python-backed ai:check gate so the Node default test suite needs no Python."""
    cases = {
        "mcp/._server.mjs": True,
        ".codex-plugin/._plugin.json": True,
        "assets/__MACOSX/icon.png": True,
        "__MACOSX/skills/x/SKILL.md": True,
        "skills/._sky/SKILL.md": True,
        "mcp/server.mjs": False,
        ".codex-plugin/plugin.json": False,
        ".claude-plugin/plugin.json": False,
        "skills/sky/SKILL.md": False,
        "assets/icon._x.png": False,
    }
    for rel, expected in cases.items():
        if macos_sidecar(PurePosixPath(rel)) is not expected:
            raise ValueError(f"macos_sidecar mismatch for {rel}")
    with tempfile.TemporaryDirectory(prefix="package-ai-integrations-") as tmp:
        tmp_root = Path(tmp)
        for name, (expected_payload, expected_members) in expected_archives.items():
            src_root = ROOT / "plugins" / name
            dst_root = tmp_root / name
            for member in expected_members:
                src = src_root / member["path"]
                dst = dst_root / member["path"]
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dst)
            # Plant ._ AppleDouble files beside every file and __MACOSX folders in every directory.
            all_files = [p for p in dst_root.rglob("*") if p.is_file()]
            all_dirs = [dst_root] + [p for p in dst_root.rglob("*") if p.is_dir()]
            for file_path in all_files:
                (file_path.parent / f"._{file_path.name}").write_bytes(APPLE_DOUBLE)
            for dir_path in all_dirs:
                macosx = dir_path / "__MACOSX"
                macosx.mkdir(parents=True, exist_ok=True)
                (macosx / "README.md").write_text("Finder metadata\n")
                (macosx / "._README.md").write_bytes(APPLE_DOUBLE)
            # Verify sidecars actually exist under scanned DIRS so the test exercises the filter.
            raw_found = [
                p for d in DIRS[name] for p in (dst_root / d).rglob("*")
                if p.is_file() and macos_sidecar(p.relative_to(dst_root))
            ]
            if not raw_found:
                raise ValueError(f"Expected planted macOS sidecars under {name}")
            rebuilt_payload, _ = archive(name, plugin_root=dst_root)
            if rebuilt_payload != expected_payload:
                raise ValueError(f"macOS sidecars leaked into {name} archive")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--developer-compatibility", action="store_true")
    args = parser.parse_args()
    developer_compatibility(args.check or not args.developer_compatibility)
    if args.developer_compatibility:
        return
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"schema": "zodiacs.ai-review-packages.v1", "status": "Unpublished review candidates; bounded host evidence recorded, release gates pending", "packages": []}
    checked_archives = {}
    for name in FILES:
        version = json.loads((ROOT / "plugins" / name / "plugin.json").read_text())["version"]
        filename = f"{name}-{version}.zip"
        payload, members = archive(name)
        checked_archives[name] = (payload, members)
        target = OUT / filename
        if args.check:
            if not target.exists() or target.read_bytes() != payload:
                raise ValueError(f"Stale {filename}; run npm run ai:package")
        # Unchanged archives keep their exact file and modification time.
        elif not target.exists() or target.read_bytes() != payload:
            # An archive already built for a version keeps its bytes: it may have
            # been reviewed or uploaded. A change needs a new version.
            if target.exists():
                raise ValueError(f"{filename} already exists with other bytes; use a new version")
            target.write_bytes(payload)
        manifest["packages"].append({"name": name, "version": version, "file": filename, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(), "members": members})
        print(f"{'Verified' if args.check else 'Built'} {filename} ({len(payload)} bytes)")
    serialized = (json.dumps(manifest, indent=2) + "\n").encode()
    path = OUT / "manifest.json"
    if args.check:
        if not path.exists() or path.read_bytes() != serialized:
            raise ValueError("Stale package manifest; run npm run ai:package")
        verify_macos_sidecar_exclusion(checked_archives)
    else:
        path.write_bytes(serialized)


if __name__ == "__main__":
    main()
