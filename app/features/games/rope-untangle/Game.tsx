// Tali Lepas: the view. The rules are in logic.ts; this draws the ropes as SVG, runs the 90 s clock and reports the score once.
import { useEffect, useReducer, useRef, useState, type PointerEvent } from "react";
import type { GameProps } from "../types";
import { createRun, LEVEL_SECONDS, RUN_SECONDS, type Run } from "./logic";
import { TEXT } from "./text";
import "./rope-untangle.css";

const P = (v: number) => (v * 100).toFixed(2);

/** `makeRun` is for Storybook only (a seeded or half-played run); the page always starts a fresh one. */
export default function Game({ onOver, lang, reduceMotion, makeRun }: GameProps & { makeRun?: () => Run }) {
  const T = TEXT[lang === "id" ? "id" : "en"];
  const [run] = useState(() => (makeRun ? makeRun() : createRun()));
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  const [msg, setMsg] = useState(T.hint);
  const [drag, setDrag] = useState(-1); // for the look; dragRef answers the pointer events at once
  const dragRef = useRef(-1);
  const svgRef = useRef<SVGSVGElement>(null);
  const done = useRef(false);
  const report = useRef(onOver);
  useEffect(() => {
    report.current = onOver;
  });

  // The clock: ticks every 100 ms like the old setInterval loop.
  useEffect(() => {
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      run.tick(Math.min(0.25, (now - last) / 1000));
      last = now;
      repaint();
      if (run.state().over && !done.current) {
        done.current = true;
        clearInterval(timer);
        report.current(Math.max(0, Math.floor(run.state().score)));
      }
    };
    const timer = setInterval(loop, 100);
    loop();
    return () => clearInterval(timer);
  }, [run]);

  const moveTo = (i: number, e: PointerEvent) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    run.move(i, p.x / 100, p.y / 100);
    repaint();
  };

  const finish = () => {
    const gain = run.finish();
    if (!gain) return;
    setMsg(T.ok(gain));
    repaint();
    const svg = svgRef.current;
    if (svg && !reduceMotion) {
      svg.classList.remove("tl-ok");
      void svg.getBoundingClientRect(); // restart the flash
      svg.classList.add("tl-ok");
    }
  };

  const skip = () => {
    if (done.current) return;
    run.skip();
    setMsg(T.skipped);
    repaint();
  };

  const st = run.state(),
    g = st.g;
  const left = Math.max(0, Math.ceil(RUN_SECONDS - st.t));
  const shown = String(Math.max(0, Math.ceil(LEVEL_SECONDS - st.levelT)));

  return (
    <div className={`tl${reduceMotion ? " tl-reduce" : ""}`}>
      <div className="tl-bar">
        <span>{T.level(st.level + 1)}</span>
        <span className="tl-time" aria-hidden="true" data-low={left <= 10 ? "1" : "0"}>
          {T.time(left)}
        </span>
        <span aria-live="polite">{T.score(st.score)}</span>
      </div>
      <div className="tl-meter" role="img" aria-label={T.clock(shown)}>
        <i style={{ width: `${Math.max(0, 100 * (1 - st.levelT / LEVEL_SECONDS))}%` }} />
      </div>
      <svg ref={svgRef} className="tl-svg" viewBox="0 0 100 100" role="group" aria-label={T.board}>
        {/* a new level gets new elements (keys carry the level), as the old build() did */}
        {g.edges.map(([a, b], i) => (
          <line key={`${st.level}-${i}`} className={`tl-rope${st.bad.has(i) ? " bad" : ""}`} x1={P(g.pts[a].x)} y1={P(g.pts[a].y)} x2={P(g.pts[b].x)} y2={P(g.pts[b].y)} />
        ))}
        {g.pts.map((p, i) => {
          const end = () => {
            if (dragRef.current !== i) return;
            dragRef.current = -1;
            setDrag(-1);
            finish();
          };
          return (
            <g key={`${st.level}-k${i}`}>
              <circle className={`tl-knot${drag === i ? " drag" : ""}`} r="3" cx={P(p.x)} cy={P(p.y)} />
              <circle
                className="tl-hit"
                r="7"
                cx={P(p.x)}
                cy={P(p.y)}
                aria-label={T.knot(i + 1)}
                onPointerDown={(e) => {
                  if (done.current) return;
                  e.preventDefault();
                  dragRef.current = i;
                  setDrag(i);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (dragRef.current === i) moveTo(i, e);
                }}
                onPointerUp={end}
                onPointerCancel={end}
              />
            </g>
          );
        })}
      </svg>
      <div className="tl-msg" role="status">
        {msg}
      </div>
      <div style={{ textAlign: "center" }}>
        <button type="button" className="tl-btn" onClick={skip}>
          {T.skip}
        </button>
      </div>
    </div>
  );
}
