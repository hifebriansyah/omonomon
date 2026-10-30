import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { createRun } from "./logic";

const game = games.find((g) => g.slug === "haunted-house")!;
const char = characters.find((c) => c.id === game.character)!;
const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 100, reduceMotion: false, game };

const meta = {
  title: "Games/Rumah Hantu (3D)",
  component: Game,
  args: props,
  decorators: [
    (Story) => (
      <div className="relative min-h-[min(72vh,560px)] overflow-hidden rounded-[14px] border-[3px] border-ink bg-[#0e0c1c]" style={{ ["--accent" as string]: char.accent }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Game>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Start: Story = { args: { makeRun: () => createRun(seeded(7)) } };
export const Fallback2D: Story = { args: { force2D: true, makeRun: () => createRun(seeded(7)) } };
export const Room2Lanterns2D: Story = {
  args: {
    force2D: true,
    makeRun: () => {
      const r = createRun(seeded(7));
      for (const it of r.layout.items) r.touch(it.id);
      r.next();
      return r;
    },
  },
};
export const Indonesian: Story = { args: { lang: "id", makeRun: () => createRun(seeded(7)) } };
