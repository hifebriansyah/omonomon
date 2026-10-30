import type { Meta, StoryObj } from "@storybook/react-vite";
import { HomeList } from "./HomeList";

const meta = {
  title: "Shell/HomeList",
  component: HomeList,
} satisfies Meta<typeof HomeList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Indonesian: Story = { parameters: { path: "/id/" }, globals: { locale: "id" } };
