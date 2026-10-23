# Icons

The icons in `index.html` come from [Lucide](https://lucide.dev) v1.61.0 (ISC License, see `LICENSE-lucide.txt`).
They are pasted inline as SVG, so nothing is downloaded at runtime. Used so far: `history`, `x`, `trash-2`.

To add one: copy its `<path>` shapes from `https://unpkg.com/lucide-static@1.61.0/icons/<name>.svg`
into a `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">` (the `.icon` class in
`style.css` sets the colour and line weight). Icon-only buttons need an `aria-label`.
