// Runs once per visit from the app layout (routes/_app.tsx), after hydration:
// - signed in: bring the account's progress in (the old shell/main.js refresh() on load)
// - from then on, every progress save is copied to the account (the old onChange in games/account.js)
import { useEffect } from "react";
import { onChange } from "~/features/games/progress";
import { refresh, saveToAccount } from "./account";

let started = false;

export function useAccountSync() {
  useEffect(() => {
    if (started) return; // once per visit, also under StrictMode's double effects
    started = true;
    onChange(saveToAccount);
    refresh().catch(() => {}); // the progress store redraws the numbers when replace() saves the merged progress
  }, []);
}
