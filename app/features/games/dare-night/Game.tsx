// Uji Nyali (Dare Night): a choose-your-path night walk with a ghost companion.
import { useEffect, useRef, useState } from "react";
import { levelOf, useProgress } from "~/features/games/progress";
import { asset } from "~/lib/asset";
import type { GameProps } from "../types";
import "./dare-night.css";
import { COMPANION, ENDINGS, GHOSTS, NODES, newRun, optionsOf, ROUTE_IDS, ROUTES, type RunState, step } from "./logic";
import { TEXT } from "./text";

export default function DareNightGame({ lang, chars, reduceMotion, onOver, initialRun }: GameProps & { initialRun?: RunState }) {
  const L = TEXT[lang] || TEXT.en;
  const progress = useProgress();
  const [ghost, setGhost] = useState("1");
  const [state, setState] = useState<RunState | null>(initialRun || null);
  const overRef = useRef(false);
  const lastRouteRef = useRef<string | null>(null);
  const finBtnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const nameOf = (id: string) => chars.find((c) => c.id === id)?.name || id;
  const fill = (s: string, g: string) => s.replaceAll("{g}", nameOf(g));

  const begin = (id: string, level: number) => {
    const pool = ROUTE_IDS.filter((r) => r !== lastRouteRef.current);
    const route = pool[Math.floor(Math.random() * pool.length)];
    lastRouteRef.current = route;
    overRef.current = false;
    setGhost(id);
    setState(newRun({ ghost: id, level, route }));
  };

  useEffect(() => {
    if (state?.done) finBtnRef.current?.focus({ preventScroll: true });
    else if (state && boxRef.current) boxRef.current.scrollTop = 0;
  }, [state]);

  useEffect(() => {
    if (!state || state.done) return;
    const node = NODES[state.node];
    if (!node) return;
    const opts = optionsOf(node, state.level);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= opts.length) {
        setState((prev) => (prev ? step(prev, opts[n - 1].index) : prev));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state]);

  return (
    <div ref={boxRef} className={`un${reduceMotion ? " rm" : ""}`}>
      {!state ? (
        <>
          <h3>{L.pick}</h3>
          <div className="un-heads">
            {GHOSTS.map((id) => {
              const c = chars.find((x) => x.id === id);
              const lv = levelOf(progress.bond[id] || 0);
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`${nameOf(id)}, ${L.lvl} ${lv}`}
                  className={id === ghost ? "on" : ""}
                  onClick={() => begin(id, lv)}
                >
                  {c?.head && <img src={asset(c.head)} alt="" />}
                  {nameOf(id)}
                  <br />
                  {`${L.lvl} ${lv}`}
                </button>
              );
            })}
          </div>
        </>
      ) : state.done && state.ending ? (
        <div className="un-card">
          {state.last && <p className="un-res">{fill(state.last[lang], state.ghost)}</p>}
          <h3>{`${L.ending}: ${ENDINGS[state.ending].t[lang]}`}</h3>
          <p>{fill(ENDINGS[state.ending].x[lang], state.ghost)}</p>
          <p className="un-say">{`${nameOf(state.ghost)}: ${COMPANION[state.ghost].end[lang]}`}</p>
          <button
            ref={finBtnRef}
            type="button"
            onClick={() => {
              if (overRef.current) return;
              overRef.current = true;
              onOver(state.score, { char: state.ghost });
            }}
          >
            {L.fin}
          </button>
        </div>
      ) : (
        (() => {
          const node = NODES[state.node];
          const g = state.ghost;
          const opts = optionsOf(node, state.level);
          return (
            <div key={state.node} className="un-card">
              <p>{`${L.route}: ${ROUTES[node.route][lang]}`}</p>
              <div className="un-dots">
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} className={i <= node.i ? "on" : ""} />
                ))}
              </div>
              {state.last && <p className="un-res">{fill(state.last[lang], g)}</p>}
              <p>{fill(node.t[lang], g)}</p>
              <p className="un-say">{`${nameOf(g)}: ${COMPANION[g].say[node.i][lang]}`}</p>
              {node.b4 && state.level >= 4 && <p className="un-say">{fill(node.b4[lang], g)}</p>}
              {opts.map((o, n) => (
                <button key={o.index} type="button" onClick={() => setState((prev) => (prev ? step(prev, o.index) : prev))}>
                  {`${n + 1}. ${fill(o.t[lang], g)}`}
                </button>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}
