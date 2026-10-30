import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowLeft, Flame, Gamepad2, Ghost, MessageCircle, UserRound, Wind } from "lucide-react";
import { Icon } from "./Icon";

const meta = { title: "Components/Icon", component: Icon, args: { as: Ghost } } satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};
export const Set: Story = { render: () => <div className="flex gap-3">{[MessageCircle, Wind, Gamepad2, UserRound, ArrowLeft, Flame, Ghost].map((G, i) => <Icon key={i} as={G} />)}</div> };
