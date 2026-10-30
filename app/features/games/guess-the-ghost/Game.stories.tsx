import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";
import { dailySet } from "./logic";

const game = games.find((g) => g.slug === "guess-the-ghost")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 0, reduceMotion: false, game };
const DATE = "2026-10-31";

const meta = {
  title: "Games/Tebak Hantu",
  component: Game,
  args: { ...props, date: DATE },
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

/** Line 4, the last answer was right (green), "Next" is showing. */
export const Playing: Story = { args: { resume: { idx: 3, score: 36, streak: 3, picked: dailySet(DATE)[3].ghost } } };

/** Line 10 answered wrong: "Finish" ends the run and reports the score. */
export const LastLine: Story = {
  args: { resume: { idx: 9, score: 128, streak: 0, picked: dailySet(DATE)[9].ghost === "1" ? "2" : "1" } },
};

export const Indonesian: Story = { args: { lang: "id" } };
