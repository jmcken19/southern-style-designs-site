---
name: visual-check
description: Use after any change that affects how a page or the owner editor looks – take phone and laptop screenshots, catch broken images, script errors and sideways scrolling, and actually look before saying it's done.
---

# Visual check

## Website pages
```
npm run shots                 # every page, phone (390 px) + laptop (1366 px) → screenshots/*.png
npm run shots -- /about/      # one page
```
The tool builds the site, serves it locally, scrolls each page (so lazy images and fade-ins load), saves full-page
screenshots and lists problems: script errors, failed requests (404s), broken images, images without `alt`,
sideways scrolling, tap targets under 40 px on phones, missing `<h1>`. Exit code 1 if anything is found.

**Then look at the screenshots yourself** (open the PNGs). The tool can't judge: alignment, spacing, text overlapping
photos, colors that clash, things that look different from the client's old site. Report what you checked.

## Code and accessibility audit (web-design-guidelines)
Run the `web-design-guidelines` skill on `src/site/`, `src/parts/` and `public/assets/css/` (pinned rules in its
`guidelines.md`, no download). Fix each `file:line` finding in the source, never in `dist/`.

## Click-through (playwright-cli)
`npm run serve` (builds the preview and serves it at http://localhost:8080/), then in a second terminal
`npx playwright-cli open http://localhost:8080/` and walk it: menu open/close, every page link, slideshow buttons,
Tab through the page (focus visible?), the contact form's labels and errors – **without submitting**. `npx playwright-cli
resize 390 844` for the phone. Close with `npx playwright-cli close`. Local preview only – never a live client form.

## Design check (Impeccable)
```
npm run design:check          # builds, then runs the Impeccable detector on dist/ (62 rules)
```
Catches what screenshots and `shots` don't name: AI-default fonts and palettes, kicker labels, side-tab borders,
skipped heading levels, low contrast, cramped padding, flat type scale. In Claude Code the same detector also runs as a
hook after each edit and once at the end of a session (`.claude/settings.json`). GitHub runs it on every push
(`Design check` workflow) as a **warning only** – it never blocks publishing.

Triage every finding into one of three:
* **Real problem** → fix it.
* **Confident false positive or the client's own choice** (e.g. a font copied from their old site) → record the
  narrowest exception with a reason:
  `.claude/skills/impeccable/scripts/impeccable hooks ignore-value <rule> <value> --reason "<who decided: evidence>"`
  (a rule for one file: `ignore-value <rule> "*" --file <glob>`). Exceptions live in `.impeccable/config.json`, committed.
* **Unsure** → leave it and say why in one line. Ask James before ignoring a whole rule or file.

The detector's engine downloads once per computer on first use (from the Impeccable GitHub releases); `npm run
design:check` uses the copy installed by `npm ci`, so it also works offline.

## Owner editor
`npm run test:ui` drives the real editor in Chrome at laptop size (and a phone, which must be refused) and saves
screenshots to `/tmp/ui/` (start screen, slideshow, photo spots, reviews). Look at them after any editor UI change.

## Live site after a deploy
Open the live address, hard-refresh, and check the changed page on a phone-sized window. `/version.json` must show the
new commit before you call it live.

## Without Chrome
Set `CHROME_PATH` to any Chrome/Chromium/Edge executable. If none is available, say that you couldn't do a visual
check rather than skipping it silently.
