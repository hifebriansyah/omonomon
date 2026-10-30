import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { characters } from "~/lib/content";
import type { ChatMessage } from "~/lib/storage";
import { ChatScreen } from "./ChatScreen";
import { resetChat, setPending, setReplyFn, setStartError, setTrouble } from "./chat-store";

const pocomon = characters[0];
const now = Date.parse("2026-10-31T10:00:00Z");
const longSeed: ChatMessage[] = [
  { who: "user", text: "Hello Pocomon, are you awake?", t: now - 3600_000 },
  { who: "bot", text: "I am always awake. Mostly because you keep tapping on my screen.", t: now - 3590_000 },
  { who: "user", text: "What is it like inside the cemetery tonight?", t: now - 1800_000 },
  { who: "bot", text: "Damp, quiet, and full of crickets who do not know how to stay in tune.", t: now - 1790_000 },
];

const meta = {
  title: "Chat/ChatScreen",
  component: ChatScreen,
  args: { character: pocomon, seed: [] },
  decorators: [
    (Story) => {
      useEffect(() => {
        resetChat();
        setReplyFn(async (_c, text) => ({ text: `Hm. You said "${text}".` }));
        return () => resetChat();
      }, []);
      return <Story />;
    },
  ],
} satisfies Meta<typeof ChatScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyChat: Story = { args: { seed: [] } };
export const LongHistory: Story = { args: { seed: longSeed, initialHistoryOpen: true } };
export const GeminiThinking: Story = {
  args: { seed: longSeed },
  decorators: [
    (Story) => {
      useEffect(() => {
        setPending(pocomon.id, 1);
        return () => setPending(pocomon.id, 0);
      }, []);
      return <Story />;
    },
  ],
};
export const TroubleStatus: Story = {
  args: { seed: longSeed },
  decorators: [
    (Story) => {
      useEffect(() => {
        setTrouble(true);
        return () => setTrouble(false);
      }, []);
      return <Story />;
    },
  ],
};
export const ErrorState: Story = {
  args: { seed: [] },
  decorators: [
    (Story) => {
      useEffect(() => {
        setStartError("Could not start (offline).");
        return () => setStartError(null);
      }, []);
      return <Story />;
    },
  ],
};
