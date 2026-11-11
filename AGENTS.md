# AGENTS.md – working on a client website (made from client-site-template)

Canonical instructions for any AI assistant (Claude, ChatGPT/Codex, Copilot…) or person working in this repo.
`CLAUDE.md` only points here. **New client, copying the template, or taking over this repo → `docs/START-HERE.md` first.**
The step-by-step process is `docs/PLAYBOOK.md`.

## What this is
* **Public website** for one small business. A plain static site: `scripts/build.mjs` turns `client.config.json`,
  `content/*.json`, `src/site/` (this client's design) and `src/parts/` (shared pieces) into HTML. No framework.
* **Owner editor** (`owner/`): a Cloudflare Worker the business owner uses on their **laptop** to change website
  photos and reviews. Sign-in is Cloudflare Access. Drafts stay private (D1 + KV); Publish = one Git commit here.
* **Hosting:** pushes to `main` update the **testing link** (GitHub Pages, banner + noindex) and the **live site**
  (Cloudflare Worker `site/`, via `.github/workflows/live.yml`). Editor code changes redeploy the editor.

The owner is usually non-technical. Never ask them to use Git, GitHub, a terminal or a token.

## Ground rules
1. **Never invent facts.** No made-up services, prices, numbers, awards, years, areas or quotes. The site copies the
   client's current website; missing info → ask one specific question, or note it in `docs/CIRCLE-BACK.md`.
2. **Never write or reword a client review.** Reviews are copied word for word (owners may edit their own in the editor).
3. **Change only what was asked.** Preserve unrelated fields, files and photos.
4. **Keep old page addresses.** If a path must change, add `client.config.json → redirects`.
5. **Report exactly what changed:** files, fields (old → new), the commit, and whether it went live.
6. **Questions are not instructions.** "What would it look like if…?" → describe it, or use a branch; don't publish to `main`.
7. **Ask first** before: DNS/nameserver/MX/TXT changes, cancelling a host/email/domain, submitting the live contact
   form, or anything that costs money.
8. Keep private things out of the repo: tokens, original photos with GPS, visitor messages, unconfirmed content.
9. Photos: only ones the client owns. Run new photos through `npm run photo` (strips GPS, makes sizes).
10. **All visible wording goes through `t()`** (`src/lib/text.mjs`) – headings, paragraphs, buttons, menu labels, top bar,
    footer (incl. legal lines), contact details. Words live in `content/text.json` (or `site.json` fields listed in its
    `siteFields`); never hard-code visible words in `src/`. `npm test` fails otherwise (docs/EDITOR.md → "Words").
11. `npm test` must pass before pushing. After visual changes also run `npm run design:check` (warnings, not a gate).

## Layout
```
client.config.json          setup: client name, domain, repo, Cloudflare ids, features, photo spots, redirects
content/site.json           business facts + what the editor manages (heroSlides…, photos)
content/text.json           ALL other wording on the site (owner changes it by clicking words in the editor); rules: siteFields, kinds, mustStay
content/reviews.json        reviews (verbatim), in the order shown (first shows first). removedSlugs = old addresses that forward to the reviews page
src/site/                   THIS CLIENT's layout, pages and page list (routes.mjs) – rebuilt per client
src/parts/index.mjs         shared parts: slideshow, photo spots, reviews row/cards, contact form, banner, head tags
src/lib/                    helpers + validation shared by build, editor and tests
public/assets/css/          site.css (this client's look; imports parts.css)  parts.css (shared)
public/assets/js/site.js    behaviour for the parts (menu, slideshow, reviews row, form, fade-in, banner)
scripts/                    build · new-client · configure (writes wrangler.toml files) · prepare-photo · screenshots · dns-snapshot
owner/                      the owner editor (Worker code, UI, D1 migration, generated wrangler.toml)
site/                       the live-site Worker (apex → www redirect, headers; generated wrangler.toml)
tests/                      npm test (build + editor API); npm run test:ui (editor in a real browser)
docs/                       PLAYBOOK, INTAKE-CHECKLIST, PARTS, SECURITY, SKILLS, templates for per-client docs
.claude/skills/             project skills: client-site, codebase-care, design-from-scratch, ui-quality, visual-check, dns-cutover, editor-extend, impeccable
                            design skills from other repos (pinned, house rules on top): frontend-design, ui-ux-pro-max, design-styles,
                            web-design-guidelines, playwright-cli, vercel-react-best-practices, taste-skill (fetched – see below)
.claude/settings.json       Impeccable design hook (checks UI files after edits)   .impeccable/config.json  its settings + recorded exceptions
```

## Design skills – one job each
* Before design work, run `npm run skills:check` (every skill except the optional `taste-skill` is committed; `npm run
  skills:design` downloads that one). Don't install other skills or plugins without asking James.
* Which skill does what and in what order: **docs/DESIGN-PIPELINE.md**. Faithful rebuild (the client has a site) =
  Track A: checks only – never restyle it with frontend-design, taste-skill, design-styles or ui-ux-pro-max.
* The house rules at the top of every design skill win over the rest of that skill: client words word for word
  (no skill writes copy), client brand and photos first, no shaders/WebGL/3D on small-business sites, plain HTML/CSS.

## Common tasks
* **Text change:** edit `content/text.json` (or the `site.json` field) → `npm test` → push. (The owner can do it himself:
  click the words in the editor.) New words on a page: `t(ctx, 'page.thing')` in the page + the words in `text.json`.
* **New page:** add a function in `src/site/pages.mjs` + an entry in `src/site/routes.mjs` (+ menu in `client.config.json → nav` or `layout.mjs`).
* **Let the owner change another photo:** add a photo spot in `client.config.json → photoSpots`, use `spotImage(ctx,'key')`
  where it appears, `npm run configure`, push (the editor redeploys and shows a new box).
* **Undo a published change:** `git revert <sha>` → push. The editor picks up repo changes next time it opens.

## If you can't write to the repo
Say so plainly. Don't claim the site changed. Write the exact change (file, field, new text) so the maintainer can apply it.
