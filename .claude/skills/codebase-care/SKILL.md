---
name: codebase-care
description: Use for any code change in a client site repo or the template – orienting in the codebase, making a safe change, verifying it went live, undoing, updating dependencies, or porting a fix between the template and client repos.
---

# Managing the codebase safely

## Orient first (2 minutes, every session)
1. Read `AGENTS.md` (rules) and skim `docs/PLAYBOOK.md` if the task is about setup or launch.
2. `git status` and `git log --oneline -10` – the **owner's editor commits to this repo too** ("Update website photos…",
   "Update client reviews…"). Never assume your copy is current: `git pull --rebase` before you start.
3. Find things fast: `git ls-files`, `grep -rn "<text>" src owner scripts content`. Map:
   pages → `src/site/`, shared pieces → `src/parts/`, owner-editable data → `content/*.json` (all wording: `content/text.json`), setup → `client.config.json`,
   editor → `owner/src` (server) + `owner/ui/app.js` (screens), deploys → `.github/workflows/`.

## Make the change
* Smallest change that does the job. Don't reformat or "tidy" unrelated code.
* Client look/pages → `src/site/` + `site.css`. Only touch `src/parts/`, `parts.css`, `owner/` if the change is right for
  every client (and then also do it in the template – see below).
* After editing `client.config.json` → `npm run configure` (regenerates both `wrangler.toml` files).
* New behaviour → add or update a test (`tests/content.test.mjs` for the site, `tests/owner.test.mjs` for the editor).
* UI changes → follow the `ui-quality` skill and run the `visual-check` skill.

## Verify before you say "done"
1. `npm test` (all green). Editor screens changed → `npm run test:ui`. Pages changed → `npm run shots` and look.
2. Commit with a message that says what changed for a human ("Contact page: add business hours"), push `main`.
3. Watch it go live: GitHub → Actions (three workflows: testing link, live site, editor-if-changed) all ✓, then
   `https://<live site>/version.json` shows your commit SHA. Only then report "live".
4. Report exactly: files changed, what changed, commit, and that it's live (or only on the testing link).

## Undo / recover
* Bad publish (yours or the owner's): `git revert <sha>` → push. The editor re-reads the repo next time it opens.
* Editor broken after a code change: `git revert` the change → push (the editor workflow redeploys it).
* Never `git push --force` to `main` – it can erase the owner's editor commits.

## Dependencies
* Update rarely and on purpose: `npm outdated` → update one package → `npm test` + `npm run test:ui` → commit.
* Keep `miniflare` on the 4.x line unless tests are moved to the newer API. Wrangler majors: read the changelog first.
* No new runtime dependencies on the public site – it's plain HTML/CSS/JS on purpose.

## Template ↔ client repos (copies don't sync)
* **Fix found in a client repo that every client needs:** make the same change in `client-site-template`, then list which
  client repos need it. Port with a patch: `git -C <client> format-patch -1 <sha> --stdout > fix.patch` →
  in the other repo `git apply --3way fix.patch` → test → commit.
* Paths that are shared (safe to port): `src/parts/`, `src/lib/`, `public/assets/css/parts.css`, `public/assets/js/site.js`,
  `owner/`, `scripts/` (except client data), `tests/`, `.github/`, `docs/` (non-client files), `.claude/skills/`.
* Paths that are per-client (never overwrite): `client.config.json`, `content/`, `src/site/`, `public/assets/css/site.css`,
  `public/assets/img/`, `owner/wrangler.toml`, `site/wrangler.toml`, `docs/OWNER-GUIDE.md`, `docs/MIGRATION.md`.

## Secrets
Never in files, commits, logs or chat replies. Tokens live in: Worker secrets (`wrangler secret put`) and GitHub Actions
secrets. If one is ever pasted somewhere public: tell the user to delete/roll it immediately.
