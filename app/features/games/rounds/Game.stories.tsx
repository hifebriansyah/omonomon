import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";

const game = games.find((g) => g.type === "rounds")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };

const meta = {
  title: "Games/Night Rounds",
  component: Game,
  args: props,
  decorators: [
    (Story) => (
      <div
        className="relative grid justify-items-center gap-2.5 overflow-hidden rounded-[14px] border-[3px] border-ink bg-[radial-gradient(circle_at_50%_0%,#2a2f4a,#15172a_70%)] px-3.5 pt-[18px] pb-5"
        style={{ ["--accent" as string]: char.accent }}
      >
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
