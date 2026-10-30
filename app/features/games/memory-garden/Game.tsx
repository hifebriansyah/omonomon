// Bunga Kenangan: the view. The rules are in logic.ts; this draws the 7 x 7 petals, takes taps, swipes and keys, and plays
// the cascade steps one by one.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { GameProps } from "../types";
import { createEngine, isAdjacent, SIZE, type Board, type Engine, type Pos } from "./logic";
import { COLORS, GLYPHS, TEXT } from "./text";
import "./memory-garden.css";

const key = (r: number, c: number) => `${r},${c}`;

/** `makeEngine` is for Storybook only (a seeded or half-played run); the page always starts a fresh one. */
export default function Game({ onOver, lang, reduceMotion, makeEngine }: GameProps & { makeEngine?: () => Engine }) {
  const L = TEXT[lang === "id" ? "id" : "en"];
  const [eng] = useState(() => (makeEngine ? makeEngine() : createEngine()));
  const [view, setView] = useState(() => ({ board: eng.state.board, moves: eng.state.moves, score: eng.state.score }));
  const [sel, setSel] = useState<Pos | null>(null);
  const [pop, setPop] = useState<Set<string>>(new Set());
  const [no, setNo] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState(L.hint);
  const busy = useRef(false);
  const finished = useRef(false);
  const dead = useRef(false);
  const down = useRef<{ p: Pos | null; x: number; y: number } | null>(null);
  const timers = useRef(new Set<number>());
  const report = useRef(onOver);
  useEffect(() => {
    report.current = onOver;
  });
  useEffect(() => {
    const pending = timers.current;
    dead.current = false;
    return () => {
      dead.current = true;
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = window.setTimeout(() => {
        timers.current.delete(t);
        resolve();
      }, reduceMotion ? 0 : ms);
      timers.current.add(t);
    });

  // Shows a board (a cascade step's, or the engine's) and clears the pop, select and wiggle marks, as the old paint() did.
  const paint = (board: Board = eng.state.board, score = eng.state.score) => {
    setView({ board, moves: eng.state.moves, score });
    setPop(new Set());
    setSel(null);
    setNo(new Set());
  };

  async function attempt(a: Pos, b: Pos) {
    if (busy.current || dead.current || !isAdjacent(a, b)) return;
    busy.current = true;
    setSel(null);
    const res = eng.swap(a, b);
    if (!res.valid) {
      setNo(new Set([key(a.r, a.c), key(b.r, b.c)]));
      setMsg(L.wiggle);
      await wait(320);
      if (dead.current) return;
      setNo(new Set());
      busy.current = false;
      return;
    }
    setMsg("");
    for (const st of res.steps) {
      setPop(new Set(st.cleared.map(([r, c]) => key(r, c))));
      if (st.mult > 1) setMsg(L.chain(st.mult));
      await wait(280);
      if (dead.current) return;
      paint(st.board, eng.state.score - res.steps.filter((x) => x.mult > st.mult).reduce((t, x) => t + x.points, 0));
    }
    paint();
    if (res.reshuffled) setMsg(L.shuffle);
    busy.current = false;
    if (eng.state.over && !finished.current) {
      finished.current = true;
      setMsg(L.over);
      await wait(500);
      if (!dead.current) report.current(eng.state.score);
    }
  }

  function tap(r: number, c: number) {
    if (busy.current || dead.current) return;
    const p = { r, c };
    if (!sel) return setSel(p);
    if (sel.r === r && sel.c === c) return setSel(null);
    if (isAdjacent(sel, p)) attempt(sel, p);
    else setSel(p);
  }

  const posOf = (t: EventTarget): Pos | null => {
    const e = t instanceof Element ? (t.closest(".bk-c") as HTMLElement | null) : null;
    return e ? { r: Number(e.dataset.r), c: Number(e.dataset.c) } : null;
  };
  const onDown = (e: PointerEvent) => {
    down.current = { p: posOf(e.target), x: e.clientX, y: e.clientY };
  };
  // A short press is a tap; a drag of 18 px or more swaps towards the drag.
  const onUp = (e: PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || !d.p) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return tap(d.p.r, d.p.c);
    const n = Math.abs(dx) > Math.abs(dy) ? { r: d.p.r, c: d.p.c + Math.sign(dx) } : { r: d.p.r + Math.sign(dy), c: d.p.c };
    if (n.r >= 0 && n.c >= 0 && n.r < SIZE && n.c < SIZE) attempt(d.p, n);
  };
  const onKey = (e: KeyboardEvent) => {
    const p = posOf(e.target);
    if ((e.key === "Enter" || e.key === " ") && p) {
      e.preventDefault();
      tap(p.r, p.c);
    }
  };

  return (
    <div className={`bk${reduceMotion ? " calm" : ""}`}>
      <div className="bk-bar">
        <span>
          {L.moves} <b>{view.moves}</b>
        </span>
        <span>
          {L.score} <b>{view.score}</b>
        </span>
      </div>
      <div className="bk-grid" role="grid" style={{ gridTemplateColumns: `repeat(${SIZE},1fr)` }} onPointerDown={onDown} onPointerUp={onUp} onKeyDown={onKey}>
        {view.board.map((row, r) =>
          row.map((k, c) => {
            const id = key(r, c);
            const cls = `bk-c${pop.has(id) ? " pop" : ""}${sel && sel.r === r && sel.c === c ? " sel" : ""}${no.has(id) ? " no" : ""}`;
            return (
              <button
                key={id}
                type="button"
                role="gridcell"
                className={cls}
                data-r={r}
                data-c={c}
                style={{ "--c": k == null ? undefined : COLORS[k] } as CSSProperties}
                aria-label={k == null ? undefined : L.cell(k, r, c)}
              >
                {k == null ? "" : GLYPHS[k]}
              </button>
            );
          }),
        )}
      </div>
      <div className="bk-msg" aria-live="polite">
        {msg}
      </div>
    </div>
  );
}
