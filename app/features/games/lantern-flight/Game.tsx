// Lentera Terbang (Lantern Flight): 3D view with 2D canvas fallback.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { canUse3D } from "~/features/three/kit";
import { ThreeBoundary } from "~/features/three/ThreeBoundary";
import type { GameProps } from "../types";
import { createEngine, FINISH, FLAMES, type LanternEngine } from "./logic";
import { TEXT } from "./text";

const LazyScene3D = lazy(() => import("./Scene3D"));
const STARS = Array.from({ length: 40 }, (_, i) => [(i * 97) % 360, (i * 211) % 540, i % 3 ? 1 : 1.8] as const);

function View2D({
  engRef,
  flickerRef,
  onTick,
}: {
  engRef: React.RefObject<LanternEngine>;
  flickerRef: React.RefObject<number>;
  onTick: (dt: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const g = cv.getContext("2d");
    if (!g) return;

    const resize = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, el.clientWidth) * d;
      cv.height = Math.max(1, el.clientHeight) * d;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      onTick(dt);

      const s = engRef.current.state();
      const W = cv.width;
      const H = cv.height;
      const u = Math.min(W / 7, H / 11);
      const ox = W / 2;
      const oy = H * 0.68;
      const X = (x: number) => ox + x * u;
      const Y = (y: number) => oy - (y - s.y) * u * 0.9;

      g.fillStyle = "#15142b";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#dfe6ff";
      for (const [x, y, r] of STARS) {
        g.globalAlpha = 0.5;
        g.beginPath();
        g.arc((x / 360) * W, (((((y - s.y * 6) % 540) + 540) % 540) / 540) * H, (r * u) / 50, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
      const my = Y(FINISH + 5);
      if (my > -u * 4) {
        g.fillStyle = "#f4efd6";
        g.beginPath();
        g.arc(X(2), my, u * 2, 0, 7);
        g.fill();
      }
      for (const it of s.items) {
        const x = X(it.x);
        const y = Y(it.y);
        if (it.kind === "wish") {
          g.fillStyle = "#ffe08a";
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = (i % 2 ? 0.14 : 0.32) * u;
            const a = (i * Math.PI) / 5;
            g.lineTo(x + Math.sin(a) * r, y - Math.cos(a) * r);
          }
          g.fill();
        } else if (it.kind === "branch") {
          g.strokeStyle = "#4a352c";
          g.lineWidth = u * 0.22;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(X(Math.sign(it.x) * 3.6), y - u * 0.2);
          g.lineTo(x - Math.sign(it.x) * u * 0.6, y + u * 0.1);
          g.stroke();
        } else {
          g.fillStyle = "#2c2748";
          g.beginPath();
          g.moveTo(x, y - u * 0.5);
          g.lineTo(x + u * 0.38, y);
          g.lineTo(x, y + u * 0.5);
          g.lineTo(x - u * 0.38, y);
          g.fill();
        }
      }
      const lx = X(s.x);
      const ly = Y(s.y);
      const f = flickerRef.current;
      g.globalAlpha = f > 0 ? 0.55 : 1;
      const grd = g.createRadialGradient(lx, ly, 0, lx, ly, u * 1.6);
      grd.addColorStop(0, "#ffb25e66");
      grd.addColorStop(1, "#ffb25e00");
      g.fillStyle = grd;
      g.fillRect(lx - u * 2, ly - u * 2, u * 4, u * 4);
      g.fillStyle = "#ffb25e";
      g.beginPath();
      g.roundRect(lx - u * 0.3, ly - u * 0.3, u * 0.6, u * 0.6, u * 0.12);
      g.fill();
      g.fillStyle = "#6b3b22";
      g.fillRect(lx - u * 0.22, ly + u * 0.3, u * 0.44, u * 0.07);
      g.fillStyle = "#e8e0ff";
      g.beginPath();
      g.arc(lx, ly - u * 0.42, u * 0.16, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engRef, flickerRef, onTick]);

  return (
    <div ref={hostRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}

export default function LanternFlightGame({ lang, char, reduceMotion, onOver, force2D }: GameProps & { force2D?: boolean }) {
  const L = TEXT[lang] || TEXT.en;
  const engRef = useRef<LanternEngine>(createEngine());
  const holdRef = useRef(false);
  const runningRef = useRef(false);
  const overRef = useRef(false);
  const flickerRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [score, setScore] = useState(0);
  const [flames, setFlames] = useState(FLAMES);
  const [pct, setPct] = useState(0);
  const [hintOff, setHintOff] = useState(false);

  const onTick = useCallback(
    (dt: number) => {
      if (!runningRef.current || overRef.current) return;
      const ev = engRef.current.step(dt, holdRef.current);
      if (ev.includes("hit") && !reduceMotion) flickerRef.current = 1;
      flickerRef.current = Math.max(0, flickerRef.current - dt);
      const s = engRef.current.state();
      setScore(s.score);
      setFlames(s.flames);
      setPct(Math.min(1, s.y / FINISH) * 100);
      if (s.done) {
        overRef.current = true;
        timerRef.current = setTimeout(() => onOver(s.score), 1400);
      }
    },
    [onOver, reduceMotion],
  );

  const press = useCallback((v: boolean) => {
    holdRef.current = v;
    if (v && !runningRef.current && !overRef.current) {
      runningRef.current = true;
      setHintOff(true);
    }
  }, []);

  useEffect(() => {
    const up = () => press(false);
    const keyOk = (e: KeyboardEvent) => e.code === "Space" || e.code === "ArrowRight";
    const kd = (e: KeyboardEvent) => {
      if (keyOk(e)) {
        e.preventDefault();
        press(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (keyOk(e)) press(false);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", up);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [press]);

  const fallback = <View2D engRef={engRef} flickerRef={flickerRef} onTick={onTick} />;
  const show3d = !force2D && !reduceMotion && canUse3D();

  return (
    <div
      className="relative min-h-[inherit] w-full cursor-pointer overflow-hidden bg-[#15142b] touch-none select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        press(true);
      }}
    >
      <div className="absolute inset-0">
        {show3d ? (
          <ThreeBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <LazyScene3D char={char} engRef={engRef} flickerRef={flickerRef} onTick={onTick} />
            </Suspense>
          </ThreeBoundary>
        ) : (
          fallback
        )}
      </div>
      <div className="pointer-events-none absolute top-2 right-3 left-3 flex justify-between font-comic text-sm font-semibold text-[#ffe9b8] [text-shadow:0_1px_4px_#000a]">
        <span>
          {L.score}: <b>{score}</b>
        </span>
        <span aria-live="polite" aria-label={L.flames}>
          {Array.from({ length: FLAMES }, (_, i) => (
            <span
              key={i}
              className={`ml-1 inline-block h-3.5 w-2.5 rounded-[50%_50%_50%_50%/65%_65%_35%_35%] bg-[#ffb347] shadow-[0_0_8px_#ffb347] transition-[opacity,transform] duration-500 ${
                i >= flames ? "scale-60 opacity-15" : ""
              }`}
            />
          ))}
        </span>
      </div>
      <div className="pointer-events-none absolute top-10 right-1.5 bottom-10 w-[3px] rounded-xs bg-white/13">
        <i
          style={{ bottom: `calc(${pct}% - 4px)` }}
          className="absolute -left-[3px] size-[9px] rounded-full bg-[var(--accent,#a47fd0)]"
        />
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-[14%] px-6 text-center font-comic text-sm text-[#ffe9b8] transition-opacity duration-600 ${
          hintOff ? "opacity-0" : "opacity-100"
        }`}
      >
        {L.tap}
      </div>
    </div>
  );
}
