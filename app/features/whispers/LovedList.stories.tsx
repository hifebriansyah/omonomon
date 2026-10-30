import type { Meta, StoryObj } from "@storybook/react-vite";
import { LovedList } from "./LovedList";

const now = Date.parse("2026-10-30T15:00:00Z");

const meta = {
  title: "Whispers/LovedList",
  component: LovedList,
} satisfies Meta<typeof LovedList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { seed: [] } };
export const WithLovedWhispers: Story = {
  args: {
    seed: [
      { n: 12, ghost: "1", t: now, text: { en: "Even ghosts need a quiet evening.", id: "Hantu juga butuh malam yang tenang." }, link: null, lovedAt: now },
      { n: 9, ghost: "3", t: now - 7200_000, text: { en: "The jasmine is blooming again.", id: "Melatinya mekar lagi." }, link: null, lovedAt: now - 3600_000 },
    ],
  },
};
