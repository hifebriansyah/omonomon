#!/usr/bin/env python3
"""Everything the deploy does, in order: images -> rule shards -> site pages in builds/site/.
Usage: python3 tools/build_all.py   then   python3 -m http.server -d builds/site
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for step in ("tools/make_images.py", "build.py", "tools/make_site.py"):
    print(f"== {step}")
    if subprocess.run([sys.executable, str(ROOT / step)], cwd=ROOT).returncode:
        sys.exit(f"{step} failed")
