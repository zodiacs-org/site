"""Record installed instrument identity, without copying its code or data."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import subprocess
import sys
import swisseph
print(json.dumps({
    'node': subprocess.check_output(['node','--version'],text=True).strip(),
    'python':sys.version,
    'pyswissephDistributionVersion':importlib.metadata.version('pyswisseph'),
    'swissLibraryVersion':swisseph.version,
    'swissExtensionSha256':hashlib.sha256(Path(swisseph.__file__).read_bytes()).hexdigest(),
    'pyerfaDistributionVersion':subprocess.check_output([sys.argv[1],'-c','import erfa;print(erfa.__version__)'],text=True).strip(),
},indent=2))
