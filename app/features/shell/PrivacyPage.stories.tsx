import type { Meta, StoryObj } from "@storybook/react-vite";
import { PrivacyPage } from "./PrivacyPage";

const meta = {
  title: "Shell/PrivacyPage",
  component: PrivacyPage,
} satisfies Meta<typeof PrivacyPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const English: Story = {};
export const Indonesian: Story = { parameters: { path: "/id/privacy/" }, globals: { locale: "id" } };
