// Quiet Wish (memory): pure state and rules. Four petals glow in an order; repeat it.
export const SIGHS = 3;
export const SHOW_MS = 550;
export const GAP_MS = 250;
export const START_LENGTH = 2;

export type MemoryPhase = "idle" | "show" | "input" | "busy" | "over";

export interface MemoryState {
  phase: MemoryPhase;
  seq: number[];
  pos: number;
  round: number;
  score: number;
  sighsLeft: number;
}

export function freshMemory(rng: () => number = Math.random): MemoryState {
  return {
    phase: "idle",
    seq: Array.from({ length: START_LENGTH }, () => Math.floor(rng() * 4)),
    pos: 0,
    round: 1,
    score: 0,
    sighsLeft: SIGHS,
  };
}

export function roundGain(seqLength: number): number {
  return (seqLength - 1) * 5;
}
