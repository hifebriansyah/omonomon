// Talking to the API Worker about whispers: the feed, one whisper, comments and loves. The same calls as the old
// shell/whispers.js. The client sits in a React context, so Storybook can hand in a fake one and never touch the network.
import { createContext, useContext } from "react";
import { config } from "~/lib/config";
import type { WhisperPage } from "./types";

export interface ApiOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiAnswer {
  status: number;
  // whatever JSON came back ({} when there was none)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface WhispersApi {
  /** False when no API is set up (config.API_URL is empty): the pages say so instead of loading. */
  enabled: boolean;
  /** A call that answers with its status and JSON (comments, loves, one whisper). */
  request(path: string, options?: ApiOptions): Promise<ApiAnswer>;
  /** A GET that throws unless it worked (the feed pages). */
  getJson<T>(path: string): Promise<T>;
}

export function httpApi(base: string = config.API_URL): WhispersApi {
  return {
    enabled: Boolean(base),
    async request(path, options) {
      // as before: a plain GET has no options; anything else sends JSON
      const res = await fetch(
        `${base}${path}`,
        options && { method: options.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body), signal: options.signal },
      );
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
    async getJson<T>(path: string) {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
      return (await res.json()) as T;
    },
  };
}

const defaultApi = httpApi();
export const WhispersApiContext = createContext<WhispersApi>(defaultApi);
export const useWhispersApi = () => useContext(WhispersApiContext);

export const PAGE_SIZE = 20; // whispers per page in the feed (more load as the visitor scrolls)

export const feedPath = (opts: { before?: number; fresh?: boolean } = {}) =>
  `/whispers?limit=${PAGE_SIZE}${opts.before ? `&before=${opts.before}` : ""}${opts.fresh ? `&x=${Date.now()}` : ""}`; // &x= skips the 2 minute cache

export type { WhisperPage };
