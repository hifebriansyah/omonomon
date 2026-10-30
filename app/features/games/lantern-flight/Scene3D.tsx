// Lentera Terbang 3D R3F scene (lazy-loaded by lantern-flight/Game.tsx).
import { useRef } from "react";
import * as THREE from "three";
import { GhostSprite, KitCanvas, KitLights, Particles, useKitFrame } from "~/features/three/scene-kit";
import { asset } from "~/lib/asset";
import type { Character } from "~/lib/content";
import { FINISH, type LanternEngine, type SkyItemKind } from "./logic";

function LanternWorld({
  engRef,
  flickerRef,
  onTick,
  char,
}: {
  engRef: React.RefObject<LanternEngine>;
  flickerRef: React.RefObject<number>;
  onTick: (dt: number) => void;
  char: Character;
}) {
  const lanternRef = useRef<THREE.Group>(null);
  const ghostRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const fireRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);
  const pool = useRef<Record<SkyItemKind, (THREE.Mesh | null)[]>>({ wish: [], branch: [], kite: [] });

  useKitFrame((dt, t, state) => {
    onTick(dt);
    const s = engRef.current.state();
    if (lanternRef.current) {
      lanternRef.current.position.set(s.x, s.y, 0);
      lanternRef.current.rotation.z = -s.vx * 0.12;
    }
    if (ghostRef.current) {
      ghostRef.current.position.set(s.x, s.y + 0.38, -0.12);
    }
    state.camera.position.set(s.x * 0.3, s.y + 1.6, 6.5);
    state.camera.lookAt(s.x * 0.3, s.y + 2.6, 0);
    if (fireRef.current) fireRef.current.position.y = s.y - 3;
    if (dustRef.current) dustRef.current.position.y = s.y - 3;
    if (lightRef.current) {
      const f = flickerRef.current;
      lightRef.current.position.set(s.x, s.y + 0.4, 1.2);
      lightRef.current.intensity = f > 0 ? 1.6 * (0.45 + 0.4 * Math.abs(Math.sin(t * 22))) : 1.6 + Math.sin(t * 3) * 0.12;
    }

    const used: Record<SkyItemKind, number> = { wish: 0, branch: 0, kite: 0 };
    for (const it of s.items) {
      const m = pool.current[it.kind][used[it.kind]++];
      if (!m) continue;
      m.visible = true;
      m.position.set(it.x, it.y, 0);
      if (it.kind === "wish") m.rotation.y = t * 1.5;
      else if (it.kind === "branch") m.rotation.z = (it.x < 0 ? -1 : 1) * 1.25;
      else m.rotation.z = Math.sin(t * 2 + it.y) * 0.3;
    }
    for (const k of ["wish", "branch", "kite"] as const) {
      for (let i = used[k]; i < pool.current[k].length; i++) {
        const m = pool.current[k][i];
        if (m) m.visible = false;
      }
    }
  });

  const url = char.head || char.stage;

  return (
    <>
      <KitLights moon={0.8} lanternRef={lightRef} />
      <group ref={lanternRef}>
        <mesh>
          <cylinderGeometry args={[0.3, 0.2, 0.55, 8, 1, true]} />
          <meshBasicMaterial color={0xffb25e} side={THREE.DoubleSide} transparent opacity={0.92} />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 8]} />
          <meshBasicMaterial color={0x6b3b22} />
        </mesh>
      </group>
      <mesh position={[2, FINISH + 7, -9]}>
        <sphereGeometry args={[3, 16, 12]} />
        <meshBasicMaterial color={0xf4efd6} fog={false} />
      </mesh>
      {url && <GhostSprite ref={ghostRef} url={asset(url)} height={0.75} />}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh
          key={`w-${i}`}
          ref={(m) => {
            pool.current.wish[i] = m;
          }}
          visible={false}
        >
          <octahedronGeometry args={[0.28]} />
          <meshBasicMaterial color={0xffe08a} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={`b-${i}`}
          ref={(m) => {
            pool.current.branch[i] = m;
          }}
          visible={false}
        >
          <coneGeometry args={[0.22, 1.9, 5]} />
          <meshLambertMaterial color={0x3a2a24} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={`k-${i}`}
          ref={(m) => {
            pool.current.kite[i] = m;
          }}
          visible={false}
        >
          <octahedronGeometry args={[0.5]} />
          <meshLambertMaterial color={0x241f3a} />
        </mesh>
      ))}
      <Particles kind="fireflies" count={50} area={[9, 12, 6]} pointsRef={fireRef} />
      <Particles kind="dust" count={60} area={[9, 12, 6]} pointsRef={dustRef} />
    </>
  );
}

export default function LanternScene3D({
  char,
  engRef,
  flickerRef,
  onTick,
}: {
  char: Character;
  engRef: React.RefObject<LanternEngine>;
  flickerRef: React.RefObject<number>;
  onTick: (dt: number) => void;
}) {
  return (
    <KitCanvas accent={char.accent} fogColor="#15142b" fog={0.045}>
      <LanternWorld char={char} engRef={engRef} flickerRef={flickerRef} onTick={onTick} />
    </KitCanvas>
  );
}
