# Skills, plugins and AI instructions – what carries over to new repos

There are three places an AI assistant (Claude) picks up extra abilities or instructions. Only **one** of them
travels with the repo.

| Where it lives | Example | Copied into every client repo made from this template? | Works in every repo anyway? |
|---|---|---|---|
| **In the repo** – `AGENTS.md`, `CLAUDE.md`, `.claude/skills/<name>/SKILL.md`, `.claude/settings.json` | This template's `client-site` skill and rules | **Yes** – "Use this template" copies them | – |
| **Your Claude account** (claude.ai → Settings → Capabilities/Skills, plugins you added) | docs, pdf, xlsx, pptx, deep-research, social-media / UX plugins | No (not files in the repo) | **Yes** – they follow you into every chat and session |
| **Your computer's Claude Code install** (`~/.claude/skills/`, `~/.claude/plugins/`, `pip`/`npm` tools) | A tool installed only on your laptop | No | Yes **on that computer only** – not in cloud sessions or other machines |

## What this template includes
* `AGENTS.md` – the rules any assistant follows in a client repo (never invent facts, copy reviews word for word,
  run `npm test`, report exactly what changed…). `CLAUDE.md` points to it.
* Project skills in `.claude/skills/` (Claude picks the right one automatically):

  | Skill | When it's used | Comes with |
  |---|---|---|
  | `client-site` | Any work in a client repo: the playbook steps and the never-do list | – |
  | `codebase-care` | Any code change: orient, change safely, verify it's live, undo, update packages, port fixes template ↔ client | – |
  | `design-from-scratch` | Client has **no site and no inspiration** (sports club, restaurant, contractor…): brief, category research, pages per category, 3 original directions to pick from | `design/directions/` previews |
  | `ui-quality` | Anything visual: accessibility, mobile, type, contrast, motion, forms, the "no AI look" rules, editor UI rules | – |
  | `visual-check` | After visual changes: screenshot every page at phone + laptop size and actually look | `npm run shots` |
  | `dns-cutover` | Moving a domain / any DNS change: snapshot, compare, switch, verify – protects email | `npm run dns:snapshot` |
  | `editor-extend` | Letting an owner edit something new (another photo, hours, team, video…) safely: mark it with `editMark`, add its panel ([EDITOR.md](EDITOR.md)) | `npm run test:visual` |
  | `impeccable` | Design vocabulary + checks from [impeccable.style](https://impeccable.style) (v4.8.2, Apache-2.0): `/impeccable critique`, `audit`, `polish`, `typeset`, `layout`, `init` (PRODUCT.md), `document` (DESIGN.md)… | `npm run design:check`, a design hook in `.claude/settings.json`, the `Design check` GitHub workflow, 4 helper agents in `.claude/agents/` |

## Design skills from other repos – `npm run skills:check`
Gathered from the "5 Claude Skills That Fix Claude's Ugly UI" article, the Skillselion design ranking and the
Friday AI Club "6 best" list. Each was read in full on Nov 10, 2026 (hidden instructions, network calls, scripts,
licence) and is **pinned** to that exact commit in `scripts/design-skills.mjs`. Every copy has our **house rules**
on top (client words word for word, client brand first, no shaders/3D on small-business sites, plain HTML/CSS) and a
`.source.json` saying where it came from. **Which one does what, in what order: [DESIGN-PIPELINE.md](DESIGN-PIPELINE.md).**

| Skill | Job here | In the repo? | Our changes |
|---|---|---|---|
| `impeccable` | Critique, polish, the 62-check detector (`npm run design:check`) | committed | – |
| `frontend-design` (Anthropic, Apache-2.0) | Direction plan → review against the brief (Track B) | committed | Its "write the copy" advice is off |
| `ui-ux-pro-max` (MIT) | Category research: page pattern, UX rules, font pairings (Track B) | committed (3.4 MB) | Search path fixed to work from the repo root; its palette is only a suggestion; its tests left out |
| `design-styles` (Awesome Design, MIT) | 58 concrete styles to start each direction from | committed | One skill with an index; brand look-alike styles left out |
| `web-design-guidelines` (Vercel, MIT) | Accessibility/UX code audit, `file:line` (both tracks) | committed | Upstream downloads its rules from `main` every run – we keep a **pinned copy** (`guidelines.md`) instead |
| `playwright-cli` (Microsoft, Apache-2.0) | Click through the local preview in a real browser (both tracks) | committed; the tool is a devDependency (exact version) | Use `npx playwright-cli`; local preview only. Cloud sessions get a no-sandbox setting written automatically |
| `vercel-react-best-practices` (MIT) | Only for a React/Next.js site – dormant for our static sites | committed | Note saying so |
| `taste-skill` (MIT) | *Advisory* second opinion on direction previews (Track B) – not a gate: its "every section one full screen" rules don't fit small-business pages | **downloaded**: `npm run skills:design` (40 MB) | End-of-session hook removed; copy layer off; copy-lint findings on client words get waived, never "fixed" |
| `img2threejs` (Apache-2.0) | Photo → 3D model, only if a client asks | optional: `npm run skills:design -- --with-3d` | – |

Commands: `npm run skills:check` (no download – lists every skill and its pin, fails if one is missing, changed, or
has a hook) · `npm run skills:design` (installs TasteSkill) · `npm run skills:design -- --refresh` (maintainers:
rebuild the committed copies after reviewing a new version and changing its pin). `tests/design-skills.test.mjs`
(part of `npm test`) checks the house rules, pins, licences, that no skill has a hook, and that the guidelines are local.

**Works anywhere Claude Code opens the repo** – your PC, or a cloud session started from your phone with the desktop
off. Everything except the optional TasteSkill is already in the clone; `npm run skills:design` adds it when wanted. Claude lists skills when a session starts, so in the session that downloaded TasteSkill
it reads it straight from `.claude/skills/taste-skill/`.

**Looked at and left out:** shadcn (React components), GSAP and Apple Design (heavy motion), Superpowers (a whole
workflow plugin that would compete with PLAYBOOK + DESIGN-PIPELINE). Reasons in DESIGN-PIPELINE.md.

## Impeccable: updating it
The skill is a copy of `plugin/skills/impeccable` from github.com/pbakaus/impeccable, pinned with the `impeccable` npm
package (same version). To update: on your computer run `npx impeccable update` in the template, or copy the newer
`plugin/skills/impeccable` and `plugin/agents/*` over these folders and bump the `impeccable` version in package.json to
match `scripts/VERSION`'s engine. Then `npm test` and `npm run design:check`. Its own license and notices are in
`.claude/skills/impeccable/LICENSE` and `NOTICE.md`.

## To make another skill travel with every client repo
Put it in the template: `.claude/skills/<skill-name>/SKILL.md` (plus any files it needs), commit, push.
New client repos made from the template get it. **Existing** client repos don't update automatically – copy the
folder in by hand (same as any other template improvement).

## To make a skill available everywhere (not just client repos)
Add it to your Claude account (claude.ai → Settings → Skills / Capabilities, or a plugin). Then nothing needs copying.

## Checked Nov 9, 2026
* Account-level skills/plugins visible in this session: docs, docx, pdf, pptx, xlsx, deep-research, video-making,
  skill-creator, the Roblox/StonkCats skills, social-media-skills, vectorlab-ux-skills, code-review, posty, and more.
  These already work in any repo.
* **Graphify** was **not** found in the account skills/plugins or in Dan's repo. If you installed it in Claude Code
  on your laptop (e.g. `pip install` + a `/graphify` skill in `~/.claude/skills/`), it works in every repo **on that
  laptop** but not in cloud sessions. To have it everywhere, add it to your account; to pin it to client repos,
  copy its skill folder into this template's `.claude/skills/`.
