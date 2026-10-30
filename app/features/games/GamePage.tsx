// One game's page (/games/<slug>/, no tab bar: like opening a chat). The title bar goes back to the hub and shows the
// candle wallet; below it the description, the framed play area with the game view, and how to play.
// When a run ends (onOver) the result is booked (recordRun), the score goes to the weekly board when signed in, and after
// 450 ms the result card covers the play area. Play again mounts the view anew (a new `key`: the old restart()).
import { Component, type ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBar } from "~/components/AppBar";
import { useHydrated } from "~/components/ClientOnly";
import { Page } from "~/components/Page";
import { startRun, submitScore } from "~/features/account/account";
import { loadMode } from "~/features/chat/history-store";
import { characterById, characters, type Game } from "~/lib/content";
import { localize, useLang } from "~/lib/lang";
import { pick } from "~/lib/util";
import { rememberLastGame } from "./last-game";
import { balance, load, recordRun, useProgress, useProgressReady } from "./progress";
import { ALL_DONE_BONUS, questLabel } from "./quests";
import { gameView } from "./registry";
import { Result, type ResultView } from "./Result";

const SHOW_RESULT_MS = 450;

// The frame of the play area, by kind of game (was .play, .play.memory, .play.rounds and .play.module in app.css).
const FRAME = "relative overflow-hidden rounded-card border-[3px] border-ink shadow-[4px_4px_0_rgba(0,0,0,0.55)]";
const frameFor = (type: Game["type"]) =>
  type === "memory"
    ? `${FRAME} grid justify-items-center gap-2.5 px-3.5 pt-[18px] pb-5 bg-[radial-gradient(circle_at_50%_0%,#2b2547,#17152b_70%)]`
    : type === "rounds"
      ? `${FRAME} grid justify-items-center gap-2.5 px-3.5 pt-[18px] pb-5 bg-[radial-gradient(circle_at_50%_0%,#2a2f4a,#15172a_70%)]`
      : type === "module"
        ? `${FRAME} min-h-[min(72vh,560px)] bg-[radial-gradient(circle_at_50%_0%,#2a2646,#15142b_70%)] text-[#f1f3f8]`
        : `${FRAME} bg-[#1a1838]`;

interface Run {
  n: number;
  best: number;
  reduceMotion: boolean;
}

export function GamePage({ game }: { game: Game }) {
  const lang = useLang();
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const progress = useProgress();
  const progressReady = useProgressReady();
  const char = characterById(game.character)!;
  const View = gameView(game);

  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [showResult, setShowResult] = useState(false);
  const token = useRef<Promise<string | null>>(Promise.resolve(null)); // the weekly board only accepts a score with the token of its run
  const shownId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const againRef = useRef<HTMLButtonElement>(null);

  // the first run starts after hydration: the best score and the motion setting live in the browser
  useEffect(() => {
    token.current = startRun(game.slug);
    setRun({ n: 0, best: load().best[game.slug] || 0, reduceMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
    return () => clearTimeout(timer.current);
  }, [game.slug]);

  useEffect(() => {
    if (showResult) againRef.current?.focus();
  }, [showResult]);

  // What happens when a run ends (the same for every kind of game).
  const onOver = useCallback(
    (score: number, opts: { char?: string } = {}) => {
      const runToken = token.current;
      rememberLastGame(game.slug);
      const r = recordRun(game.slug, opts.char || char.id, score, characters, game.scorePerCandle);
      const [lowTier, midTier] = game.tiers || [200, 600]; // score limits for the "low" and "mid" reactions
      const recordMin = game.recordMin ?? 100; // from this score on, a new best gets the "record" reaction
      const tier = score < lowTier ? "low" : score < midTier ? "mid" : "high";
      const badgeNames = t("badges", { returnObjects: true }) as Record<string, readonly string[]>;
      const view: ResultView = {
        title: r.newBest && r.best > 0 && score > 0 ? t("record") : game.overTitle?.[lang] || t("over"),
        score: `${t("score")} ${score} · ${t("best")} ${r.best}`,
        reward: [t("reward", { count: r.candles, xp: r.xp }), r.capped ? t("capped") : "", r.levelAfter > r.levelBefore ? t("levelUp", { l: r.levelAfter }) : ""]
          .filter(Boolean)
          .join(" "),
        quests: [
          r.hosted ? t("eventDouble") : "",
          r.weeklyReward ? t("eventPaid", { c: r.weeklyReward }) : "",
          ...r.badges.map((id) => t("badgeUnlocked", { name: badgeNames[id]?.[0] || id })),
          ...r.completed.map((q) => t("questDone", { label: questLabel(q, lang, characters), candles: q.reward })),
          r.allDone ? t("allQuestsDone", { bonus: ALL_DONE_BONUS }) : "",
          r.completed.length && r.streak ? t("streakDays", { count: r.streak }) : "",
        ].filter(Boolean),
        say: pick((r.newBest && score >= recordMin ? game.reactions.record : game.reactions[tier])[lang]),
        chatTo: localize(loadMode(char.id) === "history" ? `/${char.slug}/history/` : `/${char.slug}/`, lang),
        name: char.name,
      };
      const id = ++shownId.current;
      setResult(view);
      runToken
        .then((tk) => submitScore(game.slug, score, tk))
        .then((b) => {
          if (!b || id !== shownId.current) return;
          const extra = b.accepted && b.rank !== undefined ? t("lbRank", { rank: b.rank }) : b.refused ? t("lbBad") : "";
          if (extra) setResult((v) => (v ? { ...v, quests: [...v.quests, extra] } : v));
        })
        .catch(() => {});
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShowResult(true), SHOW_RESULT_MS);
    },
    [game, char, lang, t],
  );

  const again = () => {
    clearTimeout(timer.current);
    setShowResult(false);
    token.current = startRun(game.slug);
    setRun((r) => ({ n: (r?.n ?? 0) + 1, best: load().best[game.slug] || 0, reduceMotion: r?.reduceMotion ?? false }));
  };

  const description = ((lang === "id" && game.id?.description) || game.description).replaceAll("{name}", char.name);
  const placeholder = game.type === "runner" || game.type === "catch" ? <div className="aspect-video" /> : null;

  return (
    <Page accent={char.accent}>
      <AppBar title={game.title} back={localize("/games/", lang)} backLabel={t("backGames")}>
        <p className="m-0 ml-auto text-[0.92rem] whitespace-nowrap text-text" aria-live="polite">
          {hydrated && progressReady ? `${t("candles")}: ${balance(progress)}` : ""}
        </p>
      </AppBar>
      <section>
        <p className="m-0 mb-4 text-soft">{description}</p>
        <div className={frameFor(game.type)}>
          <GameErrors message={(error) => t("gameStartError", { error })}>
            {View && run ? (
              <Suspense fallback={placeholder}>
                {game.type === "module" ? (
                  <div className="relative min-h-[inherit] w-full">
                    <View key={run.n} onOver={onOver} lang={lang} char={char} chars={characters} best={run.best} reduceMotion={run.reduceMotion} game={game} restarted={run.n > 0} />
                  </div>
                ) : (
                  <View key={run.n} onOver={onOver} lang={lang} char={char} chars={characters} best={run.best} reduceMotion={run.reduceMotion} game={game} restarted={run.n > 0} />
                )}
              </Suspense>
            ) : (
              placeholder
            )}
          </GameErrors>
          {result && showResult && <Result view={result} onAgain={again} againRef={againRef} />}
        </div>
        <p className="m-0 mt-2.5 text-center text-[0.9rem] text-muted">{game.how[lang]}</p>
        <noscript>
          <p>{t("needsJs")}</p>
        </noscript>
      </section>
    </Page>
  );
}

// A game that cannot load (offline before it was cached, a broken build) says so instead of leaving an empty frame.
class GameErrors extends Component<{ children: ReactNode; message: (error: string) => string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    return this.state.error ? <p className="m-0 p-4 text-center text-muted">{this.props.message(this.state.error)}</p> : this.props.children;
  }
}
