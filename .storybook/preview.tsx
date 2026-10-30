import type { Decorator, Preview } from "@storybook/react-vite";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { i18nFor } from "../app/i18n";
import { memoryBackend, setStorageBackend } from "../app/lib/storage";
import "../app/styles/app.css";

// Stories never touch the real localStorage and never call the real Workers (Gemini, API): a public Storybook must not spend quota.
setStorageBackend(memoryBackend());
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:/.test(url) && !url.startsWith(location.origin)) {
    return Promise.resolve(new Response(JSON.stringify({ error: "Storybook: network calls are switched off" }), { status: 503 }));
  }
  return realFetch(input, init);
};

const withApp: Decorator = (Story, context) => {
  const lang = context.globals.locale === "id" ? "id" : "en";
  const path = (context.parameters.path as string | undefined) || (lang === "id" ? "/id/" : "/");
  document.documentElement.lang = lang;
  document.documentElement.classList.add("dark");
  return (
    <I18nextProvider i18n={i18nFor(lang)}>
      <MemoryRouter initialEntries={[path]}>
        <div className="min-h-[200px] bg-bg p-4 text-text">
          <Story />
        </div>
      </MemoryRouter>
    </I18nextProvider>
  );
};

const preview: Preview = {
  decorators: [withApp],
  globalTypes: {
    locale: {
      description: "Page language",
      toolbar: { title: "Language", icon: "globe", items: [{ value: "en", title: "English" }, { value: "id", title: "Indonesia" }], dynamicTitle: true },
    },
  },
  initialGlobals: { locale: "en" },
  parameters: { backgrounds: { disable: true }, layout: "fullscreen", a11y: { test: "todo" } },
};
export default preview;
