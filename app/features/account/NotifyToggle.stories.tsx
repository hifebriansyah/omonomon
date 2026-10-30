import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotifyToggleView } from "./NotifyToggle";

// Made-up states only: no permission prompt, service worker or API call.
const meta = { title: "Account/NotifyToggle", component: NotifyToggleView, args: { checked: false } } satisfies Meta<typeof NotifyToggleView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unsupported: Story = { args: { disabled: true, note: "notifyUnsupported" } };
export const Off: Story = {};
export const On: Story = { args: { checked: true, note: "notifyOn" } };
export const Denied: Story = { args: { note: "notifyDenied" } };
export const Failed: Story = { args: { note: "notifyError" } };
