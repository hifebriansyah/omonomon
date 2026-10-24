// The "3D scenes" setting (Me page): off by default; the player turns it on (and it only works where the device can do 3D).
const KEY = "ghost3d";

export function use3d() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch {}
  return false;
}

export function set3d(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
}
