#!/usr/bin/env python3
"""Everything the deploy does, in order: images -> rule shards -> site pages.

    python3 tools/build_all.py         full site in builds/site/  (then: python3 -m http.server -d builds/site)
    python3 tools/build_all.py --dev   only the /<slug>/ pages next to index.html, for a local server that
                                       serves this folder itself (e.g. Apache at /for-fun/chat-learning/)
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
site_args = ["--dev"] if "--dev" in sys.argv[1:] else []
for step, args in (("tools/make_images.py", []), ("tools/make_shard.py", []), ("tools/make_site.py", site_args)):
    print(f"== {step} {' '.join(args)}".rstrip())
    if subprocess.run([sys.executable, str(ROOT / step), *args], cwd=ROOT).returncode:
        sys.exit(f"{step} failed")
