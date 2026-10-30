// The last game opened, for the "Continue" shortcut on the games hub (was games/hub.js; not hub.ts, which would clash with Hub.tsx on a case-insensitive disk).
import { getText, KEYS, setText } from "~/lib/storage";

export const rememberLastGame = (slug: string) => setText(KEYS.lastGame, slug);
export const lastGame = () => getText(KEYS.lastGame) || "";
