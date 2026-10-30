import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sheet } from "./Sheet";

const meta = {
  title: "Components/Sheet",
  component: Sheet,
  args: { open: true, label: "Comments", onClose: () => {}, children: <p>No comments yet. Be the first.</p> },
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const LongContent: Story = { args: { children: <div>{Array.from({ length: 30 }, (_, i) => <p key={i}>Comment {i + 1}</p>)}</div> } };
