import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { createRun } from "./logic";

const game = games.find((g) => g.slug === "rope-untangle")!;
const char = characters.find((c) => c.id === game.character)!;
const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };

const meta = {
  title: "Games/Tali Lepas",
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

/** A fresh run, as the page starts it. */
export const Start: Story = { args: { makeRun: () => createRun({ rng: seeded(7) }) } };

/** Level 3, half a minute in, with some points. */
export const Playing: Story = {
  args: {
    makeRun: () => {
      const r = createRun({ rng: seeded(7) });
      for (let k = 0; k < 2; k++) {
        r.state().g.solution.forEach((p, i) => r.move(i, p.x, p.y));
        r.tick(12);
        r.finish();
      }
      return r;
    },
  },
};

/** The 90 seconds are up: the board stops and the score is reported. */
export const GameOver: Story = {
  args: {
    makeRun: () => {
      const r = createRun({ rng: seeded(7) });
      r.state().g.solution.forEach((p, i) => r.move(i, p.x, p.y));
      r.tick(5);
      r.finish();
      r.tick(100);
      return r;
    },
  },
};

export const Indonesian: Story = { args: { lang: "id" } };
