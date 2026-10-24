#!/usr/bin/env python3
"""Everything the deploy does, in order: images -> scene pictures -> rule shards -> site pages.

    python3 tools/build_all.py         full site in builds/site/  (then: python3 -m http.server -d builds/site)
                                       With Apache serving this folder, the repo's .htaccess does the mapping.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for step, args in (("tools/make_images.py", []), ("tools/make_scenes.py", []), ("tools/make_shard.py", []), ("tools/make_site.py", [])):
    print(f"== {step} {' '.join(args)}".rstrip())
    if subprocess.run([sys.executable, str(ROOT / step), *args], cwd=ROOT).returncode:
        sys.exit(f"{step} failed")
