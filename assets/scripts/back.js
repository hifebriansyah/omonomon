// The back arrow in a page header. When the visitor came from another page of this site (a whisper in the feed, a profile, the Me
// page) it goes back in history, so that page is restored exactly as it was (scroll included). Otherwise (a shared link, a
// bookmark) it keeps its normal address. If the page pushed history entries of its own since it loaded (the chat's history panel
// does), a plain link is used, because going back would only close the panel.

export function smartBack(button) {
  if (!button) return;
  let fromHere = false;
  try {
    const ref = document.referrer && new URL(document.referrer);
    // the whisper opened from the feed has the same path (/whispers/) and only a different ?n=, so the query counts as part of the page
    fromHere = Boolean(ref) && ref.origin === location.origin && ref.pathname + ref.search !== location.pathname + location.search;
  } catch {}
  const startLength = history.length;
  button.addEventListener("click", (e) => {
    if (!fromHere || history.length !== startLength) return;
    e.preventDefault();
    history.back();
  });
}
