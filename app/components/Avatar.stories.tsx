import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters } from "~/lib/content";
import { Avatar } from "./Avatar";

const meta = { title: "Components/Avatar", component: Avatar, args: { character: characters[0] } } satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const AllGhosts: Story = { render: () => <div className="flex gap-3">{characters.map((c) => <Avatar key={c.id} character={c} />)}</div> };
export const GoldFrame: Story = { args: { frame: true }, decorators: [(S) => <div style={{ ["--frame" as string]: "0 0 0 3px #f5c542, 0 0 12px #f5c542aa" }}><S /></div>] };
