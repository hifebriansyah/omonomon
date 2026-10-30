// Daily Challenge view component.
import { useMemo } from "react";
import CatchGame from "../catch/Game";
import RunnerGame from "../runner/Game";
import type { GameProps } from "../types";
import { dateString, makeRng, seedOf, todaysPick } from "./logic";
import { TEXT } from "./text";

export default function DailyGame(props: GameProps & { forceDate?: string; demo?: "playing" | "over" }) {
  const { lang, chars, char, best, reduceMotion, game, restarted, onOver, forceDate, demo } = props;
  const t = TEXT[lang] || TEXT.en;
  const date = forceDate || dateString();
  const pick = todaysPick(date);
  const dailyChar = chars.find((c) => c.id === pick.char) || char;
  const rng = useMemo(() => makeRng(seedOf(date)), [date]);

  const innerGame = useMemo(
    () => ({
      ...game,
      startText: { en: TEXT.en.start, id: TEXT.id.start },
    }),
    [game],
  );

  return (
    <div className="grid justify-items-center gap-2 p-2.5">
      <p className="m-0 font-bold">{t.head(t.games[pick.game])}</p>
      <small className="opacity-70">{`${t.same} (${date})`}</small>
      <div className="w-full max-w-[480px] overflow-hidden rounded-[10px] bg-[#15142b]">
        {pick.game === "hop-hop" ? (
          <RunnerGame
            char={dailyChar}
            chars={chars}
            best={best}
            reduceMotion={reduceMotion}
            game={innerGame}
            lang={lang}
            restarted={restarted}
            demo={demo}
            rng={rng}
            onOver={(score) => onOver(score, { char: dailyChar.id })}
          />
        ) : (
          <CatchGame
            char={dailyChar}
            chars={chars}
            best={best}
            reduceMotion={reduceMotion}
            game={innerGame}
            lang={lang}
            restarted={restarted}
            demo={demo}
            rng={rng}
            onOver={(score) => onOver(score, { char: dailyChar.id })}
          />
        )}
      </div>
    </div>
  );
}
