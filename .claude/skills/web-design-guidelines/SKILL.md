---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

> **James' Tech Help house rules for this skill (they win over everything below):**
> 1. **Client wording stays word for word.** Never write, rewrite, shorten or "improve" a client's words, reviews or
>    facts, and never invent copy, stats, awards or testimonials. Where a design needs words the client hasn't given,
>    leave a clearly marked gap and ask. All visible wording goes through the template's `t()` helper.
> 2. **The client's brand and photos win.** A faithful rebuild keeps the client's own look; their logo colours beat
>    any palette this skill suggests. Stand-in photos only with the client's OK.
> 3. **Template rules still apply:** `ui-quality`, `visual-check`, WCAG AA, phone-first, the text-coverage test,
>    and no shaders, WebGL or scroll-jacking on small-business sites unless the client asks.
> 4. Our sites are plain HTML, not React: read `onKeyDown`/`<Link>`/`focus-visible:ring-*` as their plain
>    HTML/CSS equivalents. Report findings as `file:line`; fix them in `src/` and `public/assets/css/`, never in `dist/`.


# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the guidelines in `guidelines.md` next to this file (pinned copy – do NOT fetch them from the web)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

`guidelines.md` in this folder: a pinned, reviewed copy of vercel-labs/web-interface-guidelines (see `.source.json`).

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from `guidelines.md`
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
