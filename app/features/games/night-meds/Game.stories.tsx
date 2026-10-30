import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { createEngine } from "./logic";

const game = games.find((g) => g.slug === "night-meds")!;
const char = characters.find((c) => c.id === game.character)!;
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };

const meta = {
  title: "Games/Obat Malam",
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

/** A fresh shift: the first pill drops after 0.6 s. */
export const Start: Story = {};

/** Six pills sorted (a streak, so the next one pays 15) and one life lost. */
export const Playing: Story = {
  args: {
    makeEngine: () => {
      const e = createEngine({ rng: seq(0, 0.4, 0.9) });
      const sort = (right: boolean) => {
        for (let k = 0; k < 100 && !e.state().pill; k++) e.tick(0.1);
        while (e.state().pill!.p < 0.4) e.tick(0.05);
        const kind = e.state().pill!.kind;
        e.choose(right ? kind : (kind + 1) % 3);
      };
      sort(false);
      for (let k = 0; k < 6; k++) sort(true);
      return e;
    },
  },
};

/** Three lives gone: the run is over and reported once. */
export const GameOver: Story = {
  args: {
    makeEngine: () => {
      const e = createEngine({ rng: seq(0) });
      for (let k = 0; k < 400 && !e.state().over; k++) e.tick(0.1);
      return e;
    },
  },
};

export const ReducedMotion: Story = { args: { reduceMotion: true, lang: "id" } };
