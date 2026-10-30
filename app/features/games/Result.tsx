// The card over the play area when a run ends: title, score and best, rewards, quests, the ghost's line, Play again and Chat.
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export interface ResultView {
  title: string;
  score: string;
  reward: string;
  /** reward lines after the run (event, badges, quests, streak, weekly rank), joined with " · " */
  quests: string[];
  say: string;
  /** where "Chat with <name>" goes (her chat in the view she left it in) */
  chatTo: string;
  name: string;
}

const action = "cursor-pointer rounded-xl border-2 border-ink px-4 py-2 font-[inherit] font-bold text-ink no-underline shadow-[3px_3px_0_rgba(0,0,0,0.55)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_rgba(0,0,0,0.55)]";

export function Result({ view, onAgain, againRef }: { view: ResultView; onAgain: () => void; againRef?: Ref<HTMLButtonElement> }) {
  const { t } = useTranslation();
  const quests = view.quests.join(" · ");
  return (
    <div className="absolute inset-0 z-10 grid place-content-center gap-1 bg-[rgba(20,21,26,0.86)] p-4 text-center">
      <h2 className="m-0 font-comic text-2xl">{view.title}</h2>
      <p className="m-0">{view.score}</p>
      <p className="m-0">{view.reward}</p>
      {quests && <p className="m-0 text-[0.82rem] text-candle">{quests}</p>}
      <p className="m-0 mt-1.5 font-comic text-white">{view.say}</p>
      <div className="mt-3 flex justify-center gap-2.5">
        <button ref={againRef} type="button" className={`${action} bg-[var(--accent)]`} onClick={onAgain}>
          {t("again")}
        </button>
        <Link to={view.chatTo} className={`${action} bg-paper`}>
          {t("chatWith", { name: view.name })}
        </Link>
      </div>
    </div>
  );
}
