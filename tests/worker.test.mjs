// Pure functions of the API Worker. Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { cleanProgress, mergeProgress, weekStart, sameSecret, parseFeed, parsePubDate, linkKey, titleKey, fitsWhisper } from "../worker/api.js";

test("weekStart is the Monday of the week (UTC)", () => {
  assert.equal(weekStart(Date.UTC(2026, 9, 25)), "2026-10-19"); // a Sunday
  assert.equal(weekStart(Date.UTC(2026, 9, 26)), "2026-10-26"); // a Monday
  assert.equal(weekStart(Date.UTC(2026, 9, 19, 23, 59)), "2026-10-19");
});

test("sameSecret", () => {
  assert.equal(sameSecret("abc", "abc"), true);
  assert.equal(sameSecret("abc", "abd"), false);
  assert.equal(sameSecret("abc", "ab"), false);
  assert.equal(sameSecret("", ""), false);
  assert.equal(sameSecret(undefined, "x"), false);
});

test("cleanProgress drops what the game never writes", () => {
  const p = cleanProgress({ candles: -5, plays: 3.7, spent: 2e9, bond: { 1: 50, bad: 9 }, best: { "hop-hop": 10, "BAD KEY": 1 }, badges: ["a-b", "NO!", "a-b"], owned: ["stage-stars"], equipped: { stage: "stage-stars", bubble: "<x>" } });
  assert.equal(p.candles, 0);
  assert.equal(p.plays, 3);
  assert.equal(p.spent, 1_000_000);
  assert.deepEqual(p.bond, { 1: 50 });
  assert.deepEqual(p.best, { "hop-hop": 10 });
  assert.deepEqual(p.badges, ["a-b"]);
  assert.deepEqual(p.owned, ["stage-stars"]);
  assert.deepEqual(p.equipped, { stage: "stage-stars", bubble: "", frame: "" });
});

test("mergeProgress: the larger number wins, lists join, the newer device look wins", () => {
  const a = cleanProgress({ candles: 100, spent: 20, bond: { 1: 10 }, best: { x: 5 }, badges: ["a"], owned: ["o1"], equipped: { stage: "s1" } });
  const b = cleanProgress({ candles: 50, spent: 40, bond: { 1: 30, 2: 5 }, best: { x: 3 }, badges: ["b"], owned: ["o2"], equipped: { stage: "s2" } });
  const m = mergeProgress(a, b);
  assert.equal(m.candles, 100);
  assert.equal(m.spent, 40);
  assert.deepEqual(m.bond, { 1: 30, 2: 5 });
  assert.deepEqual(m.best, { x: 5 });
  assert.deepEqual(m.badges.sort(), ["a", "b"]);
  assert.deepEqual(m.owned.sort(), ["o1", "o2"]);
  assert.equal(m.equipped.stage, "s2");
});

test("parseFeed and fitsWhisper enforce 24h recency on RSS articles and block URL/title duplicates", () => {
  const now = Date.parse("2026-10-31T12:00:00+07:00");
  const xml = `
    <rss><channel>
      <item>
        <title>Cuma di 27 Oktober, Nonton di Bioskop Cuma Rp25 Ribu</title>
        <link>https://www.cnnindonesia.com/hiburan/20261026142954-220-1419723/cuma-sehari-besok-nonton-di-bioskop-cuma-rp25-ribu</link>
        <pubDate>Mon, 26 Oct 2026 14:29:54 +0700</pubDate>
        <enclosure url="https://akcdn.detik.net.id/visual/2026/10/26/film.jpg" />
      </item>
      <item>
        <title>AirNav Indonesia Pamerkan Inovasi Navigasi Penerbangan di AS</title>
        <link>https://www.cnnindonesia.com/teknologi/20261031052807-185-1421672/airnav-indonesia-pamerkan-inovasi-navigasi-penerbangan-di-as</link>
        <pubDate>Sat, 31 Oct 2026 05:28:07 WIB</pubDate>
        <enclosure url="https://akcdn.detik.net.id/visual/2026/10/31/airnav.jpg" />
      </item>
    </channel></rss>`;
  const [oldArt, freshArt] = parseFeed(xml, "CNN Indonesia");
  assert.equal(fitsWhisper(oldArt, new Set(), now), false); // Oct 26 is older than 24h
  assert.equal(fitsWhisper(freshArt, new Set(), now), true); // Oct 31 is within 24h

  // Popular items (Google Trends / YouTube mostPopular) do not require a 24h RSS pubDate, unless their URL embeds an old date
  const popularTrend = { ...oldArt, kind: "trend", publishedAt: null };
  assert.equal(fitsWhisper(popularTrend, new Set(), now), true);
  assert.equal(fitsWhisper({ ...oldArt, kind: "trend" }, new Set(), now), false);

  // Deduplication catches normalized URL (trailing slash / UTM query) and case-insensitive title
  const seen = new Set([linkKey(freshArt.url), titleKey(freshArt.title)]);
  assert.equal(fitsWhisper({ ...freshArt, url: freshArt.url + "/?utm_source=rss", title: "Different Title Entirely" }, seen, now), false);
  assert.equal(fitsWhisper({ ...freshArt, url: "https://www.antaranews.com/berita/999/other", title: freshArt.title.toUpperCase() }, seen, now), false);
  assert.equal(parsePubDate("", oldArt.url), Date.parse("2026-10-26T14:29:54+07:00"));
});
