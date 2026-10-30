// Rumah Hantu (Haunted House): walk through 4 ghost rooms with 3D R3F view and 2D puzzle fallback.
import { type CSSProperties, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { canUse3D } from "~/features/three/kit";
import { ThreeBoundary } from "~/features/three/ThreeBoundary";
import { asset } from "~/lib/asset";
import type { GameProps } from "../types";
import "./haunted-house.css";
import { createRun, HALF, type HauntedRun } from "./logic";
import { LCOL, TEXT } from "./text";

const LazyScene3D = lazy(() => import("./Scene3D"));
const pct = (v: number) => `${((v + HALF) / (2 * HALF)) * 100}%`;

export default function HauntedHouseGame({ lang, char, chars, onOver, makeRun, force2D }: GameProps & { makeRun?: () => HauntedRun; force2D?: boolean }) {
  const L = TEXT[lang] || TEXT.en;
  const [run] = useState<HauntedRun>(() => (makeRun ? makeRun() : createRun()));
  const [rev, setRev] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const endedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gname = (roomIdx = run.room) => chars[roomIdx]?.name || "";
  const orderText = (r = run) =>
    (r.layout.order || [])
      .map((id) => {
        const it = r.layout.items.find((x) => x.id === id);
        return it?.color ? L.colors[it.color] : "";
      })
      .join(" > ");

  const [speech, setSpeech] = useState(() => {
    const intro = L.intro[run.room].replace("{o}", run.layout.kind === "lanterns" ? orderText(run) : "");
    return `${gname(run.room)}: ${intro}`;
  });

  const say = useCallback(
    (txt: string, roomIdx = run.room) => {
      setSpeech(`${chars[roomIdx]?.name || ""}: ${txt}`);
    },
    [chars, run.room],
  );

  const finish = useCallback(
    (gaveUp: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      if (gaveUp) run.leave();
      onOver(run.score(), { char: run.lastChar() });
    },
    [onOver, run],
  );

  const act = useCallback(
    (id: string) => {
      if (endedRef.current) return;
      const { result, roomDone, runDone } = run.touch(id);
      if (result === "ignore") return;
      if (result === "wrong") say(L.wrong);
      else if (result === "empty") say(L.empty);
      if (roomDone) say(L.done[run.room]);
      setRev((n) => n + 1);
      if (runDone) {
        timerRef.current = setTimeout(() => finish(false), 1100);
      }
    },
    [L, finish, run, say],
  );

  const advance = useCallback(() => {
    if (run.next()) {
      const intro = L.intro[run.room].replace("{o}", run.layout.kind === "lanterns" ? orderText(run) : "");
      say(intro, run.room);
      setRev((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, run, say]);

  const onTick = useCallback(
    (dt: number) => {
      if (endedRef.current) return;
      run.tick(dt);
      const s = Math.floor(run.time);
      setSeconds((prev) => (prev === s ? prev : s));
    },
    [run],
  );

  const use3D = !force2D && canUse3D();
  const [failed3D, setFailed3D] = useState(false);
  const active3D = use3D && !failed3D;

  // 2D clock timer when running in 2D mode
  useEffect(() => {
    if (active3D) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      if (!document.hidden && !endedRef.current) {
        onTick(Math.min(0.5, (now - last) / 1000));
      }
      last = now;
    }, 250);
    return () => clearInterval(id);
  }, [active3D, onTick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  void rev;
  const lay = run.layout;
  const p = run.puzzle;
  let hintText = `${L.hint[run.room]}: ${p.count()}/${p.total}`;
  if (lay.kind === "lanterns") hintText += `  (${orderText(run)})`;
  if (run.canExit()) hintText = L.doorOpen;

  const touchy = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const ctlText = active3D ? (touchy ? L.ctlTouch : L.ctl) : "";

  const fallback2D = (
    <div className="rh-stage">
      <div className="rh2">
        {lay.props.map((b, i) => (
          <div
            key={i}
            className="rh-prop"
            style={{
              left: pct(b.minX),
              top: pct(b.minZ),
              width: `${((b.maxX - b.minX) / 10) * 100}%`,
              height: `${((b.maxZ - b.minZ) / 10) * 100}%`,
            }}
          />
        ))}
        {chars[run.room] && (
          <img
            src={asset(chars[run.room].stage)}
            alt={gname()}
            style={{ left: pct(lay.ghost.x), top: pct(lay.ghost.z + 0.6) }}
          />
        )}
        {lay.items.map((it) => {
          if (!p.visible(it.id)) return null;
          const posStyle: CSSProperties = { left: pct(it.x), top: pct(it.z) };
          if (lay.kind === "items") {
            return <button key={it.id} type="button" className="rh-o" aria-label={L.walk} style={posStyle} onClick={() => act(it.id)} />;
          }
          if (lay.kind === "lanterns" && it.color) {
            return (
              <button
                key={it.id}
                type="button"
                aria-label={L.colors[it.color]}
                className={`rh-lan${p.found(it.id) ? " on" : ""}`}
                style={{ ...posStyle, "--c": `#${LCOL[it.color].toString(16)}` } as CSSProperties}
                onClick={() => act(it.id)}
              />
            );
          }
          if (lay.kind === "petals") {
            return <button key={it.id} type="button" className="rh-pet" aria-label={L.hint[2]} style={posStyle} onClick={() => act(it.id)} />;
          }
          return (
            <button
              key={it.id}
              type="button"
              className={`rh-fur${it.secret ? " whisper" : ""}${p.found(it.id) ? " on" : ""}`}
              style={posStyle}
              onClick={() => act(it.id)}
            >
              {it.name ? L.names[it.name] : ""}
            </button>
          );
        })}
        <button
          type="button"
          disabled={!run.canExit()}
          aria-label={L.doorOpen}
          className={`rh-door${run.canExit() ? " open" : ""}`}
          style={{ left: pct(lay.door.x), top: pct(lay.door.z - 0.4) }}
          onClick={advance}
        >
          ▮
        </button>
      </div>
    </div>
  );

  return (
    <div className="rh">
      {active3D ? (
        <ThreeBoundary fallback={fallback2D} onError={() => setFailed3D(true)}>
          <Suspense fallback={fallback2D}>
            <LazyScene3D
              run={run}
              roomRev={rev}
              char={char}
              chars={chars}
              onTick={onTick}
              onAct={act}
              onAdvance={advance}
              onFar={() => say(L.far)}
            />
          </Suspense>
        </ThreeBoundary>
      ) : (
        fallback2D
      )}
      <div className="rh-top">
        <b>{L.rooms[run.room]}</b>
        <span className="rh-time">{`${L.time} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</span>
        <button type="button" className="rh-leave" onClick={() => finish(true)}>
          {L.leave}
        </button>
      </div>
      <div className="rh-bot">
        <div className="rh-say" aria-live="polite">
          {speech}
        </div>
        <div className="rh-hint">{hintText}</div>
        <div className="rh-ctl">{ctlText}</div>
      </div>
    </div>
  );
}
