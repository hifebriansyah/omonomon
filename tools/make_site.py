#!/usr/bin/env python3
"""Build the deployable site in builds/site/ (no dependencies).

GitHub Pages cannot route, so every address gets its own real HTML file, made from index.html:

    /                  home
    /<slug>/           each character on stage
    /<slug>/history/   each character's history panel (noindex)
    404.html, sitemap.xml, robots.txt

Each page has its own title, description, canonical link, share tags and structured data, and the
character links are already in the HTML, so search engines and link previews see real content.
The text rules mirror headFor() in assets/scripts/router.js: change one, change the other.

Run after tools/make_images.py and tools/make_shard.py (tools/build_all.py runs all three).
Test locally:  python3 tools/make_site.py && python3 -m http.server -d builds/site
Server that serves this folder itself (Apache...):  python3 tools/make_site.py --dev
"""
import json
import shutil
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "builds" / "site"
COPY_FILES = ["style.css", "config.js", "characters.json", "site.json", "manifest.webmanifest"]


def attr(s):
    return escape(s, quote=True)


def head_for(site, c, history):
    """Title, description, canonical address, share image and robots for one page (c=None: home)."""
    if c is None:
        return dict(title=site["title"], description=site["description"], url=f"{site['url']}/",
                    image=f"{site['url']}/builds/img/share/home.jpg", robots="index, follow")
    stage_url = f"{site['url']}/{c['slug']}/"
    image = f"{site['url']}/builds/img/share/{c['id']}.jpg"
    if history:
        return dict(title=f"Chat history with {c['name']} | {site['name']}",
                    description=f"Your saved chat with {c['name']}. It stays on this device.",
                    url=f"{stage_url}history/", image=image, robots="noindex, follow")
    return dict(title=f"{c['name']}, {c['seo']['tagline']} | {site['name']}",
                description=c["seo"]["description"].replace("{name}", c["name"]),
                url=stage_url, image=image, robots="index, follow")


def structured_data(site, c, history):
    if history:
        return None
    website = {"@type": "WebSite", "@id": f"{site['url']}/#website", "name": site["name"], "url": f"{site['url']}/",
               "description": site["description"], "inLanguage": ["en", "id"]}
    if c is None:
        graph = [website]
    else:
        page_url = f"{site['url']}/{c['slug']}/"
        graph = [
            website,
            {"@type": "WebPage", "@id": f"{page_url}#page", "url": page_url, "name": head_for(site, c, False)["title"],
             "description": head_for(site, c, False)["description"], "isPartOf": {"@id": f"{site['url']}/#website"},
             "primaryImageOfPage": {"@type": "ImageObject", "url": f"{site['url']}/builds/img/share/{c['id']}.jpg"}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": site["name"], "item": f"{site['url']}/"},
                {"@type": "ListItem", "position": 2, "name": c["name"], "item": page_url}]},
        ]
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False)
    return data.replace("</", "<\\/")  # never let the data close the script tag


def head_tags(site, h, ld):
    tags = [
        f'<title>{escape(h["title"])}</title>',
        f'<meta name="description" content="{attr(h["description"])}">',
        f'<meta name="robots" content="{h["robots"]}">',
        f'<link rel="canonical" href="{attr(h["url"])}">',
        f'<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{attr(site["name"])}">',
        f'<meta property="og:title" content="{attr(h["title"])}">',
        f'<meta property="og:description" content="{attr(h["description"])}">',
        f'<meta property="og:url" content="{attr(h["url"])}">',
        f'<meta property="og:image" content="{attr(h["image"])}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{attr(h["title"])}">',
        f'<meta name="twitter:description" content="{attr(h["description"])}">',
        f'<meta name="twitter:image" content="{attr(h["image"])}">',
    ]
    if ld:
        tags.append(f'<script type="application/ld+json">{ld}</script>')
    return "\n  ".join(tags)


def picker_links(characters, current):
    out = []
    for c in characters:
        cur = ' aria-current="page"' if c is current else ""
        out.append(f'<a href="{c["slug"]}/" data-id="{c["id"]}"{cur}><img src="{attr(c["image"])}" alt="">{escape(c["name"])}</a>')
    return "".join(out)


def render(template, site, characters, c, history, depth):
    """One page. `depth` is how many folders down it lives, which sets <base href>."""
    h = head_for(site, c, history)
    shown = c or characters[0]  # home shows the default character until the script restores the last one
    page = template

    def put(old, new):  # a missing marker means index.html changed: fail loudly instead of shipping a bare page
        nonlocal page
        if old not in page:
            raise SystemExit(f"make_site.py: not found in index.html: {old[:60]!r}")
        page = page.replace(old, new, 1)

    put('<base href="./">', f'<base href="{"../" * depth or "./"}">')
    put("<title>Omon Omon</title>\n  <!-- @head -->", head_tags(site, h, structured_data(site, c, history)))
    put("<!-- @picker -->", picker_links(characters, shown))
    put('<h1 id="name">&nbsp;</h1>', f'<h1 id="name">{escape(shown["name"])}</h1>')
    put('<p id="status">&nbsp;</p>', f'<p id="status">{escape(shown["status"])}</p>')
    put('<p id="about" class="sr-only"></p>', f'<p id="about" class="sr-only">{escape(h["description"])}</p>')
    put('<img id="hero" class="hero" alt="">',
        f'<img id="hero" class="hero" src="{attr(shown["stage"])}" alt="{attr(shown["name"])}">')
    if history:
        put('<aside id="history" class="history" hidden>', '<aside id="history" class="history">')
        put('aria-expanded="false" aria-controls="history"\n              aria-label="Show chat history" title="Show chat history"',
            'aria-expanded="true" aria-controls="history"\n              aria-label="Close chat history" title="Close chat history"')
    return page, h


def not_found(site):
    """404.html: GitHub Pages serves it with a real 404 status for any unknown address."""
    base = "/" + site["url"].split("//", 1)[1].partition("/")[2]
    base = base if base.endswith("/") else base + "/"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="{base}">
  <title>Page not found | {escape(site["name"])}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="builds/img/favicon.ico" sizes="48x48">
  <meta name="theme-color" content="{site["themeColor"]}">
  <style>
    body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: {site["themeColor"]}; color: #f1f3f8; font: 1.1rem/1.5 system-ui, sans-serif; text-align: center; padding: 24px; }}
    a {{ color: #c9b3ee; }}
  </style>
</head>
<body>
  <main>
    <h1>Nobody lives here</h1>
    <p>This page does not exist. <a href="./">Go back to {escape(site["name"])}</a> and pick a ghost to chat with.</p>
  </main>
</body>
</html>
"""


def make_dev_pages():
    """For a server that serves this folder itself (e.g. Apache at /for-fun/chat-learning/): write only
    the /<slug>/ and /<slug>/history/ pages next to index.html, so a refresh on those addresses works.
    Each folder holds a .gitignore of `*`, so nothing here is committed."""
    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    characters = json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))["characters"]
    template = (ROOT / "index.html").read_text(encoding="utf-8")
    for c in characters:
        folder = ROOT / c["slug"]
        if folder.exists():
            shutil.rmtree(folder)
        (folder / "history").mkdir(parents=True)
        (folder / ".gitignore").write_text("*\n", encoding="utf-8")
        (folder / "index.html").write_text(render(template, site, characters, c, False, 1)[0], encoding="utf-8")
        (folder / "history" / "index.html").write_text(render(template, site, characters, c, True, 2)[0], encoding="utf-8")
    print(f"ok dev pages: {', '.join(c['slug'] + '/' for c in characters)} next to index.html")


def main():
    if "--dev" in sys.argv:
        return make_dev_pages()
    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    data = json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))
    characters = data["characters"]
    template = (ROOT / "index.html").read_text(encoding="utf-8")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for name in COPY_FILES:
        shutil.copy2(ROOT / name, OUT / name)
    (OUT / "assets").mkdir()
    shutil.copytree(ROOT / "assets" / "scripts", OUT / "assets" / "scripts")
    if (ROOT / "builds").exists():
        shutil.copytree(ROOT / "builds", OUT / "builds", ignore=shutil.ignore_patterns("site"))  # images and data, not this folder itself

    pages = [(OUT / "index.html", None, False, 0)]
    for c in characters:
        pages.append((OUT / c["slug"] / "index.html", c, False, 1))
        pages.append((OUT / c["slug"] / "history" / "index.html", c, True, 2))
    for path, c, history, depth in pages:
        path.parent.mkdir(parents=True, exist_ok=True)
        html, _ = render(template, site, characters, c, history, depth)
        path.write_text(html, encoding="utf-8")

    (OUT / "404.html").write_text(not_found(site), encoding="utf-8")
    urls = [f"{site['url']}/"] + [f"{site['url']}/{c['slug']}/" for c in characters]
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{escape(u)}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {site['url']}/sitemap.xml\n", encoding="utf-8")
    print(f"ok site: {len(pages)} pages + 404.html, sitemap.xml, robots.txt in {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
