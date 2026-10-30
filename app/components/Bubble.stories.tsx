import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bubble, Dots } from "./Bubble";

const meta = { title: "Components/Bubble", component: Bubble, args: { children: "Hm. You again. Sit." } } satisfies Meta<typeof Bubble>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ghost: Story = {};
export const Visitor: Story = { args: { who: "you", children: "hi pocomon" } };
export const Thinking: Story = { args: { children: <Dots /> } };
export const Long: Story = { args: { children: "Being dead is cold and boring, and this cloth is the only thing that still holds me together. Don't tell anyone I said that." } };
export const NightBubble: Story = { decorators: [(S) => <div style={{ ["--bubble-bg" as string]: "#25274d", ["--bubble-ink" as string]: "#f1f1ff" }}><S /></div>] };
