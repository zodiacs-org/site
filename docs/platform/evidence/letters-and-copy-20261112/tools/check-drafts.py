#!/usr/bin/env python3
"""Checks on the ZOD-108 drafts. Run from this folder's parent: python3 tools/check-drafts.py

1. Every bracketed source key used in a draft is defined in SOURCES.md.
2. The tool-description lines (What it does / When it fits / Limits) hold no
   directive wording of the kind the ZOD-99 dry run flagged.
3. All 19 live tools have a description.
4. No en dash or em dash in the drafts' own prose (quoted live text is exempt:
   lines inside raw/ are not scanned).
"""
import json, re, sys, pathlib
here = pathlib.Path(__file__).resolve().parent.parent
drafts = ["01-letter-naif.md", "02-letter-iers.md", "03-letter-cds.md", "04-lawyer-brief.md",
          "05-tool-descriptions.md", "06-how-we-calculate.md", "README.md", "SOURCES.md"]
ok = True
src = (here / "SOURCES.md").read_text()
defined = set(re.findall(r"^\| ([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+) \|", src, re.M))
for name in drafts:
    p = here / name
    if not p.exists():
        continue
    text = p.read_text()
    used = set(re.findall(r"`\[([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\]`", text))
    missing = sorted(used - defined)
    print(f"{name}: {len(used)} distinct keys, undefined: {missing or 'none'}")
    ok &= not missing
    for n, line in enumerate(text.splitlines(), 1):
        if "–" in line or "—" in line:
            print(f"  dash at {name}:{n}: {line[:90]}"); ok = False

# Tools present
resp = (here / "raw/mcp/01-tools-list.response.txt").read_text()
data = json.loads([l[5:] for l in resp.splitlines() if l.startswith("data:")][0])
live = [t["name"] for t in data["result"]["tools"]]
td = (here / "05-tool-descriptions.md").read_text()
drafted = re.findall(r"^### \d+\. `([a-z_]+)`", td, re.M)
print(f"live tools: {len(live)}; drafted: {len(drafted)}; same order: {live == drafted}")
ok &= live == drafted

# Directive wording in the three description parts only
directive = re.compile(
    r"\b(do not|don't|never (?:guess|make|write|put|rebuild|turn)|lead with|share (?:the|it)|present (?:it|each)|"
    r"offer|decline|tell the|give (?:them|it|the)|ask (?:the|before|for)|pass (?:the|their|its|that)|copy the|"
    r"use it|call it|you |your )", re.I)
hits = 0
part = None
for n, line in enumerate(td.splitlines(), 1):
    m = re.match(r"- \*\*(What it does|When it fits|Limits|Live wording left out|Not yet true, so not stated)\.\*\*", line)
    if m:
        part = m.group(1)
    elif line.startswith("#") or not line.strip():
        part = None if line.startswith("#") else part
    if part in ("What it does", "When it fits", "Limits"):
        scan = re.sub(r'"[^"]*"', '""', line)          # quoted examples and messages are not instructions
        for h in directive.finditer(scan):
            print(f"  directive? 05-tool-descriptions.md:{n}: ...{scan[max(0,h.start()-30):h.end()+30]}...")
            hits += 1
print(f"directive wording in description parts: {hits}")
ok &= hits == 0
print("OK" if ok else "FAILED")
sys.exit(0 if ok else 1)
