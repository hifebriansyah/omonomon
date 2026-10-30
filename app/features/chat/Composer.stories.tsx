import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Composer } from "./Composer";

const meta = {
  title: "Chat/Composer",
  component: Composer,
  args: { placeholder: "Say something to Pocomon...", sendLabel: "Send", max: 200, onSend: fn() },
  decorators: [(S) => <div className="max-w-page" style={{ ["--accent" as string]: "#a47fd0" }}><S /></div>],
} satisfies Meta<typeof Composer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
/** The counter shows from 75% of the limit; type a few letters to see it (the limit here is 20). */
export const ShortLimit: Story = { args: { max: 20 } };
export const NotReady: Story = { args: { onSend: fn(() => false) } };
