import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters, games } from "~/lib/content";
import type { GameProps } from "../types";
import Game from "./Game";

const game = games.find((g) => g.slug === "daily")!;
const char = characters.find((c) => c.id === game.character)!;
const props: GameProps = { onOver: () => {}, lang: "en", char, chars: characters, best: 100, reduceMotion: false, game };

const meta = {
  title: "Games/Daily Challenge",
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

export const HopHopDay: Story = { args: { forceDate: "2026-10-30" } };
export const HairCatchDay: Story = { args: { forceDate: "2026-10-31" } };
export const Playing: Story = { args: { forceDate: "2026-10-30", demo: "playing" } };
export const Indonesian: Story = { args: { lang: "id", forceDate: "2026-10-30" } };
