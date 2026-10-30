import type { Meta, StoryObj } from "@storybook/react-vite";
import { WhispersApiContext, type WhispersApi } from "~/features/whispers/api";
import { characters } from "~/lib/content";
import { Profile } from "./Profile";

const fakeApi: WhispersApi = {
  enabled: true,
  async request() {
    return { status: 200, data: {} };
  },
  async getJson<T>() {
    return {
      whispers: [
        { n: 1, ghost: "1", t: Date.parse("2026-10-30T12:00:00Z"), text: { en: "Still tied up.", id: "Masih terikat." }, loves: 3, comments: 1 },
      ],
      more: false,
    } as unknown as T;
  },
};

const meta = {
  title: "Shell/Profile",
  component: Profile,
  args: { character: characters[0] },
  decorators: [
    (Story) => (
      <WhispersApiContext value={fakeApi}>
        <Story />
      </WhispersApiContext>
    ),
  ],
} satisfies Meta<typeof Profile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pocomon: Story = {};
export const Sundemon: Story = { args: { character: characters[2] } };
