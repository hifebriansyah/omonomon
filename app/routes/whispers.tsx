// /whispers/ (the feed; ?n=<id> opens one whisper) and /whispers/:slug/ (the same feed with that ghost's share picture: a shared
// whisper links there, because link previews read the static tags). worker/edge.js rewrites the tags of a ?n= link.
import type { Route } from "./+types/whispers";
import { WhispersFeed } from "~/features/whispers/WhispersFeed";
import { characterBySlug, shareImage } from "~/lib/content";
import { named, pageHead } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";
import { tr } from "~/i18n";

export const meta: Route.MetaFunction = ({ location, params }) => {
  const lang = langOfPath(location.pathname);
  const c = characterBySlug(params.slug);
  if (c) {
    return pageHead({ lang, path: localize(`/whispers/${c.slug}/`, lang), title: named(lang, "whispersOf", { name: c.name }), description: tr(lang, "whispersOfDescription", { name: c.name }), image: shareImage(c.id), indexed: false });
  }
  return pageHead({ lang, path: localize("/whispers/", lang), title: named(lang, "tabWhispers"), description: tr(lang, "whispersDescription"), indexed: false });
};

export default function Whispers() {
  return <WhispersFeed />;
}
