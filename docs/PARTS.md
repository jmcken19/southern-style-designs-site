# Parts library

Reusable pieces (code in `src/parts/index.mjs`, styles in `public/assets/css/parts.css`, behaviour in
`public/assets/js/site.js`). Use a part only if the client's site has – or asked for – that thing.
Parts take their colors/fonts from the design tokens in `site.css` (`--accent`, `--ink`, `--head`, …).
**All visible wording goes through `t()`** (`src/lib/text.mjs`): parts take text **keys**, not words (e.g.
`reviewsRow(ctx, { titleKey: 'reviews.rowTitle' })`), and the words live in `content/text.json`. The owner can then click
and change any of them; `tests/text-coverage.test.mjs` fails for hard-coded words. See docs/EDITOR.md → "Words".

| Part | Call | What the owner can change in the editor | Notes |
|---|---|---|---|
| **Homepage slideshow** | `heroSlideshow(ctx, { inner })` | Add/remove/reorder photos, which part stays in view, speed (slow/normal/fast), slide or fade, slideshow vs one still photo | `inner` = headline/buttons on top. Needs `features.slideshow: true` and `heroSlides` in site.json. Pauses for keyboard users; never autoplays a Play button |
| **Photo spot** (one replaceable photo) | `spotImage(ctx, 'key', { className, sizes })` | Replace the photo (click or drag), preview the page, undo | Define in `client.config.json → photoSpots` (label, where, page, tip, minEdge, defaults). `spotIsOriginal(ctx,'key')` lets you show a caption only for the original photo |
| **Reviews row** | `reviewsRow(ctx, { titleKey, viewAllKey })` | Add/edit/remove/arrange reviews | All reviews in the order of `content/reviews.json` (the owner arranges it), random start, drifts slowly; drag with mouse/finger (flick glides); pauses on hover; fades in on scroll. Needs `features.reviews: true` |
| **Review card / full review** | `reviewCard(ctx, t, { level })`, `reviewFull(t)` | ↑ | Used by the reviews page and single-review pages. Addresses: `reviewsPath` + slug |
| **Contact form** | `contactForm(ctx, { id, titleKey, prefill, level })` | Its words (title, labels, button) | FormSubmit (free, no account) → `site.contactFormTo`. Off on previews. Spam trap. Owner must click "Activate Form" in the first email |
| **Fade-in on scroll** | add `data-reveal` to a `<section>` | – | Children of the section's first element fade up in turn |
| **Testing banner** | `testingBanner(ctx)` (in layout) | – | Only on the testing link/editor preview; has a Hide button |
| **Head tags** | `headTags(ctx, { path })` (in layout) | – | noindex on previews, canonical on live, favicon set, CSS/JS with cache-busting |
| **Redirect page** | `redirectPage(to)` | – | Used for `client.config.json → redirects` and removed reviews |

## Adding a new part
1. Write it in `src/parts/index.mjs` (plain function returning HTML; escape every value with `e()`). Every visible word
   through `t(ctx, key)` (take the key as an option, default to a shared key, add the words to `content/text.json`).
2. Styles in `parts.css` using tokens only; behaviour in `site.js` (vanilla JS, no libraries, must work without JS).
3. Add a test in `tests/content.test.mjs`, and a row above.
4. If the owner should edit it: add an area in `owner/src/` (copy `reviews.mjs` – draft in D1, revision check,
   preview through `renderPath`, publish as one Git commit) plus a screen in `owner/ui/app.js`.

## Ideas proven useful (not built yet)
Team members, services list with prices, business hours, project gallery, FAQ, announcement bar. Build each one
the first time a client actually needs it, then add it here.
