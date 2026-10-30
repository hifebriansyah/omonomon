// Renders its children only in the browser, after hydration. Use it for anything that reads localStorage, window, WebGL, AdSense or
// Google sign-in, so the pre-rendered HTML and the first browser render match.
import { type ReactNode, useSyncExternalStore } from "react";

const subscribe = () => () => {};
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

export function ClientOnly({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  return useHydrated() ? children() : fallback;
}
