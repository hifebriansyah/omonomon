// The weekly boards on the games hub: one tab per ready game, the top 20 and (when signed in) the player's own place.
// Without the API there is no board, so the section stays hidden. Browser only (it reads the session): shown after hydration.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "~/components/ClientOnly";
import { accountsEnabled, fetchBoard, signedIn } from "~/features/account/account";
import type { Game } from "~/lib/content";
import { type Board, type BoardState, meNote } from "./leaderboard";

const loadBoard = (game: string) => fetchBoard(game) as unknown as Promise<Board | null>;

const pill = "cursor-pointer rounded-full border border-muted bg-transparent px-2.5 py-1 font-[inherit] text-[0.82rem] text-inherit aria-pressed:border-candle aria-pressed:bg-candle aria-pressed:text-[#1a1a1a]";

export function LeaderboardSection({
  games,
  enabled,
  isSignedIn,
  load = loadBoard,
}: {
  games: Pick<Game, "slug" | "title">[];
  /** Stories: show it without the API. Default: accountsEnabled(). */
  enabled?: boolean;
  /** Stories: pretend to be signed in. Default: signedIn(). */
  isSignedIn?: boolean;
  /** Stories: fake boards. Default: fetchBoard() from the account module. */
  load?: (game: string) => Promise<Board | null>;
}) {
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const on = hydrated && (enabled ?? accountsEnabled());
  const [game, setGame] = useState("");
  const [state, setState] = useState<BoardState>({ kind: "loading" });
  const asked = useRef(0);

  const show = useCallback(
    (slug: string) => {
      const n = ++asked.current; // a slow answer for an earlier tab must not replace the current one
      setGame(slug);
      setState({ kind: "loading" });
      load(slug).then(
        (board) => n === asked.current && setState(board ? { kind: "board", board } : { kind: "error" }),
        () => n === asked.current && setState({ kind: "error" }),
      );
    },
    [load],
  );

  const first = games[0]?.slug;
  useEffect(() => {
    if (on && first) show(first);
  }, [on, first, show]);

  if (!on) return null;
  const note = state.kind === "board" ? meNote(state.board, accountsEnabled() || enabled === true, isSignedIn ?? signedIn()) : null;
  const say = (text: string) => <p className="mt-2 mb-0 text-[0.8rem] text-muted">{text}</p>;

  return (
    <section className="mb-3.5 rounded-card bg-panel px-3.5 py-3" aria-labelledby="lbHead">
      <h2 id="lbHead" className="m-0 mb-2 text-[0.85rem] tracking-[0.06em] text-muted uppercase">
        {t("lbTitle")}
      </h2>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group">
        {games.map((g) => (
          <button key={g.slug} type="button" className={pill} aria-pressed={g.slug === game} onClick={() => show(g.slug)}>
            {g.title}
          </button>
        ))}
      </div>
      {state.kind === "loading" ? (
        say("…")
      ) : state.kind === "error" ? (
        say(t("lbError"))
      ) : !state.board.entries.length ? (
        say(t("lbEmpty"))
      ) : (
        <ol className="m-0 grid list-none gap-1 p-0">
          {state.board.entries.map((e) => (
            <li key={e.rank} className="flex gap-2.5 text-[0.92rem]">
              <span className="w-[2.4em] text-muted">#{e.rank}</span>
              {/* always text: a nickname is never HTML */}
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{e.nickname}</span>
              <span className="tabular-nums">{e.score}</span>
            </li>
          ))}
        </ol>
      )}
      {note && (
        <p className="mt-2 mb-0 text-[0.88rem] text-candle" aria-live="polite">
          {note.key === "lbYou" ? t("lbYou", { rank: note.rank, score: note.score }) : t("lbSignIn")}
        </p>
      )}
      {say(t("lbResets"))}
    </section>
  );
}
