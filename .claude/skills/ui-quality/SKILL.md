---
name: ui-quality
description: Use when building or changing anything visual – client pages, CSS, parts, or the owner editor screens – to keep the UI accessible, mobile-friendly, faithful to the client's brand, and free of the generic "AI website" look.
---

# UI quality

If the account's UX skills are available (e.g. `vectorlab-ux-skills`: spacing, typography, colour-palette, forms,
anti-slop, viewports, motion, reduced-motion, empty-states, errors, labels), use them for deeper checks. This skill is
the minimum bar for every change.

## Public website (the client's site)
**Faithful first.** The client liked their old site: match their colors, fonts, logo, page order and wording. Improve
how it works (speed, mobile, accessibility), not who they are. Design tokens live at the top of `site.css`
(`--accent`, `--ink`, `--head`, `--body`…) – change tokens, not scattered values.

**Wording:** **All visible wording goes through `t()`** (`src/lib/text.mjs`): headings, paragraphs, buttons, menu labels, top bar, footer (incl. legal lines), contact details. The words live in `content/text.json` (or a `site.json` field listed in its `siteFields`); never hard-code visible words in `src/`. `npm test` (`tests/text-coverage.test.mjs`) fails otherwise. One key per piece of words (a heading, a paragraph block via `tBlock`, a list via `tList`, a button
label); keep sentences whole where you can – split only around links.

**Layout & type**
* Mobile first. Check 390 px (phone) and 1366 px (laptop); nothing may scroll sideways.
* Body text ≥ 16 px (18 px is the starter default), line-height 1.5–1.7, lines ≤ ~70 characters (`.prose`).
* One `<h1>` per page; headings in order (h1 → h2 → h3). Spacing from a small scale (.5, .75, 1, 1.5, 2, 3 rem).
* Tap targets ≥ 44–48 px tall (buttons, menu, form fields). Phone/email as real `tel:`/`mailto:` links.

**Color & contrast**
* Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI borders). Check brand colors on white and white on brand.
* Never rely on color alone (links underlined in body text, errors have words).

**Images**
* Every `<img>` has `alt` (describe it; `alt=""` only if purely decorative), `width`/`height` or an `aspect-ratio`,
  `loading="lazy"` below the fold, `srcset` + `sizes` for big photos. Replaceable photos use `object-fit: cover` so an
  owner's new photo can't break the layout.

**Motion**
* Subtle, slow, and purposeful (slideshow slide/fade, review drift, fade-in). Anything that moves by itself has a way to
  pause for keyboard users. No parallax, bouncing, or animated counters.

**Forms**
* Visible `<label>` for every field (no placeholder-only labels), `autocomplete` set, errors in words next to the field,
  a clear success message, and a fallback ("call or text instead") when sending fails.

**Accessibility basics**
* Skip link, visible focus ring (`:focus-visible`), menu button with `aria-expanded`, `aria-current="page"` in the menu,
  landmarks (`header`, `nav`, `main`, `footer`), language set. Works without JavaScript (content still readable).

**Avoid the "AI website" look**
* No invented stats ("500+ happy clients"), awards, badges or testimonials. No "Elevate / Unlock / Seamless" copy.
* No default purple-to-blue gradients, glassmorphism, emoji bullets, or stock "team high-five" photos.
* No icon soup: an icon only where it helps (phone, email). Real photos of the real business beat everything.
* **Impeccable** (`.claude/skills/impeccable`, `npm run design:check`) has 62 checks for these tells and more (overused
  fonts such as Fraunces/Inter, "AI cream" backgrounds, kicker labels over headings, skipped heading levels, low contrast).
  Its design hook runs automatically after edits in Claude Code. **The client's brand wins:** on a faithful rebuild, a
  finding that matches the client's own old site is not a fix – record it as an exception (see `visual-check`).
* Other design skills (frontend-design, taste-skill, design-styles, ui-ux-pro-max, web-design-guidelines,
  playwright-cli): each has one job – see `docs/DESIGN-PIPELINE.md`. On a faithful rebuild only the checking ones apply.

## Owner editor (`owner/ui/`)
Owners are often older and non-technical. Keep: large text (≈21 px base), big buttons (≈60 px), one obvious primary
action per screen, a numbered "How this works" box at the top, plain verbs ("Replace photo", "Publish", "Undo"),
"Changed – not published yet" labels, confirmation before anything destructive, and honest status (✓ Done only when
the live site shows the change). Never show code, Git, tokens or error stacks – say what happened and what to do.

## Before calling UI work done
1. `npm run shots` → no problems listed → **open the screenshots and look** (phone + laptop).
   Then `npm run design:check` → fix real findings or record exceptions (see `visual-check`).
2. Compare with the client's old site screenshot if this is a rebuild.
3. Keyboard-only pass: Tab through the page – everything reachable, focus visible, nothing traps focus.
4. Editor changes → `npm run test:ui` and look at `/tmp/ui/*.png`.
