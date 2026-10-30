// Hop Hop on one canvas: the night sky, the hills, the tombstones and the ghost. Tap, Space, Up or W hops.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { asset } from "~/lib/asset";
import { CANVAS_CLASS, loadImage, onControl, setupCanvas } from "../canvas";
import type { GameProps } from "../types";
import { freshRunner, GROUND, H, HERO_H, HERO_X, jump, type Obstacle, type RunnerState, update, W } from "./logic";

const STARS = Array.from({ length: 28 }, (_, i) => ({ x: (i * 97) % W, y: 12 + ((i * 53) % 110), r: i % 3 === 0 ? 1.6 : 1 }));

/** Stories only: start already running, or show a finished run. */
export type Demo = "playing" | "over";

export default function RunnerGame({ char, best, onOver, game, lang, restarted, demo, rng }: GameProps & { demo?: Demo; rng?: () => number }) {
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
    const s: RunnerState = freshRunner();
    let detach = () => {};

    loadImage(stage).then((hero) => {
      if (destroyed) return;
      const ctx = setupCanvas(canvas, W, H);
      if (!ctx) return;
      const heroW = HERO_H * ((hero.naturalWidth || 1) / (hero.naturalHeight || 1));
      if (demo === "playing") jump(s);
      if (demo === "over") Object.assign(s, { state: "over", time: 30, dist: 3120, score: 312, obstacles: [{ x: HERO_X + 30, w: 28, h: 44 }] });

      const tombstone = (o: Obstacle) => {
        const top = GROUND - o.h;
        ctx.beginPath();
        ctx.moveTo(o.x, GROUND);
        ctx.lineTo(o.x, top + o.w / 2);
        ctx.arc(o.x + o.w / 2, top + o.w / 2, o.w / 2, Math.PI, 0);
        ctx.lineTo(o.x + o.w, GROUND);
        ctx.closePath();
        ctx.fillStyle = "#9a97ad";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#14151a";
        ctx.stroke();
        ctx.beginPath(); // a small cross
        ctx.moveTo(o.x + o.w / 2, top + 8);
        ctx.lineTo(o.x + o.w / 2, top + 22);
        ctx.moveTo(o.x + o.w / 2 - 5, top + 13);
        ctx.lineTo(o.x + o.w / 2 + 5, top + 13);
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      const draw = () => {
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
        sky.addColorStop(0, "#1a1838");
        sky.addColorStop(1, "#3b2a5f");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#f4efd8"; // moon
        ctx.beginPath();
        ctx.arc(390, 56, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.75)";
        for (const st of STARS) {
          ctx.beginPath();
          ctx.arc((st.x - s.dist * 0.02 + W * 10) % W, st.y, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#2b2146"; // far hills
        ctx.beginPath();
        ctx.moveTo(0, GROUND);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GROUND - 26 - 14 * Math.sin((x + s.dist * 0.15) / 55));
        ctx.lineTo(W, GROUND);
        ctx.fill();

        ctx.fillStyle = "#231a38"; // ground
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = accent;
        ctx.fillRect(0, GROUND, W, 3);
        ctx.fillStyle = "rgba(255,255,255,.18)";
        for (let x = -((s.dist % 40) + 40); x < W; x += 40) ctx.fillRect(x, GROUND + 22, 18, 3);

        s.obstacles.forEach(tombstone);

        // the ghost: a little bob while hopping on the ground, tilted in the air
        const bob = s.state === "running" && s.y === 0 ? Math.abs(Math.sin(s.time * 14)) * 5 : 0;
        ctx.save();
        ctx.translate(HERO_X + heroW / 2, GROUND - s.y - bob);
        ctx.rotate(s.state === "over" ? 0.5 : Math.max(-0.15, Math.min(0.2, -s.vy / 3000)));
        ctx.drawImage(hero, -heroW / 2, -HERO_H, heroW, HERO_H);
        ctx.restore();

        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.fillText(String(s.score), 12, 24);
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,255,255,.65)";
        if (best) ctx.fillText(String(Math.max(best, s.score)), W - 12, 24);

        if (s.state === "ready") {
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.font = "bold 18px system-ui, sans-serif";
          ctx.fillText(startText, W / 2, 110);
        }
      };

      const frame = (now: number) => {
        const dt = Math.min(0.033, (now - (last || now)) / 1000);
        last = now;
        if (update(s, dt, heroW, rng)) over.current(s.score);
        draw();
        if (!destroyed) raf = requestAnimationFrame(frame);
      };

      // ---- input ----
      const onPointer = (e: PointerEvent) => {
        e.preventDefault();
        canvas.focus({ preventScroll: true });
        jump(s);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
          if (onControl(e)) return; // let buttons work
          e.preventDefault();
          jump(s);
        }
      };
      canvas.addEventListener("pointerdown", onPointer);
      window.addEventListener("keydown", onKey);
      detach = () => {
        canvas.removeEventListener("pointerdown", onPointer);
        window.removeEventListener("keydown", onKey);
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
