// Quiet Wish (memory): four petals glow in an order; repeat it. The order grows by one each round.
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { asset } from "~/lib/asset";
import type { GameProps } from "../types";
import { freshMemory, GAP_MS, type MemoryPhase, roundGain, SHOW_MS, SIGHS } from "./logic";

const PETAL_STYLES: { c1: string; c2: string; radius: string }[] = [
  { c1: "#f3dc8a", c2: "#c9983a", radius: "62% 38% 60% 40% / 45% 55% 45% 55%" },
  { c1: "#f4b4c8", c2: "#c9607e", radius: "40% 60% 38% 62% / 55% 45% 55% 45%" },
  { c1: "#a9d6f5", c2: "#4f8fc0", radius: "60% 40% 62% 38% / 45% 55% 45% 55%" },
  { c1: "#b5e8c6", c2: "#4aa56b", radius: "62% 38% 60% 40% / 45% 55% 45% 55%" },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function MemoryGame({ char, game, onOver, restarted, demo }: GameProps & { demo?: "idle" | "playing" | "over" }) {
  const { t } = useTranslation();
  const runRef = useRef(0);
  const seqRef = useRef<number[]>([]);
  const posRef = useRef(0);
  const scoreRef = useRef(0);
  const sighsRef = useRef(SIGHS);

  const [phase, setPhase] = useState<MemoryPhase>(demo === "playing" ? "input" : demo === "over" ? "over" : "idle");
  const [status, setStatus] = useState<string>(demo === "playing" ? t("memYourTurn") : "");
  const [sighsLeft, setSighsLeft] = useState<number>(demo === "over" ? 0 : SIGHS);
  const [litPetal, setLitPetal] = useState<number | null>(null);
  const [wrongPetal, setWrongPetal] = useState<number | null>(null);
  const [started, setStarted] = useState(Boolean(restarted || demo === "playing" || demo === "over"));

  const glow = async (i: number, ms = SHOW_MS) => {
    setLitPetal(i);
    await sleep(ms);
    setLitPetal((cur) => (cur === i ? null : cur));
  };

  const playSequence = async (id: number) => {
    setPhase("show");
    setStatus(t("memWatch"));
    await sleep(600);
    for (const i of seqRef.current) {
      if (id !== runRef.current) return;
      await glow(i);
      await sleep(GAP_MS);
    }
    if (id !== runRef.current) return;
    posRef.current = 0;
    setPhase("input");
    setStatus(t("memYourTurn"));
  };

  const begin = () => {
    const id = ++runRef.current;
    const init = freshMemory();
    seqRef.current = init.seq;
    posRef.current = 0;
    scoreRef.current = 0;
    sighsRef.current = SIGHS;
    setSighsLeft(SIGHS);
    setLitPetal(null);
    setWrongPetal(null);
    setStarted(true);
    void playSequence(id);
  };

  const press = async (i: number) => {
    if (phase !== "input") return;
    const id = runRef.current;
    if (i === seqRef.current[posRef.current]) {
      void glow(i, 280);
      posRef.current += 1;
      if (posRef.current === seqRef.current.length) {
        setPhase("busy");
        scoreRef.current += roundGain(seqRef.current.length);
        setStatus(t("memWellDone"));
        await sleep(1000);
        if (id !== runRef.current) return;
        seqRef.current.push(Math.floor(Math.random() * 4));
        await playSequence(id);
      }
      return;
    }
    setPhase("busy");
    setWrongPetal(i);
    sighsRef.current -= 1;
    setSighsLeft(sighsRef.current);
    await sleep(700);
    setWrongPetal(null);
    if (id !== runRef.current) return;
    if (sighsRef.current <= 0) {
      setPhase("over");
      setStatus("");
      onOver(scoreRef.current);
      return;
    }
    setStatus(t("memSigh"));
    await sleep(900);
    if (id !== runRef.current) return;
    await playSequence(id);
  };

  useEffect(() => {
    if (restarted && !demo) begin();
    return () => {
      runRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key >= "1" && e.key <= "4") void press(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const locked = phase !== "input";

  return (
    <>
      <img src={asset(char.stage)} alt="" className="h-auto max-h-[120px] w-24 object-contain [filter:drop-shadow(0_4px_0_rgba(0,0,0,0.3))]" />
      <p aria-live="polite" className="m-0 min-h-[1.5em] font-comic text-[1.05rem] text-white">
        {status}
      </p>
      <div role="group" aria-label={game.title} className="grid w-[min(300px,100%)] grid-cols-2 gap-3.5">
        {PETAL_STYLES.map((p, i) => {
          const isOn = litPetal === i;
          const isWrong = wrongPetal === i;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              aria-label={t("memPetal", { i: i + 1 })}
              onClick={() => void press(i)}
              style={
                {
                  "--c1": p.c1,
                  "--c2": p.c2,
                  borderRadius: p.radius,
                  background: "radial-gradient(circle at 35% 30%, var(--c1), var(--c2))",
                  boxShadow: isOn ? "0 0 26px 8px var(--c1), 3px 3px 0 rgba(0, 0, 0, 0.5)" : "3px 3px 0 rgba(0, 0, 0, 0.5)",
                } as CSSProperties
              }
              className={`aspect-square border-[3px] border-ink transition-[opacity,transform,box-shadow] duration-250 focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-white ${
                isOn
                  ? "scale-107 opacity-100"
                  : isWrong
                    ? "animate-shake opacity-25"
                    : "opacity-55 enabled:cursor-pointer enabled:hover:opacity-80 disabled:cursor-default"
              }`}
            />
          );
        })}
      </div>
      <p aria-live="polite" data-left={sighsLeft} className="m-0 min-h-[1.2em] text-[0.8rem] text-muted">
        {started ? t("memSighs", { count: sighsLeft }) : ""}
      </p>
      {!started && (
        <button
          type="button"
          onClick={begin}
          className="cursor-pointer rounded-xl border-2 border-ink bg-[var(--accent)] px-[22px] py-[9px] font-[inherit] font-bold text-ink shadow-[3px_3px_0_rgba(0,0,0,0.55)]"
        >
          {t("memBegin")}
        </button>
      )}
    </>
  );
}
