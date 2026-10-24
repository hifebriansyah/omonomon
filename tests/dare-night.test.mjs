import test from "node:test";
import assert from "node:assert/strict";
import { NODES, ENDINGS, ENDING_IDS, ROUTE_IDS, GHOSTS, COMPANION, optionsOf, newRun, step, endingOf, scoreOf, pickRoute } from "../assets/scripts/games/dare-night.js";

const nodes = Object.values(NODES);
const hasBoth = (b) => b && typeof b.en === "string" && b.en && typeof b.id === "string" && b.id;

test("every node and option has EN and ID text; no formal Indonesian", () => {
  for (const n of nodes) {
    assert.ok(hasBoth(n.t), n.id);
    for (const o of n.opts) { assert.ok(hasBoth(o.t) && hasBoth(o.res), n.id); assert.doesNotMatch(o.t.id + o.res.id + n.t.id, /\b(saya|Anda)\b/i); }
  }
  for (const e of Object.values(ENDINGS)) assert.ok(hasBoth(e.t) && hasBoth(e.x));
  for (const g of GHOSTS) { assert.equal(COMPANION[g].say.length, 6); COMPANION[g].say.forEach((s) => assert.ok(hasBoth(s))); assert.ok(hasBoth(COMPANION[g].end)); }
});

test("choices point to existing nodes or end; no dead ends; 6 steps per route", () => {
  for (const n of nodes) {
    for (const lvl of [1, 4, 7]) { const k = optionsOf(n, lvl).length; assert.ok(k >= 2 && k <= 4, n.id); }
    assert.ok(optionsOf(n, 1).length <= 3);
    for (const o of n.opts) assert.ok(o.to === "end" || NODES[o.to], `${n.id}->${o.to}`);
  }
  assert.ok(ROUTE_IDS.length >= 2);
  for (const r of ROUTE_IDS) { assert.ok(NODES[r + "1"]); let id = r + "1", hops = 0; while (id !== "end") { id = NODES[id].opts[0].to; assert.ok(++hops <= 8); } assert.ok(hops >= 5 && hops <= 8); }
});

test("pickRoute varies", () => { assert.ok(new Set([0, 1, 2, 3, 4].map(pickRoute)).size >= 2); });

// explore every path with a DFS over (node, stats) to collect reachable endings and scores
function explore(level) {
  const seen = new Set(), scores = [];
  for (const route of ROUTE_IDS) {
    const walk = (s) => {
      if (s.done) { seen.add(s.ending); scores.push(s.score); return; }
      for (const o of optionsOf(NODES[s.node], level)) walk(step(s, o.index));
    };
    walk(newRun({ ghost: "1", level, route }));
  }
  return { seen, scores };
}

test("at least 4 endings, all reachable; lantern only at bond >= 7", () => {
  assert.ok(ENDING_IDS.length >= 4);
  const hi = explore(7);
  for (const e of ENDING_IDS) assert.ok(hi.seen.has(e), e);
  for (const lvl of [1, 3, 4, 6]) { const lo = explore(lvl); assert.ok(!lo.seen.has("lantern")); assert.ok(lo.seen.size >= 4); }
});

test("scores stay within 40..160 and are integers", () => {
  for (const lvl of [1, 4, 7, 10]) for (const s of explore(lvl).scores) { assert.ok(Number.isInteger(s) && s >= 40 && s <= 160, String(s)); }
  assert.equal(scoreOf({ c: 0, k: 0, u: 0 }, 1, "hurry") >= 40, true);
  assert.ok(scoreOf({ c: 8, k: 8, u: 8 }, 10, "lantern") <= 160);
});

test("bond-gated options appear only at level >= 4", () => {
  const gated = nodes.filter((n) => n.opts.some((o) => o.min));
  assert.ok(gated.length >= 2);
  for (const n of gated) { assert.equal(optionsOf(n, 3).length, n.opts.length - n.opts.filter((o) => o.min).length); assert.equal(optionsOf(n, 4).length, n.opts.length); }
  const s = newRun({ ghost: "2", level: 3, route: "grave" });
  assert.equal(step(s, 3), s, "hidden option cannot be chosen");
  assert.notEqual(step({ ...s, level: 4 }, 3), s);
});

test("endingOf rules and step immutability", () => {
  assert.equal(endingOf({ c: 0, k: 0, u: 1 }, 9), "hurry");
  assert.equal(endingOf({ c: 6, k: 1, u: 1 }, 1), "bold");
  assert.equal(endingOf({ c: 1, k: 6, u: 1 }, 1), "kind");
  assert.equal(endingOf({ c: 1, k: 1, u: 6 }, 1), "curious");
  assert.equal(endingOf({ c: 3, k: 3, u: 3 }, 7), "lantern");
  const s = newRun({ ghost: "3", level: 1, route: "ward" });
  const t = step(s, 0);
  assert.equal(s.node, "ward1"); assert.equal(t.node, "ward2"); assert.equal(s.stats.c, 2 - 2);
});
