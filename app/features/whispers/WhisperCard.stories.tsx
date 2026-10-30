import type { Meta, StoryObj } from "@storybook/react-vite";
import { characters } from "~/lib/content";
import { WhispersApiContext, type WhispersApi } from "./api";
import { WhisperCard } from "./WhisperCard";
import type { Whisper } from "./types";

const now = Date.parse("2026-10-30T15:00:00Z");
const sampleWhisper: Whisper = {
  n: 42,
  ghost: "1",
  t: now,
  text: { en: "Does anyone else hear the crickets tonight?", id: "Ada yang dengar suara jangkrik malam ini?" },
  loves: 5,
  comments: 2,
};

const fakeApi: WhispersApi = {
  enabled: true,
  async request(path) {
    if (path.endsWith("/comments")) {
      return {
        status: 200,
        data: {
          comments: [
            { id: 1, who: "user", name: "NightWalker", text: "Loud and clear!", t: now - 600_000 },
            { id: 2, who: "bot", name: "Pocomon", text: "Good. Tell them to quiet down.", t: now - 590_000 },
          ],
        },
      };
    }
    return { status: 200, data: { loves: 6 } };
  },
  async getJson<T>() {
    return {} as T;
  },
};

const meta = {
  title: "Whispers/WhisperCard",
  component: WhisperCard,
  args: { w: sampleWhisper, ghost: characters[0], single: false },
  decorators: [
    (Story) => (
      <WhispersApiContext value={fakeApi}>
        <ul className="m-0 max-w-page list-none p-0">
          <Story />
        </ul>
      </WhispersApiContext>
    ),
  ],
} satisfies Meta<typeof WhisperCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithoutCommentsOpen: Story = {};
export const WithCommentsOpen: Story = { args: { single: true } };
export const WithLinkCard: Story = {
  args: {
    w: {
      ...sampleWhisper,
      n: 43,
      link: { url: "https://example.com/story", title: "Old Tales of Jakarta", source: "example.com" },
    },
  },
};
