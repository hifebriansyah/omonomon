import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { UpdatePromptView } from "./UpdatePrompt";

// The view only: the real UpdatePrompt registers a service worker, which Storybook never does.
const meta = { title: "PWA/UpdatePrompt", component: UpdatePromptView, args: { onReload: fn(), onClose: fn() } } satisfies Meta<typeof UpdatePromptView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};
