// Hop Hop 3D (Lompat Kubur): 3D three-lane endless runner with 2D Hop Hop fallback.
import { lazy, Suspense, useMemo } from "react";
import { canUse3D } from "~/features/three/kit";
import { ThreeBoundary } from "~/features/three/ThreeBoundary";
import RunnerGame, { type Demo } from "../runner/Game";
import type { GameProps } from "../types";
import { TEXT } from "./text";

const LazyScene3D = lazy(() => import("./Scene3D"));

export default function HopHop3DGame(props: GameProps & { demo?: Demo; force2D?: boolean }) {
  const { char, lang, best, reduceMotion, onOver, game, demo, force2D } = props;
  const fallbackGame = useMemo(
    () => ({
      ...game,
      startText: { en: TEXT.en.fall, id: TEXT.id.fall },
    }),
    [game],
  );
  const fallback = <RunnerGame {...props} game={fallbackGame} demo={demo} />;

  if (force2D || reduceMotion || !canUse3D()) return fallback;

  return (
    <ThreeBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyScene3D char={char} lang={lang} best={best} onOver={(s) => onOver(s)} />
      </Suspense>
    </ThreeBoundary>
  );
}
