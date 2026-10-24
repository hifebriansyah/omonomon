// The "3D scenes" setting (Me page): on by default only on capable devices (4 GB or more and 4+ cores); the player can switch it.
const KEY = "ghost3d";

export function use3d() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch {}
  return (navigator.deviceMemory || 0) >= 4 && (navigator.hardwareConcurrency || 0) >= 4;
}

export function set3d(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
}
