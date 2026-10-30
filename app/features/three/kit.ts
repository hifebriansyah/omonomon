// The 3D check every 3D feature runs before it loads three.js. This file must never import three: the chat page, the games
// and the Ghost Room call canUse3D() up front and only then lazy-load the scene (scene-kit.tsx and the scenes import three).
//
//   if (!canUse3D()) { /* show the 2D version */ }
//   else { /* <Suspense><LazyScene /></Suspense>, inside a <ThreeBoundary> that falls back to 2D if WebGL still fails */ }

let webgl2: boolean | null = null;

// three.js r163+ only draws with WebGL2, so a phone with only WebGL1 gets the 2D version (the old r160 kit accepted WebGL1 too).
// Probed once: every probe costs a WebGL context, and browsers only allow a few at a time.
function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    webgl2 = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

// True when this device can show the 3D version: WebGL2 works, the player has not asked to save data or reduce motion, and the
// device is not a very low-end one. Games fall back to their 2D version otherwise. Always false during pre-render.
export function canUse3D(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    if (nav.connection?.saveData) return false;
    if (nav.deviceMemory && nav.deviceMemory <= 2) return false;
    return hasWebGL2();
  } catch {
    return false;
  }
}
