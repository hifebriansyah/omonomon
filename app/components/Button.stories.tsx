import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta = { title: "Components/Button", component: Button, args: { children: "Play again" } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Comic: Story = {};
export const Outline: Story = { args: { variant: "outline", children: "Sign out" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete account" } };
export const Disabled: Story = { args: { disabled: true } };
