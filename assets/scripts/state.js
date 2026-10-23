// The one place that holds the app's changing data.
// Other modules import `state` and read or write its fields.

export const state = {
  site: null,           // site.json: address, name and default description
  manifest: null,       // builds/data/manifest.json: languages, shard info
  characters: [],       // characters.json
  current: null,        // the character on stage
  lastLang: undefined,  // language the chat is in right now ("en" | "id")
  logs: {},             // character id -> [{who, text, g?, e?}]: messages shown and saved
  histories: {},        // character id -> [{role, text}]: context sent to Gemini
  pending: {},          // character id -> replies still on the way
  epoch: {},            // character id -> bumps when its chat is cleared
  failures: 0,          // Gemini failures in a row (not counting "too many requests"); resets on a success
  trouble: null,        // characters.json "trouble": status text shown while Gemini keeps failing
};

export const byId = (id) => state.characters.find((c) => c.id === id);

// Pick the text for the current language out of {en: "...", id: "..."}.
export const inLang = (obj) => obj?.[state.lastLang] || obj?.en || "";
