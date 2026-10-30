import type { Meta, StoryObj } from "@storybook/react-vite";
import { AccountPanelView } from "./AccountPanel";

// Made-up states only: no Google, Turnstile or API calls. The fake button stands where Google draws its own.
const FakeGoogleButton = (
  <div className="mt-2.5">
    <span className="inline-flex h-10 items-center rounded-full bg-[#131314] px-4 text-sm text-white">Sign in with Google</span>
  </div>
);

const user = { email: "rani@example.com", name: "Rani", picture: "" };

const meta = {
  title: "Account/AccountPanel",
  component: AccountPanelView,
  args: { mode: "guest", signIn: FakeGoogleButton },
} satisfies Meta<typeof AccountPanelView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AccountsOff: Story = { args: { mode: "off" } };
export const Guest: Story = {};
export const SignedIn: Story = { args: { mode: "signedIn", user } };
export const SignedInEmailOnly: Story = { args: { mode: "signedIn", user: { email: "rani@example.com" } } };
export const SignInError: Story = { args: { mode: "guest", error: "Sign-in did not work. Please try again." } };
