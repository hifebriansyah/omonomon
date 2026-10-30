// 2.5D chat stage backdrop (was assets/scripts/three/stage3d.js): a small low-poly scene per ghost behind the HTML speech bubble
// and ghost picture. Loaded lazily by ChatScreen when 3D scenes are enabled on Me and no bought stage look is worn.
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Character } from "~/lib/content";
import { KitCanvas, KitLights, Particles, useDispose, useKitFrame } from "./scene-kit";
import { parallaxAngles, sceneSpec, type SceneSpec } from "./stage-logic";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Deterministic pseudo-random from seed so re-renders keep props steady.
function makeRng(seed: number) {
  let s = seed | 0;
  return (a: number, b: number) => {
    s = (s * 1664525 + 1013904223) | 0;
    return a + ((s >>> 0) / 4294967296) * (b - a);
  };
}

const layerZ = (i: number, layers: number) => -2 - ((i * 12) / Math.max(1, layers - 1)) * 0.8 - i * 1.5;

function BambooScene({ spec }: { spec: SceneSpec }) {
  const stalks = useMemo(() => {
    const rnd = makeRng(101);
    return Array.from({ length: spec.props }, (_, i) => {
      const layer = i % spec.layers;
      const z = layerZ(layer, spec.layers) + rnd(-1, 1);
      const h = rnd(5, 8);
      const x = rnd(-6, 6);
      const rotZ = rnd(-0.04, 0.04);
      return { i, x, z, h, rotZ, color: ["#4f8a4a", "#3f7a45", "#66a35a"][i % 3] };
    });
  }, [spec.props, spec.layers]);

  return (
    <>
      <mesh position={[0, 0, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={0x24331f} roughness={0.9} flatShading />
      </mesh>
      {stalks.map((s) => (
        <group key={s.i}>
          <mesh position={[s.x, s.h / 2, s.z]} rotation={[0, 0, s.rotZ]}>
            <cylinderGeometry args={[0.07, 0.09, s.h, 6]} />
            <meshStandardMaterial color={s.color} roughness={0.9} flatShading />
          </mesh>
          {[1, 2, 3].map((k) => (
            <mesh key={k} position={[s.x, (k * s.h) / 4, s.z]}>
              <cylinderGeometry args={[0.1, 0.1, 0.05, 6]} />
              <meshStandardMaterial color="#4f8a4a" roughness={0.9} flatShading />
            </mesh>
          ))}
        </group>
      ))}
      <Particles kind="mist" count={40} area={[12, 2.5, 10]} />
    </>
  );
}

function CorridorScene({ spec }: { spec: SceneSpec }) {
  const bays = Math.floor(spec.props / 3);
  return (
    <>
      <mesh position={[0, 0, -12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 30]} />
        <meshStandardMaterial color={0x2b3a44} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 3, -12]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 30]} />
        <meshStandardMaterial color={0x34454f} roughness={0.9} flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 2, 1.5, -12]} rotation={[0, (-s * Math.PI) / 2, 0]}>
          <planeGeometry args={[30, 3]} />
          <meshStandardMaterial color={0x3b5560} roughness={0.9} flatShading />
        </mesh>
      ))}
      {Array.from({ length: bays }, (_, i) => {
        const z = -1.5 - i * 2.2;
        return (
          <group key={i}>
            <mesh position={[0, 2.95, z]}>
              <boxGeometry args={[0.9, 0.06, 0.3]} />
              <meshBasicMaterial color={0xeaffff} />
            </mesh>
            {([-1, 1] as const).map((s) =>
              i % 2 === (s > 0 ? 0 : 1) ? (
                <mesh key={s} position={[s * 1.97, 1.05, z - 1]}>
                  <boxGeometry args={[0.06, 2.1, 0.9]} />
                  <meshStandardMaterial color={0x5b7f8c} roughness={0.9} flatShading />
                </mesh>
              ) : null,
            )}
          </group>
        );
      })}
      <mesh position={[0, 1.5, -26]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color={0x4a6a76} roughness={0.9} flatShading />
      </mesh>
      <Particles kind="dust" count={40} area={[3, 3, 14]} />
    </>
  );
}

function GardenScene({ spec, accent }: { spec: SceneSpec; accent: string }) {
  const flowers = useMemo(() => {
    const rnd = makeRng(303);
    const colors = [accent, "#f4a6c8", "#ffe08a", "#ffffff"];
    return Array.from({ length: spec.props }, (_, i) => ({
      i,
      x: rnd(-6, 6),
      z: layerZ(i % spec.layers, spec.layers) + rnd(-1, 1),
      color: colors[i % 4],
    }));
  }, [spec.props, spec.layers, accent]);

  return (
    <>
      <mesh position={[0, 0, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={0x4c6b3a} roughness={0.9} flatShading />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-5 + i * 5.1, 0.35, layerZ(2, spec.layers)]}>
          <boxGeometry args={[5, 0.7, 0.4]} />
          <meshStandardMaterial color={0xb9a9c9} roughness={0.9} flatShading />
        </mesh>
      ))}
      {flowers.map((f) => (
        <group key={f.i}>
          <mesh position={[f.x, 0.25, f.z]}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 4]} />
            <meshStandardMaterial color={0x3f7a3a} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[f.x, 0.58, f.z]}>
            <coneGeometry args={[0.15, 0.2, 6]} />
            <meshStandardMaterial color={f.color} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      <Particles kind="dust" count={50} area={[10, 4, 8]} look={{ color: 0xffb6d2, size: 0.1, opacity: 0.85 }} />
    </>
  );
}

function BanyanScene({ spec }: { spec: SceneSpec }) {
  const roots = useMemo(() => {
    const rnd = makeRng(404);
    return Array.from({ length: spec.props }, (_, i) => {
      const len = rnd(2, 5);
      const z = layerZ(i % spec.layers, spec.layers) + rnd(-1, 1);
      const x = rnd(-5, 5);
      return { i, x, z, len };
    });
  }, [spec.props, spec.layers]);

  const barkGeo1 = useMemo(() => new THREE.CylinderGeometry(0.9, 1.4, 7, 7), []);
  const barkGeo2 = useMemo(() => new THREE.CylinderGeometry(0.5, 0.8, 7, 7), []);
  useDispose(barkGeo1, barkGeo2);

  return (
    <>
      <mesh position={[0, 0, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={0x2a2418} roughness={0.9} flatShading />
      </mesh>
      <mesh geometry={barkGeo1} position={[-1.2, 3.5, layerZ(2, spec.layers)]}>
        <meshStandardMaterial color={0x4a3a28} roughness={0.9} flatShading />
      </mesh>
      <mesh geometry={barkGeo2} position={[2.8, 3.5, layerZ(1, spec.layers) - 1]}>
        <meshStandardMaterial color={0x4a3a28} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 7.2, layerZ(2, spec.layers)]}>
        <coneGeometry args={[5, 2.5, 7]} />
        <meshStandardMaterial color={0x1f3a26} roughness={0.9} flatShading />
      </mesh>
      {roots.map((r) => (
        <mesh key={r.i} position={[r.x, 6 - r.len / 2, r.z]}>
          <cylinderGeometry args={[0.03, 0.05, r.len, 4]} />
          <meshStandardMaterial color={0x5a4632} roughness={0.9} flatShading />
        </mesh>
      ))}
      <Particles kind="fireflies" count={40} area={[9, 3, 8]} />
    </>
  );
}

function ParallaxCamera({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      target.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.current = { x: clamp(e.gamma / 30, -1, 1), y: clamp((e.beta - 50) / 30, -1, 1) };
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, [stageRef]);

  useKitFrame((dt, _t, state) => {
    const k = 1 - Math.exp(-dt * 4);
    cur.current.x += (target.current.x - cur.current.x) * k;
    cur.current.y += (target.current.y - cur.current.y) * k;
    const a = parallaxAngles(cur.current.x, cur.current.y, 4);
    state.camera.position.set(-a.yaw * 6, 1.5 + a.pitch * 3, 4);
    state.camera.rotation.set(a.pitch * 0.5, a.yaw * 0.5, 0);
    state.camera.updateMatrixWorld();
  });

  return null;
}

export default function ChatBackdrop({ character, stageRef }: { character: Character; stageRef: RefObject<HTMLElement | null> }) {
  const spec = sceneSpec(character.id);
  const accent = character.accent || "#a47fd0";
  return (
    <KitCanvas accent={accent} fogColor={spec.fog} background={spec.background} fog={spec.fogDensity} dpr={1.5}>
      <KitLights />
      <ParallaxCamera stageRef={stageRef} />
      {spec.name === "corridor" ? (
        <CorridorScene spec={spec} />
      ) : spec.name === "garden" ? (
        <GardenScene spec={spec} accent={accent} />
      ) : spec.name === "banyan" ? (
        <BanyanScene spec={spec} />
      ) : (
        <BambooScene spec={spec} />
      )}
    </KitCanvas>
  );
}
