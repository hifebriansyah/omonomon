// Tebak Hantu: the view. Today's ten lines come from dailySet() in logic.ts; this shows one at a time with the four ghosts to pick.
import { useEffect, useRef, useState } from "react";
import { asset } from "~/lib/asset";
import { pick as pickOne } from "~/lib/util";
import type { GameProps } from "../types";
import { answerPoints, dailySet, IDS, QUESTIONS, type Question } from "./logic";
import { TEXT } from "./text";
import "./guess-the-ghost.css";

/** Storybook only: `date` fixes the day's set, `resume` starts part-way through. The page always starts today's set from line 1. */
export interface Resume {
  idx: number;
  score: number;
  streak: number;
  picked?: string;
}

export default function Game({ onOver, lang: pageLang, char, chars: allChars, reduceMotion, date, resume }: GameProps & { date?: string; resume?: Resume }) {
  const lang = pageLang === "id" ? "id" : "en";
  const L = TEXT[lang];
  const chars = IDS.map((id) => allChars.find((c) => String(c.id) === id) || { id, name: id, head: "" });
  const [qs] = useState<Question[]>(() => (date ? dailySet(date) : dailySet()));
  const [idx, setIdx] = useState(resume?.idx ?? 0);
  const [score, setScore] = useState(resume?.score ?? 0);
  const [streak, setStreak] = useState(resume?.streak ?? 0);
  const [picked, setPicked] = useState<string | null>(resume?.picked ?? null); // the ghost picked for this line (null: not answered yet)
  const [feedback, setFeedback] = useState("");
  const tally = useRef<Record<string, number>>({});
  const lastRight = useRef<string | null>(null);
  const over = useRef(false);
  const nextBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (picked !== null) nextBtn.current?.focus();
  }, [picked]);

  const q = qs[idx];

  function choose(id: string) {
    if (picked !== null || over.current) return;
    const ok = id === q.ghost;
    setScore((s) => s + answerPoints(ok, streak));
    setStreak(ok ? streak + 1 : 0);
    if (ok) {
      tally.current[id] = (tally.current[id] || 0) + 1;
      lastRight.current = id;
    }
    const right = chars.find((c) => c.id === q.ghost)!;
    setFeedback(`${ok ? L.right : L.wrong(right.name)} ${pickOne(ok ? L.right_r : L.wrong_r)}`);
    setPicked(id);
  }

  function advance() {
    if (picked === null || over.current) return;
    if (idx < QUESTIONS - 1) {
      setIdx(idx + 1);
      setPicked(null);
      setFeedback("");
      return;
    }
    over.current = true;
    // bond XP goes to the ghost whose line the player got right most (last correct one on a tie / none)
    let best = lastRight.current,
      n = 0;
    for (const [g, c] of Object.entries(tally.current))
      if (c > n || (c === n && g === lastRight.current)) {
        best = g;
        n = c;
      }
    onOver(score, { char: best || char?.id || "4" });
  }

  return (
    <div className={`th${reduceMotion ? " th-still" : ""}`}>
      <div className="th-top">
        <span>{L.q(idx + 1)}</span>
        <span>{`${L.score}: ${score} · ${L.streak}: ${streak}`}</span>
      </div>
      {/* keyed by the line, so each new line pops in */}
      <div key={idx} className="th-line th-pop">
        {q[lang]}
      </div>
      <div className="th-who">{L.who}</div>
      <div className="th-grid">
        {chars.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`th-opt${picked !== null && c.id === q.ghost ? " ok" : picked !== null && c.id === picked ? " bad" : ""}`}
            aria-label={c.name}
            disabled={picked !== null}
            onClick={() => choose(c.id)}
          >
            <img alt="" src={c.head ? asset(c.head) : undefined} />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
      <div className="th-fb" aria-live="polite">
        {feedback}
      </div>
      <button ref={nextBtn} type="button" className="th-next" hidden={picked === null} onClick={advance}>
        {idx === QUESTIONS - 1 ? L.last : L.next}
      </button>
    </div>
  );
}
