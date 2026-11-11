# Design decision – Southern Style Designs (spec / concept site)

**Date:** 2026-11-11 · **Status:** concept for James to show the prospect. Not approved by the client.

The prospect has no website, so this is a from-scratch design (`design-from-scratch` skill), not a rebuild.
Three written directions were offered to James:

| | Direction | Palette | Fonts | Hero |
|---|---|---|---|---|
| **A** | **Magnolia Porch** (built) | cream `#F7F2E8`, sage `#56664B`, brass `#A9844E` (lines only), warm ink `#2E2A25` | Cormorant Garamond + Source Sans Pro | full-width room slideshow, name and buttons centred |
| B | Evening Navy | muted navy, linen, brass | Libre Caslon Display + Mulish | split: navy text panel + slideshow |
| C | Gallery Linen | near-white, linen, sage-grey, brass lines | Gilda Display + Karla | framed slideshow, name block below |

James didn't name a letter ("Decided", then "Ok go"), so **A was built**. It's the closest match to the brief:
warm, Southern, soft creams + sage + brass, and the big full-width photo hero. **Confirm with James**; switching
to B or C mostly means changing the tokens at the top of `public/assets/css/site.css` and the hero layout.

Contrast (WCAG AA): ink on cream 12.8:1, soft text on cream 6.9:1, white on sage buttons 6.2:1, sage links 5.5:1.
`npm run design:check` warns about the cream background: kept on purpose, because the brief asks for soft creams.

## Concept-only settings (remove before any real launch)
* `client.config.json → concept: true` and the `<meta name="robots" content="noindex, nofollow">` in `src/site/layout.mjs`.
* The dismissible "Concept preview prepared by James' Tech Help…" bar (`layout.mjs`, words `concept.banner`).
* The contact form is front-end only (`data-demo-form`, `public/assets/js/client.js`). For a real launch, switch it to
  the template's FormSubmit form (`contactForm()` + `features.contactForm: true`).
* `domain.main` is empty (no domain yet), so the testing banner has no "Go to the live site" link.
