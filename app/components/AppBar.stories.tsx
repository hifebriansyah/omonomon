import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppBar } from "./AppBar";

const meta = { title: "Components/AppBar", component: AppBar, args: { title: "Hop Hop" } } satisfies Meta<typeof AppBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = { args: { title: "Omon Omon" } };
export const WithBack: Story = { args: { back: "/games/", backLabel: "Back to games", children: <p className="m-0 ml-auto text-sm">Candles: 42</p> } };
