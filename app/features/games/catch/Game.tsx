// Hair Catch on one canvas: a finger or the mouse moves the ghost, the arrow keys (or A and D) slide her, Space starts.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { asset } from "~/lib/asset";
import { CANVAS_CLASS, loadImage, onControl, setupCanvas } from "../canvas";
import type { GameProps } from "../types";
import { type CatchState, clampX, freshCatch, GROUND, H, HERO_H, type Item, reach, start, update, W } from "./logic";

const STARS = Array.from({ length: 30 }, (_, i) => ({ x: (i * 89) % W, y: 10 + ((i * 47) % 150), r: i % 4 === 0 ? 1.6 : 1 }));

/** Stories only: start already running, or show a finished run. */
export type Demo = "playing" | "over";

export default function CatchGame({ char, best, onOver, game, lang, restarted, demo, rng }: GameProps & { demo?: Demo; rng?: () => number }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState<Error | null>(null);
  if (failed) throw failed; // the game page says it could not start
  const over = useRef(onOver);
  useEffect(() => {
    over.current = onOver;
  }, [onOver]);
  const startText = game.startText?.[lang] || t("tapToStart");
  const accent = char.accent;
  const stage = asset(char.stage);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let destroyed = false;
    let raf = 0;
    let last = 0;
    const s: CatchState = freshCatch();
    const keys = { left: false, right: false };
    let detach = () => {};

    loadImage(stage).then((hero) => {
      if (destroyed) return;
      const ctx = setupCanvas(canvas, W, H);
      if (!ctx) return;
      const heroW = HERO_H * ((hero.naturalWidth || 1) / (hero.naturalHeight || 1));
      const { catchW } = reach(heroW);
      if (demo === "playing") start(s);
      if (demo === "over") Object.assign(s, { state: "over", time: 40, score: 185, lives: 0, items: [{ x: 120, y: 90, vy: 0, dark: true, spin: 1 }] });

      const drawItem = (it: Item) => {
        ctx.save();
        ctx.translate(it.x, it.y);
        if (it.dark) {
          ctx.rotate(it.spin);
          ctx.fillStyle = "#1a1328";
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r = i % 2 ? 8 : 14;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#7a4bd6";
          ctx.stroke();
          ctx.rotate(-it.spin);
          ctx.fillStyle = "#ff5a5a";
          ctx.fillRect(-5, -3, 3, 3);
          ctx.fillRect(2, -3, 3, 3);
        } else {
          ctx.shadowColor = "#ffe08a";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#fff2c2";
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#14151a";
          ctx.stroke();
          ctx.fillStyle = "#14151a";
          ctx.font = "bold 13px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("?", 0, 5);
        }
        ctx.restore();
      };

      const draw = () => {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#0f1f1a");
        sky.addColorStop(1, "#1d4a38");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,.7)";
        for (const st of STARS) {
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#102a20"; // ground
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = accent;
        ctx.fillRect(0, GROUND, W, 2);

        s.items.forEach(drawItem);

        // the ghost, leaning a little the way she moves; a red flash when a dark one got her
        ctx.save();
        ctx.translate(s.x, GROUND);
        ctx.rotate(Math.max(-0.18, Math.min(0.18, s.vx / 2200)));
        ctx.drawImage(hero, -heroW / 2, -HERO_H, heroW, HERO_H);
        if (s.flash > 0) {
          ctx.fillStyle = `rgba(255, 60, 60, ${s.flash})`;
          ctx.fillRect(-heroW / 2, -HERO_H, heroW, HERO_H);
        }
        ctx.restore();

        ctx.font = "bold 14px system-ui, sans-serif";
        for (const p of s.pop) {
          ctx.fillStyle = p.dark ? "#ff8a8a" : "#ffe08a";
          ctx.textAlign = "center";
          ctx.fillText(p.text, p.x, p.y);
        }
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.fillText(String(s.score), 12, 24);
        ctx.textAlign = "right";
        ctx.fillStyle = "#ff8a9a";
        ctx.fillText("♥".repeat(Math.max(0, s.lives)), W - 12, 24);
        if (best) {
          ctx.fillStyle = "rgba(255,255,255,.6)";
          ctx.font = "13px system-ui, sans-serif";
          ctx.fillText(String(Math.max(best, s.score)), W - 12, 42);
        }
        if (s.state === "ready") {
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.font = "bold 17px system-ui, sans-serif";
          ctx.fillText(startText, W / 2, 110);
        }
      };

      const frame = (now: number) => {
        const dt = Math.min(0.033, (now - (last || now)) / 1000);
        last = now;
        if (update(s, dt, heroW, keys, rng)) over.current(s.score);
        draw();
        if (!destroyed) raf = requestAnimationFrame(frame);
      };

      // ---- input: finger or mouse follows, arrow keys / A and D move ----
      const toLogical = (clientX: number) => {
        const r = canvas.getBoundingClientRect();
        return clampX(((clientX - r.left) / (r.width || W)) * W, catchW);
      };
      const onMove = (e: PointerEvent) => {
        s.targetX = toLogical(e.clientX);
      };
      const onDown = (e: PointerEvent) => {
        e.preventDefault();
        canvas.focus({ preventScroll: true });
        s.targetX = toLogical(e.clientX);
        start(s);
      };
      const keyName = (e: KeyboardEvent) =>
        e.code === "ArrowLeft" || e.code === "KeyA" ? "left" : e.code === "ArrowRight" || e.code === "KeyD" ? "right" : e.code === "Space" ? "start" : null;
      const onKeyDown = (e: KeyboardEvent) => {
        if (onControl(e)) return; // let buttons work
        const k = keyName(e);
        if (!k) return;
        e.preventDefault();
        if (k === "start") start(s);
        else {
          keys[k] = true;
          start(s);
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        const k = keyName(e);
        if (k === "left" || k === "right") keys[k] = false;
      };
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerdown", onDown);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      detach = () => {
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
      if (restarted) canvas.focus({ preventScroll: true });
      raf = requestAnimationFrame(frame);
    }, setFailed);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      detach();
    };
  }, [stage, accent, best, startText, restarted, demo, rng]);

  return <canvas ref={canvasRef} tabIndex={0} role="img" aria-label={`${game.title} game`} className={CANVAS_CLASS} />;
}
