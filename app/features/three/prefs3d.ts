// The "3D scenes" setting (Me page): off by default; the player turns it on (and it only works where the device can do 3D).
// Same key and values as the old games/prefs3d.js ("ghost3d" = "on" | "off").
// Not a React hook despite the name (kept from the old module): it only reads storage, so call it after hydration.
import { getText, KEYS, setText } from "~/lib/storage";

export function use3d(): boolean {
  return getText(KEYS.prefs3d) === "on";
}

export const is3dEnabled = use3d;

export function set3d(on: boolean): void {
  setText(KEYS.prefs3d, on ? "on" : "off");
}
