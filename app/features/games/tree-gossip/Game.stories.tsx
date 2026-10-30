import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { createEngine } from "./logic";

const game = games.find((g) => g.slug === "tree-gossip")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };

const meta = {
  title: "Games/Gosip Pohon",
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

export const Start: Story = {};

/** Forty seconds in: two peekers out at once, a streak going, one life lost. */
export const Playing: Story = {
  args: {
    makeEngine: () => {
      let a = 12345;
      const rng = () => (a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const e = createEngine({ rng });
      e.state().lives = 2;
      for (let n = 0; n < 400; n++) {
        e.tick(0.1);
        const up = e.state().spots.findIndex((s) => s.kind === "secret");
        if (up >= 0 && n % 2 === 0) e.tap(up);
      }
      return e;
    },
  },
};

/** Three decoys tapped: the run is over. */
export const GameOver: Story = {
  args: {
    makeEngine: () => {
      const e = createEngine({ rng: () => 0 });
      for (let n = 0; n < 3; n++) {
        const s = e.tick(2).find((x) => x.type === "show");
        if (s && "i" in s) e.tap(s.i);
      }
      return e;
    },
  },
};

export const Indonesian: Story = { args: { lang: "id", reduceMotion: true } };
