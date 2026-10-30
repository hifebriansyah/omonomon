// The shared 3D kit (three.js from npm, drawn with React Three Fiber). Every 3D feature uses it and has a 2D fallback:
//
//   <KitCanvas accent fogColor background fog>   a canvas filling its positioned parent, fog, the moonlight + lantern rig
//     <KitLights lanternRef={...} />              (the rig is a component so a scene can move or dim the lantern)
//     <GhostSprite url={asset(c.stage)} height={1.6} />   a camera-facing picture with a soft glow
//     <Particles kind="fireflies" />              "fireflies" | "dust" | "mist"
//   useKitFrame((dt, t) => { ... })               every frame: seconds since the last frame (capped at 0.05) and total seconds
//
// Port of the old three/kit.js createKit(). What it does for you: pixel ratio capped at 2, no tone mapping (the old plain
// WebGLRenderer had none, R3F adds ACES by default), pauses when the canvas is off screen (and the browser pauses it when the tab
// is hidden), resize handling, and freeing GPU memory on unmount.
// Only import this file from lazily loaded scenes: it pulls in three.js.
import { Canvas, type RootState, useFrame } from "@react-three/fiber";
import { createContext, type CSSProperties, type ReactNode, type Ref, type RefObject, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface KitValue {
  accent: string;
  glow: THREE.Texture | null;
}
const KitContext = createContext<KitValue>({ accent: "#a47fd0", glow: null });

export interface KitOptions {
  accent?: string;
  fogColor?: string;
  background?: string;
  fog?: number;
  /** Highest pixel ratio (the chat backdrop uses 1.5). */
  dpr?: number;
  children?: ReactNode;
  style?: CSSProperties;
}

export function KitCanvas({ accent = "#a47fd0", fogColor = "#15142b", background = fogColor, fog = 0.06, dpr = 2, children, style }: KitOptions) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  // paused while off screen: no work at all
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting !== false));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={host} style={{ position: "absolute", inset: 0, touchAction: "none", ...style }}>
      <Canvas
        dpr={[1, dpr]}
        flat
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        // rotation given so R3F does not aim the camera at the origin: the old kit left it looking straight ahead
        camera={{ fov: 55, near: 0.1, far: 100, position: [0, 1.6, 5], rotation: [0, 0, 0] }}
        style={{ position: "absolute", inset: 0, display: "block", touchAction: "none" }}
      >
        <color attach="background" args={[background]} />
        <fogExp2 attach="fog" args={[fogColor, fog]} />
        <KitScope accent={accent}>{children}</KitScope>
      </Canvas>
    </div>
  );
}

// A soft round glow (a radial gradient drawn once), so a glow sprite is not a flat square.
function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

function KitScope({ accent, children }: { accent: string; children: ReactNode }) {
  const glow = useMemo(() => makeGlowTexture(), []);
  useEffect(() => () => glow.dispose(), [glow]);
  const value = useMemo(() => ({ accent, glow }), [accent, glow]);
  return <KitContext value={value}>{children}</KitContext>;
}

/** Called every frame with dt (seconds since the last frame, capped so a paused tab does not jump) and total seconds. */
export function useKitFrame(fn: (dt: number, t: number, state: RootState) => void, priority = 0) {
  useFrame((state, delta) => fn(Math.min(delta, 0.05), state.clock.elapsedTime, state), priority);
}

/** Frees a three.js object made with useMemo when the component goes away (R3F only frees what it made from JSX). */
export function useDispose(...things: ({ dispose(): void } | null | undefined)[]) {
  const latest = useRef(things);
  useEffect(() => {
    latest.current = things;
  });
  useEffect(() => () => latest.current.forEach((t) => t?.dispose()), []);
}

/** Draws on a canvas once and wraps it as an sRGB texture (posters, window skies). */
export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Light rig: cool moonlight from above, a warm lantern near the camera (no shadows: they cost too much on phones).
export function KitLights({
  moonRef,
  lanternRef,
  moon = 1.5,
  lantern = 1.6,
  lanternAt = [0, 1.8, 3],
}: {
  moonRef?: Ref<THREE.DirectionalLight>;
  lanternRef?: Ref<THREE.PointLight>;
  moon?: number;
  lantern?: number;
  lanternAt?: [number, number, number];
}) {
  return (
    <>
      <directionalLight ref={moonRef} color={0xb8c8ff} intensity={moon} position={[-3, 6, 2]} />
      <hemisphereLight args={[0xa0a8f0, 0x2a2850, 1.2]} />
      <pointLight ref={lanternRef} color={0xffc27a} intensity={lantern} distance={9} decay={1.6} position={lanternAt} />
    </>
  );
}

// A character picture standing in the scene, always facing the camera, with a faint glow behind it.
export function GhostSprite({ url, height = 1.6, ref, position, visible }: { url: string; height?: number; ref?: Ref<THREE.Group>; position?: [number, number, number]; visible?: boolean }) {
  const { accent, glow } = useContext(KitContext);
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [url]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group ref={ref} position={position} visible={visible}>
      <sprite scale={[height * 1.5, height * 1.5, 1]}>
        <spriteMaterial map={glow} color={accent} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite scale={[height, height, 1]}>
        <spriteMaterial map={tex} transparent fog />
      </sprite>
    </group>
  );
}

export type ParticleKind = "fireflies" | "dust" | "mist";
const LOOK: Record<ParticleKind, [number, number, number]> = { fireflies: [0xffe08a, 0.09, 0.9], dust: [0xdfe6ff, 0.04, 0.45], mist: [0xb9bfe8, 0.5, 0.08] };

function seedParticles(count: number, area: [number, number, number]) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * area[0];
    pos[i * 3 + 1] = Math.random() * area[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * area[2] - 2;
    seed[i] = Math.random() * 6.28;
  }
  return { pos, seed };
}

// Small drifting points: fireflies (warm, blinking), dust (pale, slow) or mist (large, faint, very slow).
export function Particles({
  kind = "fireflies",
  count = 60,
  area = [10, 4, 10],
  position,
  pointsRef,
  look,
}: {
  kind?: ParticleKind;
  count?: number;
  area?: [number, number, number];
  position?: [number, number, number];
  pointsRef?: RefObject<THREE.Points | null>;
  /** Overrides of the kind's look (the chat garden's pink petals are bigger dust). */
  look?: { color?: number; size?: number; opacity?: number };
}) {
  const [data] = useState(() => seedParticles(count, area));
  const own = useRef<THREE.Points>(null);
  const points = pointsRef ?? own;
  const mat = useRef<THREE.PointsMaterial>(null);
  const base = LOOK[kind];
  const speed = kind === "mist" ? 0.05 : kind === "dust" ? 0.12 : 0.3;
  useKitFrame((dt, t) => {
    const { pos, seed } = data;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += Math.sin(t * 0.4 + seed[i]) * speed * dt;
      pos[i * 3 + 1] += Math.cos(t * 0.5 + seed[i]) * speed * 0.5 * dt;
    }
    const attr = points.current?.geometry.getAttribute("position");
    if (attr) attr.needsUpdate = true;
    if (kind === "fireflies" && mat.current) mat.current.opacity = 0.55 + 0.4 * Math.sin(t * 2.2);
  });
  return (
    <points ref={points} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        color={look?.color ?? base[0]}
        size={look?.size ?? base[1]}
        transparent
        opacity={look?.opacity ?? base[2]}
        depthWrite={false}
        blending={kind === "fireflies" ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}
