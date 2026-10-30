import type { Config } from "@react-router/dev/config";
import { basePath } from "./scripts/base-path.ts";
import { publicPaths } from "./scripts/site-paths.ts";

// A single-page app with one pre-rendered HTML file per address (both languages), so every page keeps its own head.
export default {
  ssr: false,
  basename: basePath(),
  // without the trailing slash: React Router compares them that way (the files are still <path>/index.html)
  prerender: () => publicPaths().map((p) => (p.path === "/" ? "/" : p.path.replace(/\/$/, ""))),
} satisfies Config;
