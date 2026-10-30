import type { Meta, StoryObj } from "@storybook/react-vite";
import { MePage } from "./MePage";

const meta = {
  title: "Shell/MePage",
  component: MePage,
} satisfies Meta<typeof MePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Indonesian: Story = { parameters: { path: "/id/me/" }, globals: { locale: "id" } };
