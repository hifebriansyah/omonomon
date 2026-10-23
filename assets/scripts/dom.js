// Every page element the scripts touch, looked up once.
// The ids come from index.html.

const $ = (id) => document.getElementById(id);

export const stageEl = $("stage");
export const pickerEl = $("picker");
export const nameEl = $("name");
export const statusEl = $("status");
export const heroEl = $("hero");
export const bubbleEl = $("bubble");
export const bubbleText = $("bubbleText");
export const youBubble = $("youBubble");
export const youText = $("youText");
export const srEl = $("sr");              // screen-reader copy of the reply
export const historyBtn = $("historyBtn");
export const historyEl = $("history");
export const messagesEl = $("messages");  // rows inside the history panel
export const clearBtn = $("clearBtn");
export const form = $("form");
export const input = $("input");
export const countEl = $("count");
