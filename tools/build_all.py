#!/usr/bin/env python3
"""The Python half of the build, in order: images -> scene pictures (build/img/).

    python3 tools/build_all.py         then: npm run build (the pages, pre-rendered by React Router into build/client/,
                                       which also copies build/img/ in at the same addresses)
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for step, args in (("tools/make_images.py", []), ("tools/make_scenes.py", [])):
    print(f"== {step} {' '.join(args)}".rstrip())
    if subprocess.run([sys.executable, str(ROOT / step), *args], cwd=ROOT).returncode:
        sys.exit(f"{step} failed")
