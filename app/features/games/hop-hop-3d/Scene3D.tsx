// Hop Hop 3D R3F scene (lazy-loaded by hop-hop-3d/Game.tsx).
import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { GhostSprite, KitCanvas, KitLights, Particles, useKitFrame } from "~/features/three/scene-kit";
import { asset } from "~/lib/asset";
import type { Character, Lang } from "~/lib/content";
import { createEngine, type Hop3DEngine, LANE_W, type ObstacleKind } from "./logic";
import { TEXT } from "./text";

const LEN = 64;
const POOL_SIZE = 14;

function TombMesh({ groupRef }: { groupRef: (g: THREE.Group | null) => void }) {
  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.3]} />
        <meshLambertMaterial color={0x7d7f9c} flatShading />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.7, 0.2, 0.3]} />
        <meshLambertMaterial color={0x4f6a5a} flatShading />
      </mesh>
    </group>
  );
}

function CrossMesh({ groupRef }: { groupRef: (g: THREE.Group | null) => void }) {
  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.16, 0.8, 0.16]} />
        <meshLambertMaterial color={0x5b4636} flatShading />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.55, 0.14, 0.16]} />
        <meshLambertMaterial color={0x5b4636} flatShading />
      </mesh>
    </group>
  );
}

function BranchMesh({ groupRef }: { groupRef: (g: THREE.Group | null) => void }) {
  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[1.5, 0.2, 0.2]} />
        <meshLambertMaterial color={0x5b4636} flatShading />
      </mesh>
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.65, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.12, 0.9, 5]} />
          <meshLambertMaterial color={0x5b4636} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function RunnerWorld({
  engRef,
  char,
  onScore,
  onCrash,
  onHideHint,
}: {
  engRef: React.RefObject<Hop3DEngine>;
  char: Character;
  onScore: (s: number) => void;
  onCrash: (s: number) => void;
  onHideHint: () => void;
}) {
  const ghostRef = useRef<THREE.Group>(null);
  const pools = useRef<Record<ObstacleKind, (THREE.Group | null)[]>>({ tomb: [], cross: [], branch: [] });
  const dashes = useRef<(THREE.Mesh | null)[]>([]);
  const scenery = useRef<(THREE.Group | null)[]>([]);
  const reportedRef = useRef(false);
  const shownScoreRef = useRef(-1);
  const shakeRef = useRef(0);
  const hintTRef = useRef(0);
  const hintHiddenRef = useRef(false);

  const dashSpecs = useMemo(
    () => Array.from({ length: 32 }, (_, i) => ({ i, d0: (i >> 1) * 4, x: ((i & 1 ? 1 : -1) * LANE_W) / 2 })),
    [],
  );
  const scenerySpecs = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        i,
        tree: Boolean(i % 2),
        h: 0.7 + (i % 3) * 0.2,
        d0: i * (LEN / 26),
        x: (i % 4 < 2 ? -1 : 1) * (3.8 + ((i * 37) % 10) * 0.35),
      })),
    [],
  );

  useKitFrame((dt, t, state) => {
    const e = engRef.current;
    if (!e.over) e.step(dt);
    if (e.over && !reportedRef.current) {
      reportedRef.current = true;
      shakeRef.current = 0.5;
      onCrash(e.score);
    }
    if (e.score !== shownScoreRef.current) {
      shownScoreRef.current = e.score;
      onScore(e.score);
    }
    if (e.t > 0.3 && !hintHiddenRef.current) {
      hintTRef.current += dt;
      if (hintTRef.current > 4) {
        hintHiddenRef.current = true;
        onHideHint();
      }
    }

    const used: Record<ObstacleKind, number> = { tomb: 0, cross: 0, branch: 0 };
    for (const k of ["tomb", "cross", "branch"] as const) {
      for (const g of pools.current[k]) if (g) g.visible = false;
    }
    for (const o of e.obs) {
      const g = pools.current[o.kind][used[o.kind]++];
      if (!g) continue;
      g.visible = true;
      g.position.set(o.lane * LANE_W, 0, -(o.d - e.d));
    }

    for (const s of scenerySpecs) {
      const g = scenery.current[s.i];
      if (g) g.position.set(s.x, 0, -((((s.d0 - e.d) % LEN) + LEN) % LEN));
    }
    for (const s of dashSpecs) {
      const m = dashes.current[s.i];
      if (m) m.position.set(s.x, 0.02, -((((s.d0 - e.d) % LEN) + LEN) % LEN));
    }
    if (ghostRef.current) {
      ghostRef.current.position.set(
        e.x,
        0.75 + e.y + (e.over ? -0.2 : e.y === 0 ? Math.abs(Math.sin(t * 11)) * 0.1 : 0),
        0,
      );
    }
    shakeRef.current = Math.max(0, shakeRef.current - dt);
    const sh = shakeRef.current;
    state.camera.position.set(e.x * 0.45 + (Math.random() - 0.5) * sh * 0.4, 2.3 + (Math.random() - 0.5) * sh * 0.3, 5.2);
    state.camera.lookAt(e.x * 0.2, 0.9, -7);
  });

  return (
    <>
      <KitLights />
      <mesh position={[0, 0, -55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 140]} />
        <meshLambertMaterial color={0x3a3568} flatShading />
      </mesh>
      <mesh position={[0, 0.01, -55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LANE_W * 3 + 0.4, 140]} />
        <meshLambertMaterial color={0x544c8a} flatShading />
      </mesh>
      {dashSpecs.map((s) => (
        <mesh
          key={s.i}
          ref={(m) => {
            dashes.current[s.i] = m;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.08, 1.2]} />
          <meshLambertMaterial color={0x9a93d6} flatShading />
        </mesh>
      ))}
      {scenerySpecs.map((s) => (
        <group
          key={s.i}
          ref={(g) => {
            scenery.current[s.i] = g;
          }}
        >
          {s.tree ? (
            <>
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshLambertMaterial color={0x5b4636} flatShading />
              </mesh>
              <mesh position={[0, 1.9, 0]}>
                <coneGeometry args={[0.9, 2.6, 6]} />
                <meshLambertMaterial color={0x1f2b36} flatShading />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[0.8, s.h, 0.25]} />
              <meshLambertMaterial color={0x7d7f9c} flatShading />
            </mesh>
          )}
        </group>
      ))}
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <TombMesh
          key={`t-${i}`}
          groupRef={(g) => {
            pools.current.tomb[i] = g;
          }}
        />
      ))}
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <CrossMesh
          key={`c-${i}`}
          groupRef={(g) => {
            pools.current.cross[i] = g;
          }}
        />
      ))}
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <BranchMesh
          key={`b-${i}`}
          groupRef={(g) => {
            pools.current.branch[i] = g;
          }}
        />
      ))}
      <Particles kind="fireflies" count={40} area={[12, 3, 30]} />
      <GhostSprite ref={ghostRef} url={asset(char.stage)} height={1.5} position={[0, 0.75, 0]} />
    </>
  );
}

export default function HopHop3DScene({
  char,
  lang,
  best,
  onOver,
}: {
  char: Character;
  lang: Lang;
  best: number;
  onOver: (score: number) => void;
}) {
  const T = TEXT[lang] || TEXT.en;
  const engRef = useRef<Hop3DEngine>(createEngine());
  const [score, setScore] = useState(0);
  const [hintOff, setHintOff] = useState(false);
  const [flash, setFlash] = useState(false);
  const downRef = useRef<{ x: number; y: number; fired: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const act = (kind: "L" | "R" | "H") => {
    const e = engRef.current;
    if (e.over) return;
    if (kind === "L") e.moveLane(-1);
    else if (kind === "R") e.moveLane(1);
    else e.hop();
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") act("L");
      else if (k === "ArrowRight" || k === "d" || k === "D") act("R");
      else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") act("H");
      else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className="relative min-h-[inherit] w-full overflow-hidden bg-[#0e0d22] touch-none select-none"
      onPointerDown={(ev) => {
        downRef.current = { x: ev.clientX, y: ev.clientY, fired: false };
      }}
      onPointerMove={(ev) => {
        const d = downRef.current;
        if (!d || d.fired) return;
        const dx = ev.clientX - d.x;
        const dy = ev.clientY - d.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
        d.fired = true;
        if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? "L" : "R");
        else if (dy < 0) act("H");
      }}
      onPointerUp={() => {
        if (downRef.current && !downRef.current.fired) act("H");
        downRef.current = null;
      }}
      onPointerCancel={() => {
        downRef.current = null;
      }}
    >
      <KitCanvas accent={char.accent} fogColor="#1a1838" fog={0.028}>
        <RunnerWorld
          engRef={engRef}
          char={char}
          onScore={setScore}
          onHideHint={() => setHintOff(true)}
          onCrash={(s) => {
            setFlash(true);
            requestAnimationFrame(() => setFlash(false));
            timerRef.current = setTimeout(() => onOver(s), 700);
          }}
        />
      </KitCanvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-3.5 py-2.5 font-comic text-white [text-shadow:0_1px_4px_#000]">
        <div className="text-[30px] leading-none text-[var(--accent,#a47fd0)]">{score}</div>
        <div className="self-center text-sm opacity-80">{`${T.best} ${Math.max(best || 0, score)}`}</div>
      </div>
      <div
        className={`pointer-events-none absolute right-[12%] bottom-[14%] left-[12%] text-center text-sm text-white transition-opacity duration-600 [text-shadow:0_1px_4px_#000] ${
          hintOff ? "opacity-0" : "opacity-100"
        }`}
      >
        {T.hint}
      </div>
      <div
        className={`pointer-events-none absolute inset-0 bg-[#c33] ${flash ? "opacity-35 transition-none" : "opacity-0 transition-opacity duration-500"}`}
      />
    </div>
  );
}
