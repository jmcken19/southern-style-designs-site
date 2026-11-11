# client-site-template

Rebuild a small business's **current** website properly (fast, mobile-friendly, theirs), give the owner a
**dead-simple editor** for their photos and reviews, and host it all on **Cloudflare** for free – without breaking
their email. Extracted from the danmckennahomes.com rebuild (Nov 2026).

**Start here → [docs/START-HERE.md](docs/START-HERE.md)** (new client or taking over a repo), then [docs/PLAYBOOK.md](docs/PLAYBOOK.md)

## New client in 5 lines
1. github.com → this repo → **Use this template** → `<client>-site` (private)
2. `git clone …` → `npm ci` → **`npm run new-client`**
3. Copy their content + photos (playbook step 2), rebuild their design in `src/site/` + `site.css` (step 3)
4. Turn on GitHub Pages → send the client the testing link (step 4)
5. Editor + Cloudflare + DNS + handoff (steps 5–9)

## What's inside
| | |
|---|---|
| **Website build** | Plain Node, no framework. Pages from `src/site/`, shared **[parts](docs/PARTS.md)**: photo slideshow, replaceable photos, drifting reviews row, contact form (FormSubmit), fade-in, testing banner |
| **Owner editor** | Cloudflare Worker + Access sign-in. Photos (slideshow + "photo spots"), reviews. Drafts → Preview → Publish → "✓ Done" only when actually live. Laptop-only by default |
| **Publishing** | GitHub Actions: testing link (Pages, noindex) + live site (Cloudflare) + editor redeploys |
| **Docs** | [Playbook](docs/PLAYBOOK.md) · [Intake checklist](docs/INTAKE-CHECKLIST.md) · [Parts](docs/PARTS.md) · [Security](docs/SECURITY.md) · [Skills & AI](docs/SKILLS.md) · templates for the owner guide, migration table, circle-back list |
| **AI-ready** | `AGENTS.md` rules + six Claude project skills (workflow, codebase care, UI quality, visual check, DNS cutover, editor extensions) travel into every client repo – see [Skills](docs/SKILLS.md) |

## Commands
```
npm run new-client     fill in a new client (asks questions)
npm run configure      rewrite owner/ + site/ wrangler.toml from client.config.json
npm test               build + editor tests        npm run test:ui   editor in a real browser (needs Chrome)
npm run build:preview  testing build into dist/    npm run photo -- hero|page <file> <name>
npm run shots          screenshot every page (phone + laptop) and flag problems
npm run dns:snapshot -- example.com   record all DNS before a domain move
```

## Improving the template
Fix it here, then copy the fix into existing client repos by hand (template changes don't flow to old copies).
Keep client-specific things out of this repo.
