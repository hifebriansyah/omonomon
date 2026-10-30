import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { createEngine, makeRng, SIZE, type Engine } from "./logic";

const game = games.find((g) => g.slug === "memory-garden")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };

// Makes the first valid swap it finds (left to right, then top to bottom).
function playOne(e: Engine) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c + 1 < SIZE; c++) if (e.swap({ r, c }, { r, c: c + 1 }).valid) return;
  for (let r = 0; r + 1 < SIZE; r++) for (let c = 0; c < SIZE; c++) if (e.swap({ r, c }, { r: r + 1, c }).valid) return;
}

const meta = {
  title: "Games/Bunga Kenangan",
  component: Game,
  args: props,
  decorators: [
    (Story) => (
      <div className="relative min-h-[min(72vh,560px)] overflow-hidden rounded-[14px] border-[3px] border-ink" style={{ ["--accent" as string]: char.accent }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Game>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Start: Story = { args: { makeEngine: () => createEngine({ rng: makeRng(11) }) } };

/** Eight moves made. */
export const Playing: Story = {
  args: {
    makeEngine: () => {
      const e = createEngine({ rng: makeRng(11) });
      for (let k = 0; k < 8; k++) playOne(e);
      return e;
    },
  },
};

/** One move left: the next swap ends the run ("The garden rests.") and reports the score. */
export const LastMove: Story = { args: { makeEngine: () => createEngine({ rng: makeRng(11), moves: 1 }) } };

/** All 20 moves used. */
export const GameOver: Story = {
  args: {
    makeEngine: () => {
      const e = createEngine({ rng: makeRng(11) });
      while (!e.state.over) playOne(e);
      return e;
    },
  },
};
