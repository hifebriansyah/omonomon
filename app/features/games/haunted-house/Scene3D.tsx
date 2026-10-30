// Rumah Hantu 3D R3F scene (lazy-loaded by haunted-house/Game.tsx).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GhostSprite, KitCanvas, KitLights, Particles, useKitFrame } from "~/features/three/scene-kit";
import { asset } from "~/lib/asset";
import type { Character } from "~/lib/content";
import { DOOR, FURNITURE, type HauntedRun, movePlayer, type RoomItem, START, WALL_H, WALLS } from "./logic";
import { LCOL } from "./text";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const WALL_COLORS = [0x6a5a88, 0x4e7a7c, 0x7a6a92, 0x8a5e6c];

interface PlayerPose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

function RoomWorld({
  run,
  roomRev,
  chars,
  playerRef,
  stickRef,
  keysRef,
  itemMeshesRef,
  onTick,
  onAct,
  onAdvance,
}: {
  run: HauntedRun;
  roomRev: number;
  chars: Character[];
  playerRef: React.RefObject<PlayerPose>;
  stickRef: React.RefObject<{ x: number; y: number }>;
  keysRef: React.RefObject<Set<string>>;
  itemMeshesRef: React.RefObject<Map<string, { it: RoomItem; m: THREE.Mesh }>>;
  onTick: (dt: number) => void;
  onAct: (id: string) => void;
  onAdvance: () => void;
}) {
  const lanternRef = useRef<THREE.PointLight>(null);
  const auxRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const lay = run.layout;
  const pz = run.puzzle;
  void roomRev;

  useEffect(() => {
    playerRef.current.x = START.x;
    playerRef.current.z = START.z;
    playerRef.current.yaw = 0;
    playerRef.current.pitch = 0;
  }, [lay.index, playerRef]);

  useKitFrame((dt, t, state) => {
    onTick(dt);
    const keys = keysRef.current;
    const stick = stickRef.current;
    const player = playerRef.current;

    const f = (keys.has("f") ? 1 : 0) - (keys.has("b") ? 1 : 0) - stick.y;
    const s = (keys.has("r") ? 1 : 0) - (keys.has("l") ? 1 : 0) + stick.x;
    player.yaw += ((keys.has("tl") ? 1 : 0) - (keys.has("tr") ? 1 : 0)) * 1.8 * dt;
    const len = Math.max(1, Math.hypot(f, s));
    const sp = (2.6 * dt) / len;
    const sy = Math.sin(player.yaw);
    const cy = Math.cos(player.yaw);
    if (f || s) {
      const p = movePlayer(player, (-sy * f + cy * s) * sp, (-cy * f - sy * s) * sp, lay.boxes);
      player.x = p.x;
      player.z = p.z;
    }
    state.camera.rotation.order = "YXZ";
    state.camera.position.set(player.x, 1.6, player.z);
    state.camera.rotation.set(player.pitch, player.yaw, 0);
    if (lanternRef.current) {
      lanternRef.current.position.set(player.x, 1.9, player.z);
    }

    for (const [id, rec] of itemMeshesRef.current.entries()) {
      const { it, m } = rec;
      if (!m.visible) continue;
      if (lay.kind === "petals") m.position.y = 1.2 + Math.sin(t * 1.6) * 0.12;
      if (lay.kind === "items") {
        const k = 1 + Math.sin(t * 3 + it.x) * 0.2;
        m.scale.set(0.26 * k, 0.26 * k, 0.26 * k);
        m.rotation.y = t;
      }
      const aux = auxRefs.current[id];
      if (aux && it.name) {
        aux.position.y = FURNITURE[it.name].size[1] + 0.35 + Math.sin(t * 2) * 0.06;
      }
      if ((lay.kind === "items" || lay.kind === "petals") && Math.hypot(it.x - player.x, it.z - player.z) < 0.95) {
        onAct(id);
        break;
      }
    }
    if (run.canExit() && Math.hypot(lay.door.x - player.x, lay.door.z - player.z) < DOOR.r) {
      onAdvance();
    }
  });

  const wallColor = WALL_COLORS[lay.index] || WALL_COLORS[0];
  const ghostChar = chars[lay.index];

  return (
    <>
      <KitLights lanternRef={lanternRef} />
      {/* Floor and ceiling */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[10.8, 0.2, 10.8]} />
        <meshLambertMaterial color={0x4a3f6e} />
      </mesh>
      <mesh position={[0, WALL_H + 0.1, 0]}>
        <boxGeometry args={[10.8, 0.2, 10.8]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Outer walls */}
      {WALLS.map((w, i) => (
        <mesh key={`w-${i}`} position={[(w.minX + w.maxX) / 2, WALL_H / 2, (w.minZ + w.maxZ) / 2]}>
          <boxGeometry args={[w.maxX - w.minX, WALL_H, w.maxZ - w.minZ]} />
          <meshLambertMaterial color={wallColor} />
        </mesh>
      ))}
      {/* Obstacles / props */}
      {lay.props.map((b, i) => (
        <mesh key={`p-${i}`} position={[(b.minX + b.maxX) / 2, 0.55, (b.minZ + b.maxZ) / 2]}>
          <boxGeometry args={[b.maxX - b.minX, 1.1, b.maxZ - b.minZ]} />
          <meshLambertMaterial color={0x7a6aa0} />
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[lay.door.x, 1.2, -4.94]}>
        <boxGeometry args={[2, 2.4, 0.12]} />
        {run.canExit() ? <meshBasicMaterial color={0xffd98a} /> : <meshLambertMaterial color={0x5a2535} />}
      </mesh>
      {/* Puzzle items */}
      {lay.items.map((it) => {
        const vis = pz.visible(it.id);
        const found = pz.found(it.id);
        const bindMesh = (m: THREE.Mesh | null) => {
          if (m) itemMeshesRef.current.set(it.id, { it, m });
          else itemMeshesRef.current.delete(it.id);
        };
        if (lay.kind === "items") {
          const y0 = 0.4 + ((((it.x * 7) % 3) + 3) % 3) * 0.12;
          return (
            <mesh key={it.id} ref={bindMesh} visible={vis} position={[it.x, y0, it.z]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color={0xffe08a} />
            </mesh>
          );
        }
        if (lay.kind === "lanterns" && it.color) {
          const col = LCOL[it.color];
          return (
            <mesh key={it.id} ref={bindMesh} visible={vis} position={[it.x, 1, it.z]}>
              <boxGeometry args={[0.4, 0.55, 0.4]} />
              {found ? (
                <meshBasicMaterial color={col} />
              ) : (
                <meshLambertMaterial color={col} emissive={col} emissiveIntensity={0.08} />
              )}
            </mesh>
          );
        }
        if (lay.kind === "petals") {
          return (
            <mesh key={it.id} ref={bindMesh} visible={vis} position={[it.x, 1.2, it.z]} scale={[0.4, 0.1, 0.26]}>
              <sphereGeometry args={[0.5, 10, 8]} />
              <meshBasicMaterial color={0xffb8d8} />
            </mesh>
          );
        }
        const [w, h, d] = FURNITURE[it.name || "wardrobe"].size;
        return (
          <group key={it.id}>
            <mesh ref={bindMesh} visible={vis} position={[it.x, h / 2, it.z]}>
              <boxGeometry args={[w, h, d]} />
              <meshLambertMaterial color={found ? 0x4a8a5a : 0x5b4a80} />
            </mesh>
            {it.secret && (
              <mesh
                ref={(m) => {
                  auxRefs.current[it.id] = m;
                }}
                visible={!found}
                position={[it.x, h + 0.35, it.z]}
                scale={[0.22, 0.22, 0.22]}
              >
                <sphereGeometry args={[0.5, 10, 8]} />
                <meshBasicMaterial color={0xc9a8ff} />
              </mesh>
            )}
          </group>
        );
      })}
      {ghostChar && (
        <GhostSprite url={asset(ghostChar.stage)} height={1.7} position={[lay.ghost.x, 0.95, lay.ghost.z]} />
      )}
      <Particles kind="dust" count={60} area={[10, 3, 10]} position={[0, 0, 2]} />
    </>
  );
}

export default function HauntedHouseScene3D({
  run,
  roomRev,
  char,
  chars,
  onTick,
  onAct,
  onAdvance,
  onFar,
}: {
  run: HauntedRun;
  roomRev: number;
  char: Character;
  chars: Character[];
  onTick: (dt: number) => void;
  onAct: (id: string) => void;
  onAdvance: () => void;
  onFar: () => void;
}) {
  const playerRef = useRef<PlayerPose>({ x: START.x, z: START.z, yaw: 0, pitch: 0 });
  const stickRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const itemMeshesRef = useRef<Map<string, { it: RoomItem; m: THREE.Mesh }>>(new Map());
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const knobDotRef = useRef<HTMLElement>(null);
  const ptrsRef = useRef<Map<number, { stick: boolean; x0: number; y0: number; x: number; y: number; t: number; moved: number }>>(new Map());

  const distTo = (it: RoomItem) => Math.hypot(it.x - playerRef.current.x, it.z - playerRef.current.z);

  useEffect(() => {
    const MOVE: Record<string, string> = {
      KeyW: "f",
      ArrowUp: "f",
      KeyS: "b",
      ArrowDown: "b",
      KeyA: "l",
      KeyD: "r",
      ArrowLeft: "tl",
      ArrowRight: "tr",
    };
    const keys = keysRef.current;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || "";
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (MOVE[e.code]) {
        if (e.type === "keydown") keys.add(MOVE[e.code]);
        else keys.delete(MOVE[e.code]);
        e.preventDefault();
      } else if ((e.code === "Space" || e.code === "Enter" || e.code === "KeyE") && e.type === "keydown" && tag !== "BUTTON") {
        e.preventDefault();
        const near = [...itemMeshesRef.current.values()]
          .filter((q) => q.m.visible)
          .sort((a, b) => distTo(a.it) - distTo(b.it))[0];
        if (near && distTo(near.it) < 1.9) onAct(near.it.id);
      }
    };
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapAt = (cx: number, cy: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const r = pad.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const cam = new THREE.PerspectiveCamera(55, r.width / Math.max(1, r.height), 0.1, 100);
    cam.rotation.order = "YXZ";
    cam.position.set(playerRef.current.x, 1.6, playerRef.current.z);
    cam.rotation.set(playerRef.current.pitch, playerRef.current.yaw, 0);
    cam.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);
    const candidates = [...itemMeshesRef.current.values()].filter((q) => q.m.visible);
    const hit = ray.intersectObjects(
      candidates.map((q) => q.m),
      false,
    )[0];
    if (!hit) return;
    const rec = candidates.find((q) => q.m === hit.object);
    if (!rec) return;
    if (distTo(rec.it) > 3.4) onFar();
    else onAct(rec.it.id);
  };

  return (
    <>
      <div className="rh-stage">
        <KitCanvas accent={char.accent} fogColor="#15142b" fog={0.09}>
          <RoomWorld
            run={run}
            roomRev={roomRev}
            chars={chars}
            playerRef={playerRef}
            stickRef={stickRef}
            keysRef={keysRef}
            itemMeshesRef={itemMeshesRef}
            onTick={onTick}
            onAct={onAct}
            onAdvance={onAdvance}
          />
        </KitCanvas>
      </div>
      <div
        ref={padRef}
        className="rh-pad"
        onPointerDown={(e) => {
          const pad = padRef.current;
          if (!pad) return;
          try {
            pad.setPointerCapture(e.pointerId);
          } catch {}
          const r = pad.getBoundingClientRect();
          const isStick =
            e.pointerType !== "mouse" &&
            e.clientX - r.left < r.width * 0.45 &&
            ![...ptrsRef.current.values()].some((p) => p.stick);
          ptrsRef.current.set(e.pointerId, {
            stick: isStick,
            x0: e.clientX,
            y0: e.clientY,
            x: e.clientX,
            y: e.clientY,
            t: performance.now(),
            moved: 0,
          });
          if (isStick && knobRef.current) {
            knobRef.current.style.display = "block";
            knobRef.current.style.left = `${e.clientX - r.left}px`;
            knobRef.current.style.top = `${e.clientY - r.top}px`;
          }
        }}
        onPointerMove={(e) => {
          const p = ptrsRef.current.get(e.pointerId);
          if (!p) return;
          const dx = e.clientX - p.x;
          const dy = e.clientY - p.y;
          p.x = e.clientX;
          p.y = e.clientY;
          p.moved += Math.abs(dx) + Math.abs(dy);
          if (p.stick) {
            let sx = (p.x - p.x0) / 44;
            let sy = (p.y - p.y0) / 44;
            const len = Math.hypot(sx, sy);
            if (len > 1) {
              sx /= len;
              sy /= len;
            }
            stickRef.current.x = Math.abs(sx) < 0.12 ? 0 : sx;
            stickRef.current.y = Math.abs(sy) < 0.12 ? 0 : sy;
            if (knobDotRef.current) knobDotRef.current.style.transform = `translate(${sx * 30}px,${sy * 30}px)`;
          } else {
            playerRef.current.yaw -= dx * 0.005;
            playerRef.current.pitch = clamp(playerRef.current.pitch - dy * 0.004, -0.8, 0.8);
          }
        }}
        onPointerUp={(e) => {
          const p = ptrsRef.current.get(e.pointerId);
          if (!p) return;
          ptrsRef.current.delete(e.pointerId);
          if (p.stick) {
            stickRef.current.x = 0;
            stickRef.current.y = 0;
            if (knobRef.current) knobRef.current.style.display = "none";
            if (knobDotRef.current) knobDotRef.current.style.transform = "";
          } else if (p.moved < 8 && performance.now() - p.t < 450) {
            tapAt(e.clientX, e.clientY);
          }
        }}
        onPointerCancel={(e) => {
          const p = ptrsRef.current.get(e.pointerId);
          if (!p) return;
          ptrsRef.current.delete(e.pointerId);
          if (p.stick) {
            stickRef.current.x = 0;
            stickRef.current.y = 0;
            if (knobRef.current) knobRef.current.style.display = "none";
            if (knobDotRef.current) knobDotRef.current.style.transform = "";
          }
        }}
      />
      <div ref={knobRef} className="rh-stick">
        <i ref={knobDotRef} />
      </div>
    </>
  );
}
