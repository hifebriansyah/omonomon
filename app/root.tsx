import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";
import { I18nextProvider } from "react-i18next";
import type { Route } from "./+types/root";
import { i18nFor } from "./i18n";
import { site } from "./lib/content";
import { langOfPath } from "./lib/lang";
import { OLD_BROWSER_SCRIPT } from "./components/OldBrowserBanner";
import "./styles/app.css";

const BASE = import.meta.env.BASE_URL;

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: `${BASE}build/img/favicon.ico`, sizes: "48x48" },
  { rel: "apple-touch-icon", href: `${BASE}build/img/apple-touch-icon.png` },
  { rel: "manifest", href: `${BASE}manifest.webmanifest` },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const lang = langOfPath(useLocation().pathname);
  return (
    <html lang={lang} className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <meta name="theme-color" content={site.themeColor} />
        <meta name="apple-mobile-web-app-title" content={site.name} />
        {/* Dark from the very first paint (before the stylesheet arrives), so there is no white flash. */}
        <meta name="color-scheme" content="dark" />
        <style>{`html{background:${site.themeColor};color-scheme:dark}`}</style>
        {/* Before the app: tell visitors on a browser that is too old (old JavaScript on purpose, see OldBrowserBanner.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: OLD_BROWSER_SCRIPT }} />
        <script noModule dangerouslySetInnerHTML={{ __html: "window.__omonOld&&window.__omonOld(true)" }} />
        <Meta />
        <Links />
      </head>
      <body>
        {/* Icons: Lucide (https://lucide.dev), ISC License. three.js: MIT License, see the licence notice in builds. */}
        <I18nextProvider i18n={i18nFor(lang)}>{children}</I18nextProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Error";
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">{site.name}</h1>
        <p className="mt-2 text-muted">{message}</p>
      </div>
    </main>
  );
}
