import type { Route } from "./+types/room";
import { RoomPage } from "~/features/three/RoomPage";
import { named, pageHead } from "~/lib/head";
import { langOfPath, localize } from "~/lib/lang";
import { tr } from "~/i18n";

export const meta: Route.MetaFunction = ({ location }) => {
  const lang = langOfPath(location.pathname);
  return pageHead({ lang, path: localize("/room/", lang), title: named(lang, "roomTitle"), description: tr(lang, "roomDescription"), indexed: false });
};

export default function Room() {
  return <RoomPage />;
}
