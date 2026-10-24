#!/usr/bin/env python3
"""Build the deployable site in builds/site/ (no dependencies).

GitHub Pages cannot route, so every address gets its own real HTML file:

    /                  the chat list: the four ghosts (shell.html)
    /<slug>/           each character's chat (chat.html)
    /<slug>/history/   each character's history panel, noindex (chat.html)
    /games/, /games/<slug>/   the game hub and each ready game (shell.html, games.json)
    /me/               profile and progress, noindex (shell.html)
    /privacy/          the privacy page (privacy.html)
    404.html, sitemap.xml, robots.txt

Each page has its own title, description, canonical link, share tags and structured data, and the
character links are already in the HTML, so search engines and link previews see real content.
The text rules mirror headFor() in assets/scripts/router.js: change one, change the other.

Run after tools/make_images.py, tools/make_scenes.py and tools/make_shard.py (tools/build_all.py runs all of them).
Test locally:  python3 tools/make_site.py && python3 -m http.server -d builds/site
Apache serving this folder: the repo's .htaccess maps the addresses to builds/site/.
"""
import hashlib
import json
import re
import shutil
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "builds" / "site"
SHARE_SIZE = 1080     # every link preview is the square scene picture from tools/make_scenes.py
SHARE_DEFAULT = "1"   # the picture (builds/img/scenes/1_1/1.jpg) for pages that are not one character's


def share_image(site, char_id=SHARE_DEFAULT):
    """Link-preview picture of a character on the 1:1 scene."""
    return f"{site['url']}/builds/img/scenes/1_1/{char_id}.jpg"


COPY_FILES = ["style.css", "app.css", "config.js", "characters.json", "site.json", "games.json", "stories.json", "manifest.webmanifest"]


def attr(s):
    return escape(s, quote=True)


def head_for(site, c, history):
    """Title, description, canonical address, share image and robots for one page (c=None: home)."""
    if c is None:
        return dict(title=site["title"], description=site["description"], url=f"{site['url']}/",
                    image=share_image(site), robots="index, follow")
    stage_url = f"{site['url']}/{c['slug']}/"
    image = share_image(site, c["id"])
    if history:
        return dict(title=f"Chat history with {c['name']} | {site['name']}",
                    description=f"Your saved chat with {c['name']}.",
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
             "primaryImageOfPage": {"@type": "ImageObject", "url": share_image(site, c["id"])}},
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
        f'<meta property="og:image:width" content="{SHARE_SIZE}">',
        f'<meta property="og:image:height" content="{SHARE_SIZE}">',
        f'<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{attr(h["title"])}">',
        f'<meta name="twitter:description" content="{attr(h["description"])}">',
        f'<meta name="twitter:image" content="{attr(h["image"])}">',
    ]
    if ld:
        tags.append(f'<script type="application/ld+json">{ld}</script>')
    return "\n  ".join(tags)


def render(template, site, characters, c, history, depth):
    """One page. `depth` is how many folders down it lives, which sets <base href>."""
    h = head_for(site, c, history)
    shown = c
    page = template

    def put(old, new):  # a missing marker means chat.html changed: fail loudly instead of shipping a bare page
        nonlocal page
        if old not in page:
            raise SystemExit(f"make_site.py: not found in chat.html: {old[:60]!r}")
        page = page.replace(old, new, 1)

    put('<base href="./">', f'<base href="{"../" * depth or "./"}">')
    put("<title>Omon Omon</title>\n  <!-- @head -->", head_tags(site, h, structured_data(site, c, history)))
    put('<img id="headAvatar" class="head-avatar" alt="">', f'<img id="headAvatar" class="head-avatar" src="{attr(shown["image"])}" alt="">')
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


def privacy_page(site):
    """/privacy/: what is stored, who processes it, how to delete it. Needed for Google sign-in too."""
    from datetime import date
    page = (ROOT / "privacy.html").read_text(encoding="utf-8")
    email = site.get("contactEmail", "").strip()
    if email:
        contact = f'    <h2>Contact</h2>\n    <p>Questions or requests: <a href="mailto:{attr(email)}">{escape(email)}</a>.</p>\n'
    else:
        contact = ""
        print('WARNING: site.json has no "contactEmail", so the privacy page has no way to contact you (Google asks for one)')
    values = {"name": escape(site["name"]), "url": site["url"], "themeColor": site["themeColor"],
              "updated": date.today().isoformat(), "contact": contact}
    for key, value in values.items():
        page = page.replace("{{" + key + "}}", value)
    return page


ICONS = {  # Lucide icons (ISC License)
    "chats": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    "games": '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
    "whispers": '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    "me": '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    "back": '<path d="m15 18-6-6 6-6"/>',
    "more": '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
    "flame": '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    "ghost": '<path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
}


def icon(name):
    return f'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[name]}</svg>'


def tabbar(active):
    """The bottom navigation of the app pages: Chats, Games, Me."""
    tabs = [("chats", "./", "Chats", "tabChats"), ("whispers", "whispers/", "Whispers", "tabWhispers"),
            ("games", "games/", "Games", "tabGames"), ("me", "me/", "Me", "tabMe")]
    links = ""
    for key, href, label, tkey in tabs:
        cur = ' aria-current="page"' if key == active else ""
        links += f'<a class="tab" href="{href}" data-tab="{key}"{cur}>{icon(key)}<span data-t="{tkey}">{label}</span></a>'
    return f'  <nav class="tabbar" aria-label="Main"><div class="tabbar-in">{links}</div></nav>\n'


def play_area(g, c):
    """The playing area of a game page: a canvas for the runner, four petals for the memory game."""
    if g.get("type") == "memory":
        petals = "".join(f'<button type="button" class="petal p{i}" data-i="{i}" aria-label="Petal {i + 1}"></button>' for i in range(4))
        return (f'        <img class="memory-ghost" src="{attr(c["stage"])}" alt="">\n'
                '        <p class="m-status" id="mStatus" aria-live="polite"></p>\n'
                f'        <div class="petals" id="petals" role="group" aria-label="{attr(g["title"])}">{petals}</div>\n'
                '        <p class="sighs" id="sighs" aria-live="polite"></p>\n'
                '        <button type="button" class="m-start" id="mStart">Begin</button>')
    if g.get("type") == "rounds":
        rooms = "".join(f'<button type="button" class="room" data-i="{i}" aria-label="Room {i + 1}"><span class="room-num">{i + 1}</span><span class="room-bar"><i></i></span></button>' for i in range(6))
        return (f'        <img class="memory-ghost" src="{attr(c["stage"])}" alt="">\n'
                '        <p class="m-status" id="mStatus" aria-live="polite"></p>\n'
                f'        <div class="rooms" id="rooms" role="group" aria-label="{attr(g["title"])}">{rooms}</div>\n'
                '        <p class="sighs" id="sighs" aria-live="polite"></p>\n'
                '        <button type="button" class="m-start" id="mStart">Begin</button>')
    if g.get("type") == "module":  # a game that builds its own markup (assets/scripts/games/<module>.js)
        return '        <div class="module-root" id="moduleRoot"></div>'
    return f'        <canvas id="game" tabindex="0" role="img" aria-label="{attr(g["title"])} game"></canvas>'


def shell_pages(site, characters, games):
    """The app pages made from shell.html: / (chat list), /me/, /games/ and /games/<slug>/ for every game that is
    ready. Games still marked "ready": false are listed on the hub but get no page of their own (no empty pages
    for search engines). Returns [(folder relative to the site, html, public url, in_sitemap)]."""
    template = (ROOT / "shell.html").read_text(encoding="utf-8")
    by_id = {c["id"]: c for c in characters}
    hub = games["hub"]

    def fill(kind, depth, h, content, ld, active=None, game=None):
        page = template
        page = page.replace('<base href="./">', f'<base href="{"../" * depth or "./"}">')
        page = page.replace("<!-- @head -->", head_tags(site, h, ld))
        page = page.replace("<!-- @content -->", content)
        page = page.replace("<!-- @tabbar -->", tabbar(active) if active else "")
        values = {"themeColor": site["themeColor"], "page": kind, "game": game["slug"] if game else "",
                  "char": game["character"] if game else "", "bodyClass": "" if active else ' class="no-tabs"'}
        for key, value in values.items():
            page = page.replace("{{" + key + "}}", value)
        return page

    def bar(title, extra="", key=None):  # key: the text.js entry that translates the title (none: it stays as written)
        t = f' data-t="{key}"' if key else ""
        return f'    <header class="app-bar"><h1{t}>{escape(title)}</h1>{extra}</header>\n'

    out = []

    # / : the chat list
    rows = []
    for c in characters:
        rows.append(
            f'      <li class="row" data-id="{c["id"]}" style="--c:{c["accent"]}">'
            f'<a class="contact" href="{c["slug"]}/" data-id="{c["id"]}" data-slug="{c["slug"]}">'
            f'<img class="avatar" src="{attr(c["image"])}" alt=""><span class="contact-main">'
            f'<span class="contact-top"><span class="c-title"><strong class="c-name">{escape(c["name"])}</strong>'
            f'<span class="c-status">{escape(c["status"])}</span></span><time class="c-time"></time></span>'
            f'<span class="c-preview"></span></span></a>'
            f'<button class="more" type="button" aria-haspopup="menu" aria-expanded="false" data-t-label="moreOptions" '
            f'aria-label="More options" title="More options">{icon("more")}</button></li>')
    home_content = (bar(site["name"]) + f'    <p class="intro" data-t="homeIntro">{escape(site["description"])}</p>\n'
                    + '    <ul class="contacts">\n' + "\n".join(rows) + "\n    </ul>"
                    + '\n    <p class="legal"><a href="privacy/" data-t="mePrivacy">Privacy</a></p>')
    home_h = head_for(site, None, False)
    out.append(("", fill("home", 0, home_h, home_content, structured_data(site, None, False), "chats"), home_h["url"], True))

    # /me/ : profile and progress (private page: not indexed, not in the sitemap)
    bonds = "".join(
        f'<li data-char="{c["id"]}" style="--c:{c["accent"]}"><img src="{attr(c["image"])}" alt="">'
        f'<span class="who">{escape(c["name"])} <small>&middot; <span data-level>1</span> <span data-title></span></small><span class="bar"></span></span></li>'
        for c in characters)
    me_content = (bar("Me", "", "tabMe") + f"""    <section class="me">
      <div class="profile"><span class="ph" id="profPhoto">{icon("ghost")}</span>
        <div class="who-am-i"><strong id="profName" data-t="meGuest">Guest</strong><p id="profNote" data-t="meNote">Your progress is saved in this browser.</p>
        <button class="signin" id="signinOff" type="button" disabled data-t="meSignIn">Sign in with Google (coming soon)</button>
        <div id="gsi" hidden></div><div id="turnstile"></div><p class="err" id="acctErr" role="alert" hidden></p>
        <div class="acct" id="acct" hidden><button type="button" id="signOutBtn" data-t="meSignOut">Sign out</button>
        <button type="button" id="deleteBtn" class="danger" data-t="meDelete">Delete account</button></div></div></div>
      <div class="stats"><div class="stat"><b id="meCandles">0</b><span data-t="meCandles">Candles</span></div>
        <div class="stat"><b id="mePlayed">0</b><span data-t="mePlayed">Games played</span></div></div>
      <p class="streak-me">{icon("flame")}<span id="meStreak"></span></p>
      <h2 data-t="meLanguage">Language</h2>
      <div class="langs" id="langSwitch" role="group" aria-label="Language"><button type="button" data-lang="en" aria-pressed="false">English</button><button type="button" data-lang="id" aria-pressed="false">Indonesia</button></div>
      <h2 data-t="me3d">3D scenes</h2>
      <p class="toggle3d"><label><input type="checkbox" id="me3d"> <span data-t="me3dLabel">Show the 3D backdrop in chats</span></label></p>
      <h2 data-t="meNotify">Notifications</h2>
      <p class="toggle3d"><label><input type="checkbox" id="meNotify"> <span data-t="meNotifyLabel">Tell me when a ghost whispers, and before my streak ends</span></label></p>
      <p class="nick-note" id="notifyNote"></p>
      <h2 data-t="meNickname">Nickname</h2>
      <form class="nick" id="nickForm" autocomplete="off"><input id="meNick" type="text" maxlength="24" aria-labelledby="nickLabel">
        <button type="submit" data-t="meSave">Save</button><button type="button" id="nickRandom" data-t="meRandom">Random</button></form>
      <p class="nick-note" id="nickNote" data-t="meNickNote">Shown next to your comments on whispers.</p>
      <h2 data-t="meBonds">Bonds</h2>
      <ul class="bonds">{bonds}</ul>
      <h2 data-t="shopTitle">Candle shop</h2>
      <section class="shop" id="shop"><p class="shop-balance" id="shopBalance" aria-live="polite"></p><p class="shop-msg" id="shopMsg" role="status"></p><div id="shopList"></div>
        <p class="nick-note" data-t="shopGhostStage">Each ghost also gets her own stage look at bond level 5, and her ribbon frame at level 8.</p></section>
      <h2 data-t="meBadges">Badges</h2>
      <ul class="badges" id="badgeList"></ul>
      <h2 data-t="meStories">Stories</h2>
      <div class="stories" id="storyList"></div>
      <ul class="links"><li><a href="room/" data-t="meRoom">My Ghost Room</a></li><li><a href="loved/"><span data-t="meLoved">Loved whispers</span> <span class="loved-count" id="meLovedCount"></span></a></li><li><a href="privacy/" data-t="mePrivacy">Privacy</a></li></ul>
    </section>""")
    me_h = dict(title=f"Me | {site['name']}", description=f"Your profile and progress in {site['name']}.",
                url=f"{site['url']}/me/", image=share_image(site), robots="noindex, follow")
    out.append(("me", fill("me", 1, me_h, me_content, None, "me"), me_h["url"], False))

    # /whispers/ : the ghosts' latest public updates (written on a timer, filled in by the script: not indexed)
    wh_content = (bar("Whispers", "", "tabWhispers") + '    <section class="whispers-page">\n      <p class="intro" data-t="whispersIntro">Little updates the ghosts post when the mood strikes.</p>\n'
                  + '      <ul class="whispers" id="whisperList"></ul>\n      <p class="whisper-note" id="whisperNote" hidden></p>\n    </section>')
    wh_h = dict(title=f"Whispers | {site['name']}", description="Little updates the ghosts of Omon Omon post when the mood strikes.",
                url=f"{site['url']}/whispers/", image=share_image(site), robots="noindex, follow")
    out.append(("whispers", fill("whispers", 1, wh_h, wh_content, None, "whispers"), wh_h["url"], False))
    # /whispers/<slug>/ : the same page, with that ghost's share picture. A shared whisper links here (?n=<id>), because link
    # previews read the static tags and never see which ghost the script shows.
    for c in characters:
        h = dict(wh_h, title=f"{c['name']}'s whispers | {site['name']}", url=f"{site['url']}/whispers/{c['slug']}/",
                 description=f"Little updates {c['name']} posts when the mood strikes.", image=share_image(site, c["id"]))
        out.append((f"whispers/{c['slug']}", fill("whispers", 2, h, wh_content, None, "whispers"), h["url"], False))

    # /loved/ : the whispers this visitor loved (kept in their browser: not indexed, reached from Me)
    back_me = f'<a class="back-btn" href="me/" data-t-label="backMe" aria-label="Back" title="Back">{icon("back")}</a>'
    loved_content = (f'    <header class="app-bar">{back_me}<h1 data-t="lovedTitle">Loved whispers</h1></header>\n'
                     + '    <section class="whispers-page">\n      <ul class="whispers" id="lovedList"></ul>\n      <p class="whisper-note" id="lovedNote" hidden></p>\n    </section>')
    loved_h = dict(title=f"Loved whispers | {site['name']}", description="Whispers you loved, kept on this device.",
                   url=f"{site['url']}/loved/", image=share_image(site), robots="noindex, follow")
    out.append(("loved", fill("loved", 1, loved_h, loved_content, None, "me"), loved_h["url"], False))

    # /room/ : the Ghost Room (3D, with a 2D fallback). A friend's room opens from a link that carries the furniture in its #hash.
    room_content = (f'    <header class="app-bar">{back_me}<h1 data-t="roomTitle">Ghost Room</h1><button type="button" class="room-share" id="roomShare" data-t="roomShare">Share my room</button></header>\n'
                    + '    <section class="room-page"><div class="room-root" id="roomRoot"></div><p class="room-note" id="roomNote" role="status"></p></section>')
    room_h = dict(title=f"Ghost Room | {site['name']}", description="Your own little ghost room, decorated with what you bought with Candles.",
                  url=f"{site['url']}/room/", image=share_image(site), robots="noindex, follow")
    out.append(("room", fill("room", 1, room_h, room_content, None, "me"), room_h["url"], False))

    # /games/ : the hub
    cards = []
    for g in games["games"]:
        c = by_id[g["character"]]
        desc = escape(g["description"].replace("{name}", c["name"]))
        inner = (f'<img src="{attr(c["image"])}" alt=""><span class="card-text"><h2>{escape(g["title"])}</h2>'
                 f'<span class="tagline">{escape(g["tagline"])}</span><span class="desc">{desc}</span></span>')
        meta = '<span class="bond" data-bond></span><span class="best" data-best></span>'
        if g["ready"]:
            extra = (' data-quick="1"' if g.get("quick") else "") + (f' data-added="{g["added"]}"' if g.get("added") else "")
            cards.append(f'      <li class="card" data-game="{g["slug"]}" data-char="{c["id"]}"{extra} style="--accent:{c["accent"]}"><a href="games/{g["slug"]}/">{inner}</a>'
                         f'<div class="meta">{meta}</div></li>')
        else:
            cards.append(f'      <li class="card soon" data-game="{g["slug"]}" data-char="{c["id"]}"><div class="card-body">{inner}</div>'
                         f'<div class="meta"><span class="soon-tag">Coming soon</span></div></li>')
    lb_tabs = "".join(f'<button type="button" data-game="{g["slug"]}" aria-pressed="false">{escape(g["title"])}</button>' for g in games["games"] if g["ready"])
    leaderboard = ('      <section class="leaderboard" id="leaderboard" aria-labelledby="lbHead" hidden><h2 id="lbHead" data-t="lbTitle">This week\'s best</h2>'
                   f'<div class="lb-tabs" id="lbTabs" role="group">{lb_tabs}</div><ol id="lbList"></ol><p class="lb-me" id="lbMe" aria-live="polite"></p>'
                   '<p class="lb-note" data-t="lbResets">Starts again every Monday.</p></section>\n')
    hub_content = (bar(hub["heading"], '<p class="wallet" id="wallet" aria-live="polite"></p>')
                   + f'    <section class="hub">\n      <p class="intro">{escape(hub["intro"])}</p>\n'
                   + f'      <section class="quests" aria-labelledby="questsTitle"><div class="quests-head"><h2 id="questsTitle" data-t="questsTitle">Today\'s quests</h2>'
                   + f'<p class="streak" id="streak">{icon("flame")}<span id="streakText"></span></p></div><ul id="questList"></ul></section>\n'
                   + '      <section class="event" id="eventBanner" hidden><img src="" alt=""><div><strong data-event-title></strong><p data-event-body></p></div><span class="event-count" data-event-count></span></section>\n'
                   + '      <div class="hub-tools"><a class="continue" id="continueBtn" href="#" hidden></a><div class="filters" id="gameFilters" role="group" aria-label="Filter games"></div></div>\n'
                   + leaderboard
                   + '      <ul class="cards">\n' + "\n".join(cards) + "\n      </ul>\n    </section>")
    hub_h = dict(title=hub["title"], description=hub["description"], url=f"{site['url']}/games/",
                 image=share_image(site), robots="index, follow")
    out.append(("games", fill("hub", 1, hub_h, hub_content, structured_data(site, None, False), "games"), hub_h["url"], True))

    # /games/<slug>/ : one game (no tab bar: like opening a chat)
    for g in games["games"]:
        if not g["ready"]:
            continue
        c = by_id[g["character"]]
        desc = g["description"].replace("{name}", c["name"])
        url = f"{site['url']}/games/{g['slug']}/"
        h = dict(title=f"{g['title']} with {c['name']} | {site['name']}", description=desc, url=url,
                 image=share_image(site, c["id"]), robots="index, follow")
        back = (f'<a class="back-btn" href="games/" data-t-label="backGames" aria-label="Back to games" title="Back to games">{icon("back")}</a>')
        content = (f'    <header class="app-bar">{back}<h1>{escape(g["title"])}</h1><p class="wallet" id="wallet" aria-live="polite"></p></header>\n'
                   f'    <section class="game">\n      <p class="intro">{escape(desc)}</p>\n'
                   f'      <div class="play{" memory" if g.get("type") in ("memory", "rounds") else ""}{" rounds" if g.get("type") == "rounds" else ""}{" module" if g.get("type") == "module" else ""}">\n{play_area(g, c)}\n'
                   f'        <div id="result" class="result" hidden>\n          <h2 id="rTitle"></h2>\n          <p id="rScore"></p>\n'
                   f'          <p id="rReward"></p>\n          <p id="rQuests" class="quests-done"></p>\n          <p id="rSay" class="say"></p>\n          <div class="actions">\n'
                   f'            <button id="rAgain" type="button">Play again</button>\n'
                   f'            <a id="rChat" href="{c["slug"]}/">Chat</a>\n          </div>\n        </div>\n      </div>\n'
                   f'      <p class="how" id="how">{escape(g["how"]["en"])}</p>\n'
                   f'      <noscript><p>This game needs JavaScript.</p></noscript>\n    </section>')
        ld = json.dumps({"@context": "https://schema.org", "@type": "VideoGame", "name": g["title"], "description": desc,
                         "url": url, "applicationCategory": "Game", "genre": "Arcade", "playMode": "SinglePlayer",
                         "inLanguage": ["en", "id"], "image": h["image"],
                         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}, ensure_ascii=False).replace("</", "<\\/")
        out.append((f"games/{g['slug']}", fill("game", 2, h, content, ld, None, g), url, True))
    return out


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


def check_sitemap(urls, site):
    """Every public page (not marked noindex) must be listed in sitemap.xml. When you add a page, add its
    address to `urls` in main(); this check fails the build if you forget."""
    import re
    missing = []
    for page in sorted(OUT.rglob("index.html")):
        html = page.read_text(encoding="utf-8")
        if re.search(r'<meta name="robots" content="[^"]*noindex', html):
            continue
        rel = page.relative_to(OUT).parent.as_posix()
        url = f"{site['url']}/" if rel == "." else f"{site['url']}/{rel}/"
        if url not in urls:
            missing.append(url)
    if missing:
        raise SystemExit("make_site.py: public pages missing from the sitemap (add them to `urls` in main()): " + ", ".join(missing))


VERSIONED = ("style.css", "app.css", "config.js")  # besides every script in assets/scripts/ and every JSON data file


def stamp_versions(out):
    """Cache busting: add ?v=<hash of the scripts, styles and data> to every address of a script, style or JSON file in the
    built site (page tags, import lines, fetch calls). A deploy that changes any of them gets new addresses, so browsers, the
    installed app and Cloudflare's cache all fetch the new files at once; a deploy that changes none keeps the cache.
    One version for the whole site keeps it simple: a module imported under two addresses would run twice."""
    files = sorted([*(out / "assets" / "scripts").rglob("*.js"), *(out / n for n in VERSIONED), *out.glob("*.json"),
                    *(out / "builds" / "data").glob("*.json")])
    digest = hashlib.sha256()
    for f in files:
        digest.update(f.relative_to(out).as_posix().encode() + b"\0" + f.read_bytes())
    v = digest.hexdigest()[:10]

    def json_ref(m):  # "characters.json" -> "characters.json?v=..." (only files that exist in the site)
        return f"{m[1]}{m[2]}?v={v}{m[1]}" if (out / m[2]).is_file() else m[0]

    for f in (out / "assets" / "scripts").rglob("*.js"):
        js = f.read_text(encoding="utf-8")
        js = re.sub(r"""((?:\bfrom|\bimport)\s*\(?\s*)(["'])(\.{1,2}/[^"'?]+\.js)\2""", rf"\1\2\3?v={v}\2", js)
        js = re.sub(r"""(["'`])([\w./-]+\.json)\1""", json_ref, js)
        f.write_text(js, encoding="utf-8")
    assets = "|".join(re.escape(n) for n in VERSIONED)
    for f in out.rglob("*.html"):
        html = f.read_text(encoding="utf-8")
        html = re.sub(rf"""((?:href|src)=")((?:assets/scripts/[^"?]+\.js)|{assets})(")""", rf"\1\2?v={v}\3", html)
        f.write_text(html, encoding="utf-8")
    return v


def load_games():
    """games.json plus every games.d/<slug>.json (one game object each, added after the ones in games.json)."""
    games = json.loads((ROOT / "games.json").read_text(encoding="utf-8"))
    folder = ROOT / "games.d"
    if folder.is_dir():
        for f in sorted(folder.glob("*.json")):
            games["games"].append(json.loads(f.read_text(encoding="utf-8")))
    return games


def write_service_worker(out, version):
    """sw.js: the offline shell. It saves every page, script, style and data file of this build when it installs."""
    urls = ["./"]
    for f in sorted(out.rglob("index.html")):
        folder = f.parent.relative_to(out).as_posix()
        if folder != ".":
            urls.append(folder + "/")
    for f in sorted(out.rglob("*")):
        rel = f.relative_to(out).as_posix()
        if not f.is_file() or rel.startswith("builds/") or rel in ("sw.js", "404.html", "robots.txt", "sitemap.xml"):
            continue
        if rel.endswith((".js", ".css", ".json")):
            urls.append(f"{rel}?v={version}")
    cfg = (ROOT / "config.js").read_text(encoding="utf-8")
    api = re.search(r'API_URL:\s*"([^"]*)"', cfg)
    text = ((ROOT / "sw.js").read_text(encoding="utf-8").replace("__VERSION__", version).replace("__PRECACHE__", json.dumps(urls))
            .replace("__API_URL__", api.group(1) if api else ""))
    (out / "sw.js").write_text(text, encoding="utf-8")


def main():
    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    data = json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))
    characters = data["characters"]
    template = (ROOT / "chat.html").read_text(encoding="utf-8")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for name in COPY_FILES:
        shutil.copy2(ROOT / name, OUT / name)
    (OUT / "assets").mkdir()
    shutil.copytree(ROOT / "assets" / "scripts", OUT / "assets" / "scripts")
    if (ROOT / "assets" / "vendor").exists():
        shutil.copytree(ROOT / "assets" / "vendor", OUT / "assets" / "vendor")  # pinned third-party code (three.js), loaded only by the 3D pages
    if (ROOT / "builds").exists():
        shutil.copytree(ROOT / "builds", OUT / "builds", ignore=shutil.ignore_patterns("site"))  # images and data, not this folder itself

    pages = []
    for c in characters:
        pages.append((OUT / c["slug"] / "index.html", c, False, 1))
        pages.append((OUT / c["slug"] / "history" / "index.html", c, True, 2))
    for path, c, history, depth in pages:
        path.parent.mkdir(parents=True, exist_ok=True)
        html, _ = render(template, site, characters, c, history, depth)
        path.write_text(html, encoding="utf-8")

    games = load_games()
    (OUT / "games.json").write_text(json.dumps(games, ensure_ascii=False, indent=2), encoding="utf-8")  # the merged list the pages fetch
    app_urls = []
    app_pages = shell_pages(site, characters, games)
    for folder, html, url, listed in app_pages:
        (OUT / folder).mkdir(parents=True, exist_ok=True)
        (OUT / folder / "index.html").write_text(html, encoding="utf-8")
        if listed:
            app_urls.append(url)
    (OUT / "privacy").mkdir()
    (OUT / "privacy" / "index.html").write_text(privacy_page(site), encoding="utf-8")
    (OUT / "404.html").write_text(not_found(site), encoding="utf-8")
    urls = app_urls + [f"{site['url']}/{c['slug']}/" for c in characters] + [f"{site['url']}/privacy/"]
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{escape(u)}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    check_sitemap(urls, site)
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {site['url']}/sitemap.xml\n", encoding="utf-8")
    version = stamp_versions(OUT)
    write_service_worker(OUT, version)
    print(f"ok site: {len(pages) + len(app_pages)} pages + 404.html, sitemap.xml, robots.txt in {OUT.relative_to(ROOT)}/ (assets ?v={version})")


if __name__ == "__main__":
    main()
