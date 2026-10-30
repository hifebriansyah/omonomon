import type { Meta, StoryObj } from "@storybook/react-vite";
import { OldBrowserBanner } from "./OldBrowserBanner";

const meta = { title: "Components/OldBrowserBanner", component: OldBrowserBanner } satisfies Meta<typeof OldBrowserBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const English: Story = { args: { lang: "en" } };
export const Indonesian: Story = { args: { lang: "id" } };
