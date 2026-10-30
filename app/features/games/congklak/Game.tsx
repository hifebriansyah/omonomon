// Congklak view component.
import { useEffect, useRef, useState } from "react";
import { asset } from "~/lib/asset";
import type { GameProps } from "../types";
import "./congklak.css";
import { applyMove, chooseMove, type CongklakState, initialState, LEVELS, scoreOf, winnerOf } from "./logic";
import { TEXT } from "./text";

export default function CongklakGame({ lang, chars, reduceMotion, onOver, initialBoard, initialOppId }: GameProps & { initialBoard?: CongklakState; initialOppId?: string }) {
  const L = TEXT[lang] || TEXT.en;
  const [oppId, setOppId] = useState<string | null>(initialOppId || null);
  const [state, setState] = useState<CongklakState>(initialBoard || initialState);
  const [boardShown, setBoardShown] = useState<number[]>(() => (initialBoard || initialState()).b);
  const [hotIdx, setHotIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>("");

  const runRef = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const holeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  };

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      fn();
    }, ms);
    timersRef.current.add(t);
  };

  useEffect(() => clearTimers, []);

  const nameOf = (id: string | null) => chars.find((c) => c.id === id)?.name || "";

  const begin = (id: string) => {
    clearTimers();
    runRef.current += 1;
    const init = initialState();
    setOppId(id);
    setState(init);
    setBoardShown(init.b);
    setHotIdx(null);
    setBusy(false);
    setNote("");
  };

  const playMove = (current: CongklakState, from: number, opponent: string) => {
    const my = runRef.current;
    const level = LEVELS[opponent] || "medium";
    const r = applyMove(current, from);
    const wasMe = current.turn === 0;
    setBusy(true);
    setHotIdx(null);

    const delay = reduceMotion ? 0 : Math.max(35, Math.min(120, 4500 / Math.max(1, r.path.length)));
    let n = 0;

    const after = () => {
      if (my !== runRef.current) return;
      setState(r.state);
      setBoardShown(r.state.b);
      setHotIdx(null);
      if (r.state.over) {
        setBusy(true);
        const w = winnerOf(r.state);
        setNote(`${w === 0 ? L.win : w === 1 ? L.lose : L.draw} ${r.state.b[7]} : ${r.state.b[15]}`);
        const sc = scoreOf(r.state, level);
        later(() => {
          if (my === runRef.current) onOver(sc, { char: opponent });
        }, reduceMotion ? 0 : 900);
        return;
      }
      const nextNote = r.captured ? L.cap(r.captured) : r.extra && wasMe ? L.again : "";
      setNote(nextNote);
      if (r.state.turn === 1) {
        setBusy(true);
        later(() => {
          if (my === runRef.current) {
            playMove(r.state, chooseMove(r.state, level, Math.random), opponent);
          }
        }, reduceMotion ? 0 : 650);
      } else {
        setBusy(false);
      }
    };

    const stepAnim = () => {
      if (my !== runRef.current) return;
      if (n < r.path.length && delay > 0) {
        const p = r.path[n++];
        setBoardShown(p.b);
        setHotIdx(p.i);
        later(stepAnim, delay);
      } else {
        after();
      }
    };

    stepAnim();
  };

  const onArrow = (ev: React.KeyboardEvent, i: number) => {
    const d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    for (let k = i + d; k >= 0 && k < 7; k += d) {
      const btn = holeRefs.current[k];
      if (btn && !btn.disabled) {
        btn.focus();
        ev.preventDefault();
        return;
      }
    }
  };

  const mineActive = !busy && state.turn === 0 && !state.over;
  const statusText = note || (state.turn === 0 ? L.yourTurn : L.theirTurn(nameOf(oppId)));

  return (
    <div className={`cg${reduceMotion ? " rm" : ""}`}>
      {!oppId ? (
        <>
          <div>{L.pick}</div>
          <div className="cg-pick">
            {chars.map((c) => (
              <button key={c.id} type="button" className="cg-opp" onClick={() => begin(c.id)}>
                <img alt="" src={asset(c.head || c.image)} />
                <b>{c.name}</b>
                <small>{L.lv[LEVELS[c.id] || "medium"]}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="cg-st" aria-live="polite">
            {statusText}
          </div>
          <div className="cg-board" role="group">
            <div
              className={`cg-s${hotIdx === 15 ? " hot" : ""}`}
              style={{ gridColumn: 1 }}
              aria-label={`${nameOf(oppId)} ${L.store}`}
            >
              {boardShown[15]}
            </div>
            {[8, 9, 10, 11, 12, 13, 14].map((k) => (
              <div
                key={k}
                className={`cg-h${hotIdx === k ? " hot" : ""}`}
                style={{ gridColumn: 17 - k, gridRow: 1 }}
                aria-label={nameOf(oppId)}
              >
                {boardShown[k]}
              </div>
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <button
                key={h}
                ref={(el) => {
                  holeRefs.current[h] = el;
                }}
                type="button"
                disabled={!(mineActive && boardShown[h] > 0)}
                aria-label={L.hole(h + 1, boardShown[h])}
                style={{ gridColumn: h + 2, gridRow: 2 }}
                className={`cg-h${hotIdx === h ? " hot" : ""}`}
                onClick={() => playMove(state, h, oppId)}
                onKeyDown={(ev) => onArrow(ev, h)}
              >
                {boardShown[h]}
              </button>
            ))}
            <div
              className={`cg-s${hotIdx === 7 ? " hot" : ""}`}
              style={{ gridColumn: 9 }}
              aria-label={`${L.youHouse} ${L.store}: ${boardShown[7]}`}
            >
              {boardShown[7]}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
