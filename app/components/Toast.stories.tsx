import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToastView } from "./Toast";

const meta = { title: "Components/Toast", component: ToastView, args: { text: "Bond with Pocomon: level 3, Neighbour" } } satisfies Meta<typeof ToastView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const QuestDone: Story = { args: { text: "Quest done: Play 2 games (+10 candles)" } };
