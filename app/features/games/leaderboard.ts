// The weekly boards on the games hub: one tab per game, the top 20 and (when signed in) the player's own place.
// The data comes from fetchBoard() in features/account/account.ts; this file only knows its shape.

export interface BoardEntry {
  rank: number;
  nickname: string;
  score: number;
}
export interface Board {
  entries: BoardEntry[];
  me: { rank: number; score: number } | null;
}
export type BoardState = { kind: "loading" } | { kind: "error" } | { kind: "board"; board: Board };

// What the line under the board says: your place, a nudge to sign in, or nothing.
export function meNote(board: Board, accountsOn: boolean, signedIn: boolean): { key: "lbYou"; rank: number; score: number } | { key: "lbSignIn" } | null {
  if (board.me) return { key: "lbYou", rank: board.me.rank, score: board.me.score };
  return accountsOn && !signedIn ? { key: "lbSignIn" } : null;
}
