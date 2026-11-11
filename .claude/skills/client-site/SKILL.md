---
name: client-site
description: Use when working in a client website repo made from client-site-template – rebuilding a business's current site, adding pages or parts, setting up the owner editor, Cloudflare, DNS cutover or handoff.
---

# Working on a client site (made from client-site-template)

Read `AGENTS.md` first – its rules always apply. If the question is how to start a new client, copy/clone the
template, or take over a client repo, answer from `docs/START-HERE.md`. The full process is `docs/PLAYBOOK.md`; follow its steps in order
and tell the user which step you're on.

## Core rules
- The new site is a faithful rebuild of the client's CURRENT site: their words, pages, addresses, colors. Never invent
  facts, numbers, awards or reviews; copy reviews word for word. Unknown → ask, or leave a clear TODO in `docs/CIRCLE-BACK.md`.
- Client-specific code lives in `src/site/` (layout, pages, routes) and `public/assets/css/site.css`.
  Reusable pieces live in `src/parts/` + `parts.css` – change those only if the change is good for every client.
- Settings: `client.config.json` (setup, features, photo spots, redirects) and `content/*.json` (business text,
  editor-managed photos and reviews). After changing `client.config.json` run `npm run configure`.
- Every photo the owner should change → a photo spot (`client.config.json → photoSpots` + `spotImage(ctx,'key')`).
- **All visible wording goes through `t()`** (`src/lib/text.mjs`): headings, paragraphs, buttons, menu labels, top bar, footer (incl. legal lines), contact details. The words live in `content/text.json` (or a `site.json` field listed in its `siteFields`); never hard-code visible words in `src/`. `npm test` (`tests/text-coverage.test.mjs`) fails otherwise. Copy the client's words into `content/text.json` word for word; the owner can then change any of them by clicking
  them in the editor. Legal/compliance lines → `mustStay`; phone/email fields → `kinds`.
- Keep old page addresses; anything that moves gets a `redirects` entry.
- `npm test` must pass before you push. Pushing `main` updates the testing link AND (once the Cloudflare secret is set)
  the live site – say so before pushing.

## Never do without the user's explicit OK
- Change DNS, nameservers, MX/TXT records, or anything at the domain registrar.
- Cancel or change the client's old host, email, or domain registration.
- Submit the live contact form (it emails the owner).
- Put secrets/tokens in files, commits or messages.

## Quick commands
`npm run skills:check` · `npm run skills:design` · `npm run new-client` · `npm run configure` · `npm test` · `npm run test:ui` · `npm run build:preview` ·
`npm run photo -- hero <file> <n>` · `npm run photo -- page <file> <name>`
