import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { omonContent } from "./scripts/vite-content.ts";
import { basePath } from "./scripts/base-path.ts";

// Old browsers are not supported (see app/components/OldBrowserBanner.tsx): the floor is what Tailwind CSS 4 needs.
const TARGET = ["safari16.4", "chrome111", "firefox128"];

// Public values only. A VITE_ name with TOKEN, SECRET or KEY in it is refused, so a secret from .env never reaches the browser.
const PUBLIC_KEYS = new Set(["VITE_TURNSTILE_SITE_KEY", "VITE_VAPID_PUBLIC_KEY"]);
function checkEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const bad = Object.keys(env).filter((k) => /TOKEN|SECRET|KEY/.test(k) && !PUBLIC_KEYS.has(k));
  if (bad.length) throw new Error(`These VITE_ values look secret and would be sent to every browser: ${bad.join(", ")}`);
}

export default defineConfig(({ mode, isSsrBuild }) => {
  checkEnv(mode);
  return {
    base: basePath(),
    plugins: [tailwindcss(), omonContent(), reactRouter()],
    resolve: { alias: { "~": new URL("./app", import.meta.url).pathname } },
    build: { emptyOutDir: false, target: isSsrBuild ? "node24" : TARGET },
    server: { fs: { allow: ["."] } },
  };
});
