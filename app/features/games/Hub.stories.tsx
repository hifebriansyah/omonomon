import type { Meta, StoryObj } from "@storybook/react-vite";
import { Hub } from "./Hub";

const meta = {
  title: "Games/Hub",
  component: Hub,
} satisfies Meta<typeof Hub>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Indonesian: Story = { parameters: { path: "/id/games/" }, globals: { locale: "id" } };
