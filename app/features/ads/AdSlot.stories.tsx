import type { Meta, StoryObj } from "@storybook/react-vite";
import { site } from "~/lib/content";
import { AdSlot } from "./AdSlot";

// Storybook never loads Google's script: every story uses the grey placeholder.
const meta = { title: "Ads/AdSlot", component: AdSlot, args: { ads: site.ads, placeholder: true } } satisfies Meta<typeof AdSlot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = { decorators: [(S) => <div className="max-w-page"><S /></div>] };
export const NoAdsConfigured: Story = { args: { ads: null } };
