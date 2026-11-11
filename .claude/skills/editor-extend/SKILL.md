---
name: editor-extend
description: Use when a client needs to edit something new in the owner editor (another photo, business hours, team members, services…) – the proven pattern for adding an editable area safely.
---

# Adding something the owner can edit

> The editor is **"edit on the page"** ([docs/EDITOR.md](../../../docs/EDITOR.md)): the page itself tells the editor what's
> editable through `editMark()` (`src/lib/editables.mjs`). Anything new must (1) mark its element with `editMark`, (2) have
> server routes registered in `owner/src/index.mjs` and merged into the page preview, (3) be added to `DRAFT_SOURCES` and
> get a panel in `KIND_TOOLS` (`owner/ui/app.js`) that calls `ctx.update('<area>', newState)` after saving. The full,
> tested checklist is "Adding a new kind" in docs/EDITOR.md. Then add browser steps to `tests/ui-visual.mjs`.

## First: is it just another photo?
Then it's a **photo spot**, no code needed: add it to `client.config.json → photoSpots`
(`label`, `where`, `page` = the page path for Preview, `tip`, `minEdge`, `newAlt`, `defaults.small/large/alt`),
render it with `spotImage(ctx, '<key>')`, `npm run configure`, `npm test`, push. The photo gets its own ✎ Change photo button on the page (and a box in the list view).

## A new kind of content (hours, team, services…)
Copy the **reviews** pattern – it has every safety feature:
1. **Data file** `content/<area>.json` – the published truth. Read it in `scripts/build.mjs → loadContent` and
   **validate** it there (the build must fail on bad data).
2. **Render it** with a part or in `src/site/pages.mjs`; make sure `routes.mjs` includes the page.
3. **Editor server** `owner/src/<area>.mjs` – copy `reviews.mjs`: a `settings` row (key `<area>`) with `draft` + `live`,
   `load()` that syncs from the repo file, `write()` with the **revision check** (409 "Reload latest"), clean/validate
   every field server-side (plain-English errors), `preview` via `renderPath`, `publish` with the lock + one non-forced
   Git commit, `logEvent` for every save. Route it in `owner/src/index.mjs` and add a `features.<area>` flag + `/api/me` field.
4. **Editor:** add the area to `DRAFT_SOURCES` and a panel to `KIND_TOOLS` in `owner/ui/app.js` (copy the reviews
   panel: big buttons, "Changed – not published yet", `ctx.update`, `unsavedGuard` while typing). The bottom bar's
   Publish / Undo all / Reload latest then cover it. Merge the draft into the page preview (`photos.mjs → preview`).
   A full-screen list-view screen is optional.
5. **Tests**: API test in `tests/owner.test.mjs` (auth, validation, stale save refused, preview shows draft, publish
   writes the file, undo) + steps in `tests/ui-visual.mjs`. `npm test` and `npm run test:visual`.
6. **Docs**: owner guide section, PARTS.md row. If it's useful for every client, put it in the template too
   (see `codebase-care`).

## Words are already editable – don't build a kind for wording
Every visible word is already editable on the page (the `text` kind): put it through `t(ctx, 'page.thing')` /
`tBlock` / `tList` (`src/lib/text.mjs`) and add the words to `content/text.json`. A new page or part needs **no editor
change** for its wording. Build a new kind only for structured things (a list of team members with photos, hours…);
their own words then use `ownedBy(ctx, '<kind>')` so the coverage test knows they're looked after.

## Rules that never change
Server checks sign-in on every call (already done in `index.mjs`); never trust the browser's validation; nothing goes
live without Publish; never commit visitor data or originals with GPS.
