# The owner editor: "edit on the page"

The owner opens their bookmark and sees **their own website**: a private draft that only they and you can see. **Every
word on the page can be clicked and changed right there** (see "Words" below). Every photo/review part has a dark
**✎ Change …** button (a round **✎** on small things like a logo). Clicking it opens a side panel; the page stays at its full computer width and is shown a little smaller beside the panel. Every
change shows on the page straight away; there's no Preview button. **Publish** in the bar at the bottom puts it on the
real website (the bar then says "Publishing… about 2 minutes" → "✓ Done – view your website"). **Undo all changes**
goes back to what's live. A simple **list view** (`#/list`) is still there as a fallback.

| Screen | Address | What it is |
|---|---|---|
| Edit on the page (default) | `#/` | Page picker (buttons, or a drop-down when they don't fit), the page with ✎ buttons, side panel, bottom bar: Computer/Phone, status, Undo all, Publish |
| List view | `#/list` | The older box-per-photo screen |
| Slideshow (full screen) | `#/homepage` | Same controls as the slideshow side panel |
| Reviews (full screen) | `#/reviews` | Add, change or remove reviews (the same screens open in the side panel from the page) |

## How it adapts to each client (the foundation)
The editor doesn't have a fixed list of screens. **The page tells it what can be edited:**

1. Every part that the owner may change calls `editMark(ctx, kind, key, label)` (`src/lib/editables.mjs`). In the
   editor's preview this adds `data-edit="<kind>"` to that element. On the real website it adds **nothing**; a test
   checks this. Kinds that belong to a switched-off feature (`features.slideshow` / `features.reviews` = false) get no mark.
2. The preview is shown in a frame. The editor finds every `[data-edit]` element and puts the ✎ button for that kind
   on it (`KIND_TOOLS` in `owner/ui/app.js`). Kinds it doesn't know are simply skipped.
3. So **whatever parts you build a client's site from decide their editor.** Use `heroSlideshow` and they get the
   slideshow panel. Each `spotImage` gets a photo panel. `reviewsRow` / the reviews page get reviews. Leave a part out
   and its button disappears with it. A page with nothing editable says "Nothing to change on this page".

| Kind | Drawn by | Panel | Draft source |
|---|---|---|---|
| `slideshow` | `heroSlideshow()` | Photos first (add/replace/remove/reorder, which part matters most), then slideshow or still, speed, slide/fade | `homepage` |
| `photo` | `spotImage()` (any photo spot) | Replace photo (click or drag), undo | `homepage` |
| `reviews` | `reviewsRow()`, the reviews page | The reviews list: add, change, remove, arrange the order (pen = a bar above the section) | `reviews` |
| `review` | `reviewCard(…, { mark: true })` | One review's form (pen = bottom-right of the card) | `reviews` |
| `text` | `t()` / `tBlock()` / `tList()` (`src/lib/text.mjs`) – **every visible word** | No panel: typed in place on the page, with a toolbar | `text` |
| `video`… | (planned) | | |

## Drafts and Publish (draft sources)
Everything the owner changes is saved on the server as a private **draft** (D1). Each area has its own **draft
source**: `homepage` (slideshow + photo spots), `reviews` and `text` (the words). `DRAFT_SOURCES` in `owner/ui/app.js` lists them; the
Publish bar publishes, undoes and reloads **every** enabled source, each on its own (if one fails, the owner is told
plainly which part went live and which didn't). Panels never publish; they report every saved change with
`ctx.update(sourceId, newState)`, which redraws the page. A source's server routes follow one contract:

| Route | Answer |
|---|---|
| `GET /api/<area>` | `{ revision, hasUnpublishedChanges, draft, live, … }` |
| `POST /api/<area>/publish` `{ baseRevision }` (with `Idempotency-Key`) | `{ <result>: newState, commit }` – one Git commit |
| `POST /api/<area>/discard` `{ baseRevision }` | newState (draft = live) |
| any save | newState; a stale `baseRevision` → `409 { conflict: true }` ("Reload latest") |

**Reviews order.** Reviews show everywhere (reviews page, homepage row) in the order of `content/reviews.json → items`:
first item = shows first. Nothing sorts them by date. The owner arranges them in the reviews panel (and on `#/reviews`):
**⠿ Drag** (mouse or finger, scrolls the panel), **Move up / Move down** buttons, or the arrow keys on the handle. Each
move saves at once with `POST /api/reviews/order { slugs: [every slug, first shown first], baseRevision }` → newState;
it must be exactly the draft's reviews, each once (`400` otherwise), and a stale revision → `409`. A new review goes to the
top; editing keeps its place; removing keeps the others' order. Publish writes the order to the file, Undo all puts the
published order back, and an order-only change counts as an unpublished change. *Porting to a client made before
Nov 2026* (their pages sorted newest first): once, write their `content/reviews.json` items in the order their live pages
show now (`newestFirst` in `src/lib/core.mjs`), compare the built pages' review order before and after, and publish or undo
any unpublished review changes in their editor first.

## Words: every visible word is editable (the `text` kind) – THE RULE
**All visible wording goes through `t()`.** Headings, paragraphs, buttons/CTAs, menu labels, the top bar, the footer
(including legal/compliance lines) and contact details – in every page, part and layout. Never hard-code visible words
in `src/`. This makes word editing automatic ("reflexive") for every site made from the template: a new page's words
are editable the moment the page exists, with no editor change.

| Helper (`src/lib/text.mjs`) | Use for | On the website | In the editor (edit mode) |
|---|---|---|---|
| `t(ctx, 'page.thing')` | one line: heading, button label, menu item, footer line | the escaped words | `<span data-edit="text" data-edit-key="page.thing">words</span>` |
| `tBlock(ctx, 'page.body')` | several paragraphs (value = list in the file) | `<p>…</p><p>…</p>` | the same `<p>`s inside one `<div data-edit="text" data-text-multi="p">` |
| `tList(ctx, 'page.awards')` | a `<ul>`/`<ol>` (one item per entry) | `<ul><li>…</li></ul>` | `data-edit` on the `<ul>` (`data-text-multi="li"`) |
| `tText(ctx, key)` | words inside attributes (alt, aria-label) | plain words – escape them yourself | not editable there (the visible copy is) |
| `ownedBy(ctx, 'reviews')` | words another editor owns (a review's title/text) | nothing | `data-edit-owned="reviews"` |

**Where the words live:** `content/text.json → text` (`"home.title": "…"`, a list of strings for paragraphs/lists).
Business facts that already have a field in `content/site.json` are used as `site.<field>` (`t(ctx, 'site.phone')`) –
the field must be listed in `text.json → siteFields`. `text.json → kinds` marks phone / email fields (checked, so the
Call/Text/Email buttons keep working; changing `site.phone` also updates `phoneHref`/`smsHref` when the site has them).
`text.json → mustStay` lists legal/compliance lines (brokerage, license, Equal Housing…): they can't be emptied and the
toolbar says "This must stay on your website". Words are plain text (HTML is removed, spaces tidied); a missing key
stops the build with a message saying what to add.

**Splitting sentences:** keep sentences whole; split only around a link (`${t(ctx,'x.before')} <a …>${t(ctx,'x.link')}</a>`).
Punctuation or numbers on their own (`·`, `© 2026`) aren't words and need no key.

**The guarantee:** `tests/text-coverage.test.mjs` (part of `npm test`) renders every page of the site in edit mode –
with each feature switched off too – and **fails** for any visible word (a text node with a letter, outside script/style
and `aria-hidden="true"`) that isn't inside a `data-edit="text"` or `data-edit-owned` element. It also checks every
marked key exists and that the real website carries no marks. `tests/text-diff.mjs <before> <after>` compares the words
of two builds page by page (use it when moving wording into `text.json`: the site must read the same).

**For the owner (laptop):** words get a dashed outline and a small round **✎** only on hover or keyboard focus (no big
pens, so the page isn't cluttered; each piece of words is focusable, `aria-label="Change text: <where – what “words”>"`).
Clicking the words (or the ✎) makes just that element typeable (`contenteditable="plaintext-only"`) with a toolbar next
to it: **Save – show it on my page** and **Cancel**. One line: **Enter** saves. Paragraphs/lists: **Enter** starts a new
paragraph/item (Ctrl+Enter saves). Words inside a `<button>` or form `<label>` are typed into a box in the toolbar
(browsers don't allow typing inside those). Links keep their address – the toolbar says so and has **Open “<page>”** to
go there. **Escape** asks before throwing typing away; clicking elsewhere asks **Save / Don't save / Keep typing**; page
switch, Publish, Undo all and Reload latest go through the same guard. Very tall paragraphs keep the toolbar at the
bottom of the window. A page under **More pages…** (footer pages, one example review, "Page not found") lets the owner
reach words that only show there.

**Server:** `owner/src/text.mjs` – settings row `text` with `{ text, site, rules }`; `GET /api/text`;
`POST /api/text/item { key, value, baseRevision }` (key must exist → 404; checks as `cleanText()`: plain text, length,
required, phone/email; stale revision → 409; returns `changed: [keys]`); `POST /api/text/discard`; `POST /api/text/publish`
= one commit that re-reads `content/text.json` and `content/site.json` and changes only the changed words. Repo changes
(a helper adds a page's words) are picked up on the next load, with the owner's unpublished words kept on top. The
preview merges the draft words (`withDraftWords`) in both edit mode and normal preview.

## Adding a new kind (e.g. video) – every step
1. **Data:** where it's stored (e.g. `content/site.json → videos`) and its validation in `scripts/build.mjs → loadContent`
   (the build must fail on bad data).
2. **Part:** draw it in `src/parts/`, and put `editMark(ctx, 'video', key, label)` on its element. Its fixed words
   ("Watch the video") go through `t()`; words the new panel edits get `ownedBy(ctx, 'video')`. Add the kind to
   `EDIT_KINDS` in `src/lib/editables.mjs` (and to `KIND_FEATURE` there if a `features.<x>` flag switches it off).
3. **Server:** `owner/src/<area>.mjs` – copy `reviews.mjs`: a `settings` row (key `<area>`) with `draft` + `live`,
   `load()` that syncs from the repo, saves with the **revision check** (409), plain-English errors, `publish` with the
   lock + one non-forced Git commit that re-reads the file and changes only its own field, `discard`.
4. **Register the route** in `owner/src/index.mjs → handleApi`: `if (parts[0] === '<area>') return <area>Handler()(A, parts, method);`
   (behind its `features.<area>` flag if it has one; add the flag to `/api/me → features`).
5. **Preview merge:** in `owner/src/photos.mjs → preview`, read your draft row and put it on `site` (next to the reviews
   draft – see the comment there), so the page always shows exactly what Publish will make. Embeds from another
   site (YouTube…) must be allowed in `owner/src/preview.mjs` (`PREVIEW_FRAME_HOSTS`).
6. **Draft source:** add `{ id: '<area>', what: '<plural words for the owner>', api: '/<area>', result: '<key of the
   publish answer>', enabled: () => me.features?.<area> !== false }` to `DRAFT_SOURCES` in `owner/ui/app.js`.
   Publish, Undo all, "Reload latest", the unsaved-changes bar and the page refresh then include it – nothing else to wire.
7. **Panel:** add `video: { title, button: '✎ Change video', open(body, ctx) }` to `KIND_TOOLS`. Inside: `ctx.get('<area>')`
   for the newest state, `ctx.update('<area>', newState)` after every save, `ctx.alive()` before drawing after an `await`
   (the panel may have been closed), `busyWhile(fn)` around slow work (Publish waits for it), and `unsavedGuard` while
   the owner is typing. Optional `place: 'bar' | 'bottom'` decides where the ✎ sits.
8. **Tests:** server test in `tests/owner.test.mjs` (auth, validation, 409, preview shows the draft, publish writes the
   file, discard), browser steps in `tests/ui-visual.mjs`. Run `npm test`, `npm run test:visual` and look at the screenshots.

## Rules that keep it easy for owners
- Every visible word goes through `t()` (see "Words") – the coverage test fails otherwise.
- One big button per thing, labelled with what it does ("✎ Change photo", not an icon on its own). Words are the exception:
  a small ✎ on hover/focus, because there are so many of them. Words: **✎ Change …**
  opens, **Done** closes a panel, **Publish** publishes, **Cancel** cancels typing.
- The panel's main action comes first, at the top. Instructions are one line.
- Every save shows on the page right away. Nothing goes live until **Publish**. Typing is never thrown away without asking.
- Links inside the page switch pages in the editor; a link whose words are marked (menu items, buttons) edits its words on
  click, and the toolbar's **Open “…”** switches page (also on a sub-path testing link, relative links, `#anchors` scroll);
  the page's own buttons (slideshow pause, carousel) work; forms are switched off.
- The screen never scrolls as a whole: only the page and the panel scroll. Laptop only (phones get a friendly note).
  The **Phone** button shows how the page looks on a phone.
- If the page can't be shown (signed out, server error, offline) the editor says so, with **Try again** / **Sign in again**.

## Testing
`npm test` (server + build + `text.test.mjs` + the word coverage test; adapts to the client's features and photo spots),
`npm run test:ui` (list view, reviews, phone refusal) and `npm run test:visual` (edit on the page: `ui-visual.mjs`, the edge
cases in `ui-visual-edge.mjs` – unsaved typing, partial publish, conflicts, slow uploads, preview errors, sub-path links –
and `ui-text.mjs`: words in place, paragraphs, footer, menu label, phone check, Escape/unsaved guards, publish, Undo all;
`SHOT_W=1280 SHOT_H=585 node tests/ui-text.mjs` for the small-laptop screenshots in `/tmp/ui-text-1280x585/`). Screenshots go to
`/tmp/ui-visual/` and `/tmp/ui-visual-edge/`; **look at them** (`visual-check` skill).
