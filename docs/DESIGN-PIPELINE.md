# Design pipeline – which skill does what, in what order

There are now several design skills in this repo. Left alone, they would argue with each other (each one wants to
pick fonts and colours). So **each one has one job**, and they run in this order. If two of them disagree, the
earlier rule in this list wins:

1. `AGENTS.md` and the client's own words, photos and brand (word for word, never invented)
2. This page
3. `ui-quality` (accessibility, phone-first, no "AI website" look)
4. Whatever the individual skill says

## Pick the track first

| The client… | Track | Design skills used |
|---|---|---|
| **has a website** (most clients, e.g. Dan) | **A. Faithful rebuild** – copy their look, done properly | Checks only: Impeccable, web-design-guidelines, visual-check, playwright-cli |
| **has no website and no inspiration** (e.g. the volleyball club) | **B. From scratch** – 3 directions, client picks one | All of them, in the order below |
| **has a site but wants a new look** | **B**, but the brief starts from their logo, colours and photos | All of them |

## Track A – faithful rebuild (PLAYBOOK step 3)
Do **not** use frontend-design, taste-skill, design-styles or ui-ux-pro-max to restyle a faithful rebuild – their whole
job is to make it *different*, and the job here is to make it *the same, but better built*.

| # | Step | Skill / command | Done when |
|---|---|---|---|
| A1 | Copy the look: colours, fonts, spacing, page order from the old site (screenshots in `old-site/`) | – | Side by side, a visitor would say "same site" |
| A2 | Accessibility and code audit of the built pages | `web-design-guidelines` on `src/` and `public/assets/css/` | Every finding fixed or written down as "client's choice" |
| A3 | Generic-look and contrast check | `npm run design:check` (Impeccable) | Real problems fixed; the client's own choices recorded as exceptions |
| A4 | Screenshots at phone + laptop size, actually looked at | `visual-check` (`npm run shots`) | No broken images, sideways scroll or overlaps |
| A5 | Click through: menu, slideshow, every link, the form (local preview, form not submitted) | `npm run serve` + `playwright-cli` (`visual-check`) | Everything works by keyboard and touch size |
| A6 | Editor still works | `npm run test:ui` and `npm run test:visual` | Pass |

## Track B – from scratch (`design-from-scratch` skill)

| # | Step | Skill / command | Output |
|---|---|---|---|
| B1 | Brief: visitors, the one main action, what they already have, their 3 words | `design-from-scratch` step 1 | `docs/DESIGN-BRIEF.md` |
| B2 | Category research: which page pattern and UX rules fit this kind of business | `ui-ux-pro-max` (`--design-system`) **for patterns and UX rules only** + 8–12 real sites (`design-from-scratch` step 2) | `docs/DESIGN-RESEARCH.md` |
| B3 | Three really different directions, each starting from a concrete style | `design-styles` (pick a style per direction) | 3 entries in `DESIGN-RESEARCH.md` |
| B4 | For each direction: token plan (4–6 colours, type, layout sketch), then **review it against the brief** and change anything generic | `frontend-design` (its two-pass process) | The plan, with "what I changed and why" |
| B5 | Build the 3 quick previews with the client's real words and photos | – | `design/directions/1-3.html` |
| B6 | *Optional, advisory:* TasteSkill's checker on a preview, read as suggestions (tried on the volleyball home page Nov 10: 65 FAILs, mostly "every section must be one full screen" – wrong for small-business pages, so it is **not** a gate) | `npm run skills:design`, then `node .claude/skills/taste-skill/scripts/gate.mjs --start <page> --kind <kind> --category "…" --primary "…"` and `gate.mjs <page>` | Useful findings (photo use, crowding, tap size) fixed; the rest ignored |
| B7 | Generic-look check | `npx impeccable detect design/directions/` | Clean, or exceptions with reasons |
| B8 | Phone + laptop screenshots, then send to the client | `visual-check` | The client picks one (their words in `docs/DESIGN-DECISION.md`) |
| B9 | Build the real site in the chosen direction, record it | `/impeccable init` + `/impeccable document` | `PRODUCT.md`, `DESIGN.md` |
| B10 | Same checks as Track A, steps A2–A6 | – | All pass |

## Rules every skill follows here (the "house rules" at the top of each one)
* **Words:** the client's, word for word, through `t()`. No skill writes copy, stats, awards or reviews. A missing
  word is a marked gap and a question in `docs/CIRCLE-BACK.md`.
* **Brand:** the client's logo colours and photos beat any palette or stock photo a skill suggests.
* **Small-business limits:** no shaders, WebGL, scroll-jacking or 3D unless the client asks (and then with a plain
  fallback). One orchestrated motion moment at most; `prefers-reduced-motion` respected.
* **Stack:** plain static HTML/CSS + the template's parts. No React, Tailwind or shadcn gets added to use a skill.
* **Real browsers only touch the local preview.** Never submit a live form or log into a client account.

## Not used, on purpose
| Skill | Why not |
|---|---|
| shadcn | React component kit – our sites are static HTML |
| GSAP skills, Apple Design | Heavy motion and gesture physics; wrong for small-business sites (and our motion rules) |
| img2threejs | Optional only (`npm run skills:design -- --with-3d`) when a client explicitly wants a 3D model |
| vercel-react-best-practices | Installed but dormant: only for a site built in React/Next.js |
| Superpowers (plugin) | A whole brainstorm/plan/execute workflow; it overlaps `PLAYBOOK.md` and this page and would compete with them |

## Checking the skills are there
`npm run skills:check` – no download; lists each skill and its pinned version, and fails if one is missing or
changed. `npm run skills:design` installs the one that isn't committed (TasteSkill). Details: [SKILLS.md](SKILLS.md).
