// Obat Malam: the view. The rules are in logic.ts; this runs the frame loop, draws the falling pill and the three beds.
import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../types";
import { createEngine, LIVES, type Engine, type EngineEvent } from "./logic";
import { COLORS, SHAPES, TEXT } from "./text";
import "./night-meds.css";

/** `makeEngine` is for Storybook only (a seeded or half-played run); the page always starts a fresh one. */
export default function Game({ onOver, lang, reduceMotion, makeEngine }: GameProps & { makeEngine?: () => Engine }) {
  const X = TEXT[lang === "id" ? "id" : "en"];
  const [eng] = useState(() => (makeEngine ? makeEngine() : createEngine()));
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  const [msg, setMsg] = useState({ text: "", on: false });
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const pillEl = useRef<HTMLDivElement>(null);
  const reported = useRef(false);
  const okCount = useRef(0);
  const msgTimer = useRef(0);
  const raf = useRef(0);
  const report = useRef(onOver);
  useEffect(() => {
    report.current = onOver;
  });

  // The handlers below only run from events and the frame loop, never during render.
  const say = (text: string) => {
    setMsg({ text, on: true });
    clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMsg((m) => ({ ...m, on: false })), 600);
  };
  const shake = () => {
    const el = box.current;
    if (reduceMotion || !el) return;
    el.classList.remove("shake");
    void el.offsetWidth; // restart the animation
    el.classList.add("shake");
  };
  const finish = () => {
    if (reported.current) return;
    reported.current = true;
    cancelAnimationFrame(raf.current);
    report.current(eng.state().score);
  };
  const react = (events: EngineEvent[]) => {
    for (const e of events) {
      if (e.type === "ok") say(e.streak >= 5 ? `${X.streak(e.streak)} +${e.gain}` : X.ok[okCount.current++ % X.ok.length]);
      else if (e.type === "wrong" || e.type === "miss") {
        say(e.type === "wrong" ? X.bad : X.miss);
        shake();
      } else if (e.type === "over") finish();
    }
    if (events.length) repaint();
  };
  // The pill's height is set straight on the element every frame (no re-render per frame).
  const draw = () => {
    const p = eng.state().pill,
      el = pillEl.current;
    if (!el) return;
    el.style.display = p ? "flex" : "none";
    if (p) el.style.top = `${p.p * ((field.current?.clientHeight ?? 44) - 44)}px`;
  };
  const latest = useRef({ react, draw });
  useEffect(() => {
    latest.current = { react, draw };
  });

  useEffect(() => {
    let last = performance.now();
    const frame = (now: number) => {
      if (reported.current) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      latest.current.react(eng.tick(dt));
      latest.current.draw();
      if (!reported.current) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(msgTimer.current);
    };
  }, [eng]);

  const pick = (i: number) => {
    if (reported.current) return;
    react(eng.choose(i));
    draw();
  };
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const i = ({ "1": 0, "2": 1, "3": 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 } as Record<string, number>)[ev.key];
      if (i === undefined) return;
      ev.preventDefault();
      pickRef.current(i);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const s = eng.state();
  const lives = Math.max(0, s.lives);
  return (
    <div ref={box} className={`om${reduceMotion ? " rm" : ""}`}>
      <div className="om-top">
        <span>{`${X.score} ${s.score}`}</span>
        <span>{s.streak >= 2 ? X.streak(s.streak) : ""}</span>
        <span className="om-lives" aria-live="polite" aria-label={X.lives(lives)}>
          {"♥".repeat(lives) + "♡".repeat(Math.max(0, LIVES - lives))}
        </span>
      </div>
      <div ref={field} className="om-field">
        <div className="om-zone" />
        <div
          ref={pillEl}
          className="om-pill"
          role="img"
          aria-label={s.pill ? X.pill[s.pill.kind] : undefined}
          style={{ left: "50%", background: s.pill ? COLORS[s.pill.kind] : undefined }}
        >
          {s.pill ? SHAPES[s.pill.kind] : ""}
        </div>
        <div className={`om-msg${msg.on ? " on" : ""}`} aria-live="assertive">
          {msg.text}
        </div>
      </div>
      <div className="om-trays">
        {COLORS.map((c, i) => (
          <button
            key={i}
            type="button"
            className="om-tray"
            style={{ "--c": c } as CSSProperties}
            aria-label={X.tray[i]}
            aria-keyshortcuts={String(i + 1)}
            onPointerDown={(e) => {
              e.preventDefault(); // react on touch at once, not on the later click
              pick(i);
            }}
            onClick={(e) => {
              if (e.detail === 0) pick(i); // keyboard activation of a focused button
            }}
          >
            {SHAPES[i]}
            <small>{i + 1}</small>
          </button>
        ))}
      </div>
      <div className="om-hint">{X.hint}</div>
    </div>
  );
}
