// Keyboard focus rings only while someone is really tabbing between controls: Tab adds .using-tab to <html>, a pointer removes it.
import { useEffect } from "react";

export function useFocusRings() {
  useEffect(() => {
    const root = document.documentElement;
    const key = (e: KeyboardEvent) => e.key === "Tab" && root.classList.add("using-tab");
    const pointer = () => root.classList.remove("using-tab");
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
    };
  }, []);
}
