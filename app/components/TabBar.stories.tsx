import type { Meta, StoryObj } from "@storybook/react-vite";
import { TabBar } from "./TabBar";

const meta = { title: "Components/TabBar", component: TabBar, args: { lang: "en", active: "chats" } } satisfies Meta<typeof TabBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Chats: Story = {};
export const Games: Story = { args: { active: "games" } };
export const WhispersDot: Story = { args: { active: "me", dot: true } };
export const Indonesian: Story = { args: { lang: "id" }, globals: { locale: "id" } };
