// Shared bits of the two canvas games (Hop Hop and Hair Catch): the hero picture and a canvas sized for the screen.

// Load the ghost's picture. Browser only: call it in an effect.
export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${src}`));
    img.src = src;
  });

// Size the canvas for the screen's pixel density (at most 2x) and draw in logical pixels.
export function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// Keys pressed on a button or link belong to it (Play again, Back), not to the game.
export const onControl = (e: KeyboardEvent) => e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;

export const CANVAS_CLASS =
  "block aspect-video h-auto w-full cursor-pointer touch-manipulation outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--accent)]";
