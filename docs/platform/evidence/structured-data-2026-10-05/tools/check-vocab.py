"""
Hold every JSON-LD node on built pages to schema.org's vocabulary: each @type
is a schema.org type, each property a schema.org property whose domain takes
the node's type or a type it inherits from, and each typed value a type the
property's range takes. A value given as text where the range names no text
type is listed as a note, not an error.

    python3 check-vocab.py schemaorg-current-https.jsonld dist/developers/index.html ...

The vocabulary file is schema.org's own
(https://schema.org/version/latest/schemaorg-current-https.jsonld) and is not
copied into this repository.
"""
import json, re, sys, html
V = json.load(open(sys.argv[1]))['@graph']
def ids(x):
    if x is None: return []
    return [y['@id'] for y in (x if isinstance(x, list) else [x])]
classes, props, parents = set(), {}, {}
for t in V:
    kind = t.get('@type'); kind = kind if isinstance(kind, list) else [kind]
    if 'rdfs:Class' in kind or any(k.startswith('schema:') for k in kind if isinstance(k, str)):
        if 'rdfs:Class' in kind: classes.add(t['@id']); parents[t['@id']] = ids(t.get('rdfs:subClassOf'))
    if 'rdf:Property' in kind:
        props[t['@id']] = {'domain': ids(t.get('schema:domainIncludes')), 'range': ids(t.get('schema:rangeIncludes')), 'superseded': t.get('schema:supersededBy')}
# data types count as classes too (schema:Text, schema:URL, ...)
for t in V:
    kind = t.get('@type'); kind = kind if isinstance(kind, list) else [kind]
    if 'schema:DataType' in kind: classes.add(t['@id']); parents.setdefault(t['@id'], [])
def ancestors(c, seen=None):
    seen = seen or set()
    if c in seen: return seen
    seen.add(c)
    for p in parents.get(c, []): ancestors(p, seen)
    return seen
TEXTISH = {'schema:Text', 'schema:URL', 'schema:Date', 'schema:DateTime', 'schema:Time', 'schema:Number', 'schema:Integer', 'schema:Float', 'schema:Boolean', 'schema:CssSelectorType', 'schema:XPathType', 'schema:PronounceableText'}
errors, notes, counts = [], [], {}
def check(node, where):
    if not isinstance(node, dict): return
    types = node.get('@type')
    if types is None:
        return  # a reference ({"@id": ...}) or a plain value object
    types = types if isinstance(types, list) else [types]
    full = []
    for t in types:
        c = 'schema:' + t
        if c not in classes: errors.append(f'{where}: @type {t} is not a schema.org type')
        else: full.append(c)
        counts[t] = counts.get(t, 0) + 1
    anc = set().union(*[ancestors(c) for c in full]) if full else set()
    for key, value in node.items():
        if key.startswith('@'): continue
        p = props.get('schema:' + key)
        if not p: errors.append(f'{where}: {"/".join(types)}.{key} is not a schema.org property'); continue
        if p['superseded']: notes.append(f'{where}: {key} is superseded by {p["superseded"]}')
        if p['domain'] and not (set(p['domain']) & anc):
            errors.append(f'{where}: {key} does not apply to {"/".join(types)} (domain {", ".join(d[7:] for d in p["domain"])})')
        for v in (value if isinstance(value, list) else [value]):
            if isinstance(v, dict) and '@type' in v:
                vt = v['@type'] if isinstance(v['@type'], list) else [v['@type']]
                vanc = set().union(*[ancestors('schema:' + t) for t in vt])
                if p['range'] and not (set(p['range']) & vanc):
                    errors.append(f'{where}: {key} takes {", ".join(r[7:] for r in p["range"])}, not {"/".join(vt)}')
                check(v, f'{where} > {key}')
            elif isinstance(v, dict):
                pass
            elif p['range'] and not (set(p['range']) & TEXTISH):
                notes.append(f'{where}: {key} is given as text; schema.org expects {", ".join(r[7:] for r in p["range"])}')
for page in sys.argv[2:]:
    text = open(page, encoding='utf-8').read()
    blocks = re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', text, re.S)
    for b, block in enumerate(blocks):
        data = json.loads(html.unescape(block) if '&quot;' in block else block)
        nodes = data['@graph'] if isinstance(data, dict) and '@graph' in data else (data if isinstance(data, list) else [data])
        for n, node in enumerate(nodes):
            check(node, f'{page.split("dist/")[-1]} #{b}.{n}')
print('types:', dict(sorted(counts.items())))
print(f'{len(errors)} errors, {len(notes)} notes')
for e in errors: print('ERROR', e)
for n in notes: print('note ', n)
