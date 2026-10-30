import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { type InlineConfig, type PluginOption, mergeConfig } from "vite";

// Storybook builds the components with its own Vite config: Tailwind and the ~ alias, but not the React Router plugin.
// It is published with the site at /storybook/ (scripts/postbuild.ts), kept out of the sitemap and the precache.
// The React Router plugin (from vite.config.ts) only works in the app build.
function withoutReactRouter(base: InlineConfig): InlineConfig {
  const keep = (p: PluginOption): PluginOption => (Array.isArray(p) ? p.map(keep) : p && typeof p === "object" && "name" in p && String(p.name).startsWith("react-router") ? false : p);
  return { ...base, plugins: (base.plugins || []).map(keep) };
}

const config: StorybookConfig = {
  stories: ["../app/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  viteFinal: (base) =>
    mergeConfig(withoutReactRouter(base), {
      base: "./",
      plugins: [tailwindcss()],
      resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
    }),
};
export default config;
