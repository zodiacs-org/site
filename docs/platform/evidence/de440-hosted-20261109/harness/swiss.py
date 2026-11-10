"""Swiss Ephemeris, the instrument of P4.1's rules (i), (ii) and (v)
(../PREREGISTRATION.md, "Oracles and their receipts" and "The rules").

    venv/bin/python -I swiss.py REQUEST.json OUT.json

REQUEST.json:

    {"ephePath": "<directory holding semo_18.se1 and sepl_18.se1>",
     "jplFile": "<absolute path of linux_p1550p2650.440>",
     "calls": [{"id": "<string>", "mode": "se1" | "jpl", "jdTt": <TT Julian date>,
                "body": "Sun" | "Moon" | "Mercury" | "Venus" | "Mars" | "Jupiter" |
                        "Saturn" | "Uranus" | "Neptune" | "Pluto" | "TrueNode"}]}

Each call is swe.calc at the TT given (never calc_ut), with no flag but the
ephemeris's own: FLG_SWIEPH for "se1" (the .se1 files in ephePath) and
FLG_JPLEPH for "jpl" (the JPL file, named by set_jpl_file). So every place is
Swiss's default, the apparent geocentric ecliptic and equinox of date, with
light-time, deflection, aberration, precession and nutation (no TRUEPOS,
NOABERR or NOGDEFL). TrueNode is SE_TRUE_NODE. Mars to Pluto are what Swiss
gives without FLG_CENTER_BODY: the barycentres of the planets' systems (with
that flag Swiss asks for its planetary-moon files, sepm9599.se1 for Jupiter,
to move to the planet's centre; the flag is never set here).

Swiss keeps only the base name of the JPL file and looks for it in the
ephemeris path; with the file elsewhere it answers from the .se1 files and
says so only in the returned flag. So the "jpl" calls run with the path set to
the JPL file's own directory, and the "se1" calls, before them, with ephePath.
The environment's SE_EPHE_PATH, which Swiss would put before the path given,
is removed at start.

The returned flag of every call is checked: a "jpl" call whose ephemeris bits
are not FLG_JPLEPH, or a "se1" call whose ephemeris bits are not FLG_SWIEPH
(Swiss falls back to its Moshier series without raising, outside its files'
span among other cases), is not a valid row. It gets ok false and an error
saying so: PREREGISTRATION.md calls this an instrument failure. A call that
raises gets ok false and the exception's message. A malformed request is
refused whole (exit 2, nothing written).

OUT.json:

    {"swisseph": "2.10.03", "pyswisseph": "2.10.3.2", "python": "...",
     "jplFile": {"name", "bytes", "sha256"}, "ephePath": "...",
     "se1Files": {"<name>": {"bytes", "sha256"}}, "flags": {"se1": 2, "jpl": 1},
     "calls": [{"id", "ok", "lon", "lat", "retflag", "error" (only when not ok)}]}

with the calls in the request's order, lon and lat in degrees as Swiss returns
them (null when not ok) and retflag as Swiss returned it (null when the call
raised). OUT holds per-case Swiss values, which are never committed
(DECISIONS-2026-09-29 section 2, F-22), so the tool refuses an OUT path inside
a git working tree. It prints one summary line and nothing per row.
"""
import hashlib
import json
import math
import os
import sys
import tempfile

IGNORED_SE_EPHE_PATH = os.environ.pop('SE_EPHE_PATH', None)

import swisseph as swe  # noqa: E402  (after SE_EPHE_PATH is removed)

BODIES = {
    'Sun': swe.SUN, 'Moon': swe.MOON, 'Mercury': swe.MERCURY, 'Venus': swe.VENUS, 'Mars': swe.MARS,
    'Jupiter': swe.JUPITER, 'Saturn': swe.SATURN, 'Uranus': swe.URANUS, 'Neptune': swe.NEPTUNE,
    'Pluto': swe.PLUTO, 'TrueNode': swe.TRUE_NODE,
}
MODES = {'se1': swe.FLG_SWIEPH, 'jpl': swe.FLG_JPLEPH}
EPHEMERIS_BITS = {swe.FLG_JPLEPH: 'FLG_JPLEPH', swe.FLG_SWIEPH: 'FLG_SWIEPH', swe.FLG_MOSEPH: 'FLG_MOSEPH'}


class RequestError(Exception):
    """A request the tool cannot run as written."""


def is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def file_digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def git_working_tree(path):
    """The directory holding a .git entry at or above path's directory, if any."""
    d = os.path.realpath(os.path.dirname(os.path.abspath(path)))
    while True:
        if os.path.lexists(os.path.join(d, '.git')):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def load_request(path):
    with open(path) as f:
        req = json.load(f)
    if not isinstance(req, dict):
        raise RequestError('the request is not a JSON object')
    ephe_path, jpl_file, calls = req.get('ephePath'), req.get('jplFile'), req.get('calls')
    if not isinstance(ephe_path, str) or not os.path.isdir(ephe_path):
        raise RequestError(f'ephePath {ephe_path!r} is not a directory')
    if not isinstance(jpl_file, str) or not os.path.isabs(jpl_file) or not os.path.isfile(jpl_file):
        raise RequestError(f'jplFile {jpl_file!r} is not the absolute path of a file')
    if not isinstance(calls, list):
        raise RequestError('calls is not a list')
    seen = set()
    for n, call in enumerate(calls):
        if not isinstance(call, dict):
            raise RequestError(f'call {n} is not an object')
        cid = call.get('id')
        if not isinstance(cid, str) or not cid or cid in seen:
            raise RequestError(f'call {n}: id {cid!r} is missing, not a string or repeated')
        seen.add(cid)
        if call.get('mode') not in MODES:
            raise RequestError(f'call {cid}: mode {call.get("mode")!r} is not "se1" or "jpl"')
        if call.get('body') not in BODIES:
            raise RequestError(f'call {cid}: body {call.get("body")!r} is not one of {", ".join(BODIES)}')
        if not is_number(call.get('jdTt')):
            raise RequestError(f'call {cid}: jdTt {call.get("jdTt")!r} is not a finite number')
    return ephe_path, jpl_file, calls


def flag_problem(mode, retflag):
    """Why a returned flag does not make a valid row of this mode, or None."""
    asked = MODES[mode]
    if retflag < 0:
        return f'Swiss returned the error flag {retflag}'
    used = sum(bit for bit in EPHEMERIS_BITS if retflag & bit)
    if used != asked:
        names = '+'.join(name for bit, name in EPHEMERIS_BITS.items() if retflag & bit) or 'no ephemeris bit'
        return (f'a "{mode}" call needs {EPHEMERIS_BITS[asked]} alone in the returned flag; Swiss returned '
                f'{retflag} ({names}): not a valid row (an instrument failure)')
    return None


def configure(mode, ephe_path, jpl_file):
    if mode == 'se1':
        swe.set_ephe_path(ephe_path)
    else:
        swe.set_ephe_path(os.path.dirname(jpl_file))
        swe.set_jpl_file(os.path.basename(jpl_file))


def compute(call):
    try:
        xx, retflag = swe.calc(float(call['jdTt']), BODIES[call['body']], MODES[call['mode']])
    except Exception as exc:  # swisseph.Error or any other: this row's instrument failure
        return {'id': call['id'], 'ok': False, 'lon': None, 'lat': None, 'retflag': None,
                'error': f'{type(exc).__name__}: {exc}'}
    problem = flag_problem(call['mode'], retflag)
    if problem is None and not (math.isfinite(xx[0]) and math.isfinite(xx[1])):
        problem = 'Swiss returned a longitude or latitude that is not finite'
    if problem:
        return {'id': call['id'], 'ok': False, 'lon': None, 'lat': None, 'retflag': retflag, 'error': problem}
    return {'id': call['id'], 'ok': True, 'lon': xx[0], 'lat': xx[1], 'retflag': retflag}


def run(ephe_path, jpl_file, calls):
    results = {}
    for mode in ('se1', 'jpl'):
        group = [call for call in calls if call['mode'] == mode]
        if not group:
            continue
        try:
            configure(mode, ephe_path, jpl_file)
        except Exception as exc:  # the ephemeris could not be set up: every call of the mode fails
            for call in group:
                results[call['id']] = {'id': call['id'], 'ok': False, 'lon': None, 'lat': None, 'retflag': None,
                                       'error': f'setting up "{mode}": {type(exc).__name__}: {exc}'}
            continue
        for call in group:
            results[call['id']] = compute(call)
        swe.close()
    return [results[call['id']] for call in calls]


def binding_version():
    try:
        from importlib.metadata import version
        return version('pyswisseph')
    except Exception:  # the distribution's metadata is not there
        return None


def write_json(path, value):
    """Writes path whole or not at all."""
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(prefix='.swiss-', suffix='.json', dir=directory)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(value, f, indent=1)
            f.write('\n')
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def main(argv):
    if len(argv) != 2:
        print(__doc__.split('\n\n')[1], file=sys.stderr)
        return 2
    request_path, out_path = argv
    if not os.path.isdir(os.path.dirname(os.path.abspath(out_path))):
        print(f'swiss.py: refused: the directory of {out_path} does not exist', file=sys.stderr)
        return 2
    worktree = git_working_tree(out_path)
    if worktree:
        print(f'swiss.py: refused: {out_path} is inside the git working tree {worktree}; '
              'per-case Swiss values stay outside every repository', file=sys.stderr)
        return 2
    try:
        ephe_path, jpl_file, calls = load_request(request_path)
    except (OSError, ValueError, RequestError) as exc:
        print(f'swiss.py: refused: {exc}', file=sys.stderr)
        return 2
    se1_files = {
        name: {'bytes': os.path.getsize(os.path.join(ephe_path, name)), 'sha256': file_digest(os.path.join(ephe_path, name))}
        for name in sorted(os.listdir(ephe_path)) if name.endswith('.se1')
    }
    out = {
        'swisseph': swe.version,
        'pyswisseph': binding_version(),
        'python': sys.version.split()[0],
        'jplFile': {'name': os.path.basename(jpl_file), 'bytes': os.path.getsize(jpl_file), 'sha256': file_digest(jpl_file)},
        'ephePath': ephe_path,
        'se1Files': se1_files,
        'flags': {mode: flag for mode, flag in MODES.items()},
        'calls': run(ephe_path, jpl_file, calls),
    }
    if IGNORED_SE_EPHE_PATH is not None:
        out['ignoredEnvironment'] = {'SE_EPHE_PATH': IGNORED_SE_EPHE_PATH}
    write_json(out_path, out)
    failed = sum(1 for call in out['calls'] if not call['ok'])
    print(f'swiss.py: {len(calls)} calls, {failed} not valid', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
