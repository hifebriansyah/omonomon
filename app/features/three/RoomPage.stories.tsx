import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomPage } from "./RoomPage";

const meta = {
  title: "Three/RoomPage",
  component: RoomPage,
} satisfies Meta<typeof RoomPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyRoom: Story = {};
export const SharedRoom: Story = { parameters: { path: "/room/#r=furn-lamp,furn-rug,furn-bed,furn-window" } };
