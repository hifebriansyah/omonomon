// The flat SVG cutaway version of Kamar Hantu (Ghost Room) for devices without WebGL2 or with reduced motion (was mount2D in three/room.js).
import type { CSSProperties } from "react";
import { asset } from "~/lib/asset";
import type { Character } from "~/lib/content";
import { furnitureSlots, wallPalette } from "./room-logic";

const SHAPES: Record<string, string> = {
  "furn-window": `<rect x="58" y="43" width="84" height="84" rx="3" fill="#6a5a90"/><rect x="64" y="49" width="72" height="72" fill="#0b1238"/><circle cx="114" cy="72" r="9" fill="#f4f0c8"/><circle cx="118" cy="69" r="8" fill="#0b1238"/><g fill="#fff"><circle cx="78" cy="62" r="1.5"/><circle cx="96" cy="100" r="1.5"/><circle cx="124" cy="104" r="1.2"/><circle cx="82" cy="88" r="1.2"/></g><path d="M100 49v72M64 85h72" stroke="#6a5a90" stroke-width="3"/>`,
  "furn-poster": `<rect x="238" y="48" width="62" height="82" fill="#e8dcc0" stroke="#7a6a50" stroke-width="3"/><rect x="244" y="54" width="50" height="70" fill="#2a2658"/><circle cx="269" cy="80" r="11" fill="#f4f0c8"/><path d="M257 124v-18q12-18 24 0v18l-4-4-4 4-4-4-4 4-4-4z" fill="#fff" opacity=".9"/>`,
  "furn-lamp": `<circle cx="205" cy="150" r="46" fill="#ffc27a" opacity=".16"/><rect x="203" y="150" width="4" height="78" fill="#4a3a2a"/><ellipse cx="205" cy="229" rx="14" ry="4" fill="#4a3a2a"/><path d="M190 152l6-24h18l6 24z" fill="#ffd89a"/>`,
  "furn-rug": `<ellipse cx="140" cy="228" rx="112" ry="20" fill="#a0405a"/><ellipse cx="140" cy="228" rx="84" ry="14" fill="none" stroke="#e8b0a0" stroke-width="3"/><ellipse cx="140" cy="228" rx="52" ry="8" fill="#7a2c44"/>`,
  "furn-plant": `<path d="M24 190q-18-30 0-48q4 30 10 38zM30 190q4-34 24-42q-6 30-16 42zM28 190q-2-40 6-56q10 24 0 56z" fill="#4a9a5a"/><path d="M14 190h28l-4 36H18z" fill="#b86a4a"/>`,
  "furn-bed": `<rect x="262" y="176" width="124" height="46" rx="4" fill="#7a5a3a"/><rect x="266" y="164" width="120" height="30" rx="6" fill="#d8d0f0"/><rect x="266" y="176" width="86" height="22" rx="4" fill="#7a68c8"/><rect x="270" y="166" width="30" height="14" rx="6" fill="#fff"/><rect x="262" y="222" width="6" height="10" fill="#4a3a2a"/><rect x="380" y="222" width="6" height="10" fill="#4a3a2a"/>`,
};
const ORDER_2D = ["furn-window", "furn-poster", "furn-rug", "furn-lamp", "furn-plant", "furn-bed"]; // back to front
const LEFT = [16, 38, 62, 86];
const TOP = [52, 60, 54, 62];

export function Room2D({ items, accent = "#a47fd0", stage = "", chars }: { items: string[]; accent?: string; stage?: string; chars: Character[] }) {
  const p = wallPalette(stage);
  const owned = new Set(furnitureSlots(items).map((s) => s.id));
  const shapes = ORDER_2D.filter((id) => owned.has(id))
    .map((id) => SHAPES[id])
    .join("");
  return (
    <div className="relative mx-auto aspect-[400/260] h-full max-w-[640px] w-full" style={{ "--ra": accent } as CSSProperties}>
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        className="absolute inset-0 size-full"
        dangerouslySetInnerHTML={{
          __html: `<rect width="400" height="260" fill="${p.bg}"/><rect x="10" y="10" width="380" height="188" fill="${p.wall}"/><path d="M10 198h380l10 52H0z" fill="${p.floor}"/><rect x="10" y="194" width="380" height="6" fill="${p.trim}"/>${shapes}`,
        }}
      />
      {chars.slice(0, 4).map((c, i) => (
        <img
          key={c.id}
          src={asset(c.stage || c.head)}
          alt=""
          style={{
            left: `${LEFT[i]}%`,
            top: `${TOP[i]}%`,
            animationDelay: `${i * 0.6}s`,
            filter: "drop-shadow(0 0 8px var(--ra, #a47fd0))",
          }}
          className="absolute h-auto w-[15%] -translate-x-1/2 animate-bob motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
