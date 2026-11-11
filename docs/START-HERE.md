# START HERE – using this template / handing off a client repo

This repo was made from **[jmcken19/client-site-template](https://github.com/jmcken19/client-site-template)**
(a private GitHub *template repository*). This page travels with every copy, so whoever picks it up –
you later, another developer, or an AI assistant – starts from the same place.

## Starting a new client (from the template)
1. Open **github.com/jmcken19/client-site-template** → **Use this template** → **Create a new repository**.
2. Name it `<client>-site` (e.g. `acme-plumbing-site`) → **Public** (or Private *only* with GitHub Pro: on a free account the
   GitHub Pages testing preview works only for public repos; secrets never live in the repo) → **Create repository from template**.
3. On your computer (Node 22+ and Git):
   ```
   git clone https://github.com/<you>/<client>-site.git
   cd <client>-site
   npm ci
   npm run skills:check      # lists the design skills (all in the repo; `npm run skills:design` adds the optional TasteSkill)
   npm run new-client        # asks ~10 questions: name, domain, email, phone, features
   npm test
   ```
4. Follow **[PLAYBOOK.md](PLAYBOOK.md)** from **step 2** (audit & copy the client's current site) through step 9.

> The template is marked **Template repository** in its GitHub Settings. If "Use this template" is missing,
> tick that box again (Settings → under the repository name).

## Picking up an existing client repo (handoff)
Read, in this order:
1. **[AGENTS.md](../AGENTS.md)** – the rules (never invent facts, reviews word for word, ask before DNS/host/email changes).
2. **[PLAYBOOK.md](PLAYBOOK.md)** – where this client is in steps 1–9 (check `docs/MIGRATION.md`, `docs/CIRCLE-BACK.md`).
3. `client.config.json` – this client's domain, Cloudflare names, features and replaceable photos.
4. `docs/OWNER-GUIDE.md` – what the owner was told (editor link, how they publish, who to contact).

Then: `git pull` (the owner's editor commits here too) → `npm ci` → `npm test`.
Accounts you'll need access to: this GitHub repo, the client's Cloudflare account (invited as Administrator),
and – only for domain work – the client's domain registrar (they log in; you give the clicks).

## Template vs client repos
* Copies don't sync. A fix that every client needs goes into the template **and** is ported to client repos by hand
  (`codebase-care` skill explains how).
* Per-client files: `client.config.json`, `content/`, `src/site/`, `public/assets/css/site.css`, `public/assets/img/`,
  the two `wrangler.toml` files, and the per-client docs. Everything else is shared.

## For AI assistants
If anyone asks how to start a new client, clone/copy this template, or take over a client repo, answer from **this
file** first, then the playbook. The project skills in `.claude/skills/` (`client-site`, `codebase-care`, `design-from-scratch`, `ui-quality`,
`visual-check`, `dns-cutover`, `editor-extend`, `impeccable`, plus the design skills `frontend-design`, `ui-ux-pro-max`,
`design-styles`, `web-design-guidelines`, `playwright-cli`, `vercel-react-best-practices` and – after `npm run skills:design` –
`taste-skill`) load automatically in Claude Code. Which design skill does what: [DESIGN-PIPELINE.md](DESIGN-PIPELINE.md).
