// Kamar Hantu (Ghost Room), 3D: a small low-poly room built from boxes/cylinders/cones, one slot per furniture piece, the four
// ghosts as company, a slowly orbiting camera you can nudge by dragging. Port of the 3D half of the old three/room.js.
// Loaded lazily by RoomPage (it pulls in three.js); Room2D.tsx is the flat version for devices without 3D.
import { type ReactNode, type RefObject, useMemo, useRef } from "react";
import type * as THREE from "three";
import type { Character, Lang } from "~/lib/content";
import { asset } from "~/lib/asset";
import { canvasTexture, GhostSprite, KitCanvas, KitLights, Particles, useDispose, useKitFrame } from "./scene-kit";
import { furnitureSlots, GHOST_SPOTS, wallPalette } from "./room-logic";
import { text3d } from "./text";

export interface RoomProps {
  items: string[];
  accent?: string;
  stage?: string;
  chars: Character[];
  lang: Lang;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
type V3 = [number, number, number];

function Box({ size, color, at, emissive }: { size: V3; color: string; at: V3; emissive?: [string, number] }) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} emissive={emissive?.[0]} emissiveIntensity={emissive?.[1]} />
    </mesh>
  );
}
function Cyl({ r, color, at, seg = 12, scaleZ = 1, emissive }: { r: [number, number, number]; color: string; at: V3; seg?: number; scaleZ?: number; emissive?: [string, number] }) {
  return (
    <mesh position={at} scale={[1, 1, scaleZ]}>
      <cylinderGeometry args={[r[0], r[1], r[2], seg]} />
      <meshLambertMaterial color={color} emissive={emissive?.[0]} emissiveIntensity={emissive?.[1]} />
    </mesh>
  );
}

function Poster() {
  const tex = useMemo(
    () =>
      canvasTexture(128, 176, (c, w, h) => {
        c.fillStyle = "#e8dcc0"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#2a2658"; c.fillRect(8, 8, w - 16, h - 16);
        c.fillStyle = "#f4f0c8"; c.beginPath(); c.arc(64, 64, 26, 0, 6.3); c.fill();
        c.fillStyle = "#2a2658"; c.beginPath(); c.arc(74, 58, 24, 0, 6.3); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.moveTo(40, 160); c.lineTo(40, 118); c.quadraticCurveTo(64, 82, 88, 118); c.lineTo(88, 160);
        c.lineTo(76, 148); c.lineTo(64, 160); c.lineTo(52, 148); c.closePath(); c.fill();
        c.fillStyle = "#2a2658"; c.fillRect(54, 120, 5, 8); c.fillRect(70, 120, 5, 8);
      }),
    [],
  );
  useDispose(tex);
  return (
    <>
      <Box size={[0.9, 1.25, 0.05]} color="#7a6a50" at={[0, 0, 0]} />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.8, 1.1]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </>
  );
}

function WindowPane() {
  const tex = useMemo(
    () =>
      canvasTexture(128, 128, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#050a28"); gr.addColorStop(1, "#2a2a68");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "#fff";
        for (let i = 0; i < 26; i++) c.fillRect((i * 53) % w, (i * 37 + i * i) % h, i % 4 ? 1.5 : 2.5, i % 4 ? 1.5 : 2.5);
        c.fillStyle = "#f4f0c8"; c.beginPath(); c.arc(88, 38, 13, 0, 6.3); c.fill();
        c.fillStyle = "#14184a"; c.beginPath(); c.arc(95, 34, 12, 0, 6.3); c.fill();
      }),
    [],
  );
  useDispose(tex);
  const frame = "#6a5a90";
  return (
    <>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.25, 1.25]} />
        <meshBasicMaterial map={tex} fog={false} />
      </mesh>
      <Box size={[1.45, 0.1, 0.1]} color={frame} at={[0, 0.68, 0.03]} />
      <Box size={[1.45, 0.1, 0.1]} color={frame} at={[0, -0.68, 0.03]} />
      <Box size={[0.1, 1.45, 0.1]} color={frame} at={[0.68, 0, 0.03]} />
      <Box size={[0.1, 1.45, 0.1]} color={frame} at={[-0.68, 0, 0.03]} />
      <Box size={[0.06, 1.3, 0.06]} color={frame} at={[0, 0, 0.04]} />
      <Box size={[1.3, 0.06, 0.06]} color={frame} at={[0, 0, 0.04]} />
    </>
  );
}

function Plant() {
  return (
    <>
      <Cyl r={[0.3, 0.22, 0.42]} color="#b86a4a" at={[0, 0.21, 0]} />
      <Cyl r={[0.27, 0.27, 0.04]} color="#3a2a20" at={[0, 0.42, 0]} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * 6.283;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, 0.8, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]}>
            <coneGeometry args={[0.1, 0.8, 5]} />
            <meshLambertMaterial color={i % 2 ? "#4a9a5a" : "#3a8a50"} />
          </mesh>
        );
      })}
    </>
  );
}

const BUILDERS: Record<string, () => ReactNode> = {
  "furn-lamp": () => (
    <>
      <Cyl r={[0.22, 0.26, 0.06]} color="#4a3a2a" at={[0, 0.03, 0]} />
      <Cyl r={[0.03, 0.03, 1.4]} color="#4a3a2a" at={[0, 0.75, 0]} seg={6} />
      <Cyl r={[0.18, 0.32, 0.4]} color="#ffd89a" at={[0, 1.6, 0]} seg={10} emissive={["#ffb050", 0.9]} />
      <pointLight color={0xffc27a} intensity={2.4} distance={9} decay={1.4} position={[0, 1.55, 0]} />
    </>
  ),
  "furn-rug": () => (
    <>
      <Cyl r={[1.3, 1.3, 0.04]} color="#a0405a" at={[0, 0, 0]} seg={24} scaleZ={0.7} />
      <Cyl r={[0.95, 0.95, 0.05]} color="#e8b0a0" at={[0, 0, 0]} seg={24} scaleZ={0.7} />
      <Cyl r={[0.7, 0.7, 0.06]} color="#7a2c44" at={[0, 0, 0]} seg={24} scaleZ={0.7} />
    </>
  ),
  "furn-poster": () => <Poster />,
  "furn-plant": () => <Plant />,
  "furn-window": () => <WindowPane />,
  "furn-bed": () => (
    <>
      <Box size={[1.5, 0.3, 2.3]} color="#7a5a3a" at={[0, 0.2, 0]} />
      <Box size={[1.4, 0.2, 2.2]} color="#d8d0f0" at={[0, 0.45, 0]} />
      <Box size={[1.42, 0.12, 1.4]} color="#7a68c8" at={[0, 0.58, 0.4]} />
      <Box size={[0.9, 0.16, 0.5]} color="#ffffff" at={[0, 0.62, -0.85]} />
      <Box size={[1.5, 0.9, 0.1]} color="#7a5a3a" at={[0, 0.6, -1.2]} />
    </>
  ),
};

interface Look {
  tAz: number;
  tEl: number;
}

function Room({ items, stage, chars, look }: RoomProps & { look: RefObject<Look> }) {
  const p = wallPalette(stage);
  const slots = furnitureSlots(items);
  const lamp = slots.find((s) => s.id === "furn-lamp");
  const ghosts = useRef<(THREE.Group | null)[]>([]);
  const cam = useRef({ offAz: 0, offEl: 0 });

  // ghosts bobbing in fixed spots; orbiting camera, nudged by dragging (angles clamped, damped)
  useKitFrame((dt, t, state) => {
    for (let i = 0; i < ghosts.current.length; i++) {
      const g = ghosts.current[i];
      if (g) g.position.y = GHOST_SPOTS[i][1] + Math.sin(t * 1.2 + i * 1.7) * 0.08;
    }
    const c = cam.current;
    const k = 1 - Math.exp(-dt * 5);
    c.offAz += (look.current.tAz - c.offAz) * k;
    c.offEl += (look.current.tEl - c.offEl) * k;
    const az = 0.6 + Math.sin(t * 0.12) * 0.2 + c.offAz;
    const el = 0.38 + c.offEl;
    const R = 8, tx = 0, ty = 1.1, tz = -0.2;
    state.camera.position.set(tx + R * Math.sin(az) * Math.cos(el), ty + R * Math.sin(el), tz + R * Math.cos(az) * Math.cos(el));
    state.camera.lookAt(tx, ty, tz);
  });

  return (
    <>
      {/* lights: the kit's lantern goes warm and dim when a real lamp exists */}
      <KitLights lantern={lamp ? 0.5 : 1.4} lanternAt={[0, 2.2, 3]} />
      {/* shell: floor + two walls, open toward the camera */}
      <Box size={[6, 0.2, 6]} color={p.floor} at={[0, -0.1, 0]} />
      <Box size={[6.3, 3.2, 0.15]} color={p.wall} at={[0, 1.6, -3.075]} />
      <Box size={[0.15, 3.2, 6]} color={p.wall} at={[-3.075, 1.6, 0]} />
      <Box size={[6, 0.14, 0.06]} color={p.trim} at={[0, 0.07, -2.97]} />
      <Box size={[0.06, 0.14, 6]} color={p.trim} at={[-2.97, 0.07, 0]} />
      {slots.map((s) => (
        <group key={s.id} position={[s.x, s.y, s.z]} rotation={[0, s.rot, 0]}>
          {BUILDERS[s.id]?.()}
        </group>
      ))}
      {chars.slice(0, 4).map((c, i) => (
        <GhostSprite key={c.id} url={asset(c.stage || c.head)} height={1.3} position={GHOST_SPOTS[i]} ref={(g) => void (ghosts.current[i] = g)} />
      ))}
      <Particles kind="dust" count={50} area={[6, 3, 6]} position={[0, 0, 2]} />
      <Particles kind="fireflies" count={14} area={[3, 1.8, 3]} position={[lamp ? lamp.x : 0, 0.5, (lamp ? lamp.z : 0) + 2]} />
    </>
  );
}

export default function GhostRoom({ items, accent = "#a47fd0", stage = "", chars, lang }: RoomProps) {
  const p = wallPalette(stage);
  const look = useRef<Look>({ tAz: 0, tEl: 0 });
  const drag = useRef<{ x: number; y: number; a: number; e: number } | null>(null);
  return (
    <div
      className="absolute inset-0 touch-none select-none"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, a: look.current.tAz, e: look.current.tEl };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        look.current.tAz = clamp(d.a - (e.clientX - d.x) * 0.006, -0.45, 0.45);
        look.current.tEl = clamp(d.e + (e.clientY - d.y) * 0.004, -0.15, 0.3);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <KitCanvas accent={accent} fogColor={p.fog} background={p.bg} fog={0.035}>
        <Room items={items} stage={stage} chars={chars} lang={lang} look={look} />
      </KitCanvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-sans text-xs leading-tight text-[#dfe6ffaa]">{text3d(lang).roomHint}</div>
    </div>
  );
}
