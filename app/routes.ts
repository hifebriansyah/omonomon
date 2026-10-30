// The route table. Every page exists twice: English at the root and Indonesian under /id/ (same route file, its own id).
// scripts/site-paths.ts lists the addresses to pre-render; keep the two in step.
import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

function pages(lang: "en" | "id") {
  const id = (name: string) => (lang === "en" ? name : `id-${name}`);
  return [
    index("routes/home.tsx", { id: id("home") }),
    route("whispers", "routes/whispers.tsx", { id: id("whispers") }),
    route("whispers/:slug", "routes/whispers.tsx", { id: id("whispers-ghost") }),
    route("loved", "routes/loved.tsx", { id: id("loved") }),
    route("games", "routes/games.tsx", { id: id("games") }),
    route("games/:game", "routes/game.tsx", { id: id("game") }),
    route("room", "routes/room.tsx", { id: id("room") }),
    route("me", "routes/me.tsx", { id: id("me") }),
    route("privacy", "routes/privacy.tsx", { id: id("privacy") }),
    route(":slug", "routes/chat.tsx", { id: id("chat") }),
    route(":slug/history", "routes/chat.tsx", { id: id("chat-history") }),
    route(":slug/profile", "routes/profile.tsx", { id: id("profile") }),
  ];
}

export default [
  layout("routes/_app.tsx", [...pages("en"), ...prefix("id", pages("id"))]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
