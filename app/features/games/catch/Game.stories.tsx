import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";

const game = games.find((g) => g.type === "catch")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 150, reduceMotion: false, game };

const meta = {
  title: "Games/Hair Catch",
  component: Game,
  args: props,
  decorators: [
    (Story) => (
      <div className="relative overflow-hidden rounded-[14px] border-[3px] border-ink bg-[#1a1838]" style={{ ["--accent" as string]: char.accent }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Game>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Start: Story = {};
export const Playing: Story = { args: { demo: "playing" } };
export const GameOver: Story = { args: { demo: "over" } };
export const Indonesian: Story = { args: { lang: "id" } };
