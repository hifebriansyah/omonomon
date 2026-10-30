import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { applyMove, initialState } from "./logic";

const game = games.find((g) => g.slug === "congklak")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };

const meta = {
  title: "Games/Congklak",
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
  args: { initialOppId: "3", initialBoard: applyMove(initialState(), 0, false).state },
};
export const GameOver: Story = {
  args: {
    initialOppId: "3",
    initialBoard: { b: [0, 0, 0, 0, 0, 0, 0, 56, 0, 0, 0, 0, 0, 0, 0, 42], turn: 0, over: true },
  },
};
export const Indonesian: Story = { args: { lang: "id", initialOppId: "3" } };
