import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { newRun, step } from "./logic";

const game = games.find((g) => g.slug === "dare-night")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };

const meta = {
  title: "Games/Uji Nyali",
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
export const Playing: Story = {
  args: { initialRun: step(newRun({ ghost: "1", level: 4, route: "grave" }), 0) },
};
export const GameOver: Story = {
  args: {
    initialRun: (() => {
      let r = newRun({ ghost: "1", level: 8, route: "grave" });
      for (let i = 0; i < 6; i++) r = step(r, 0);
      return r;
    })(),
  },
};
export const Indonesian: Story = { args: { lang: "id" } };
