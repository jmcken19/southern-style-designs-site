---
name: design-from-scratch
description: Use when a client has no website and no inspiration to copy (a sports club, a restaurant, a contractor, a nonprofit…) – to research their category, pick the right pages and parts, and produce 3 original design directions the client can choose from before building.
---

# Design from scratch (no existing site, no inspiration)

The template's default is "rebuild their current site faithfully" (`ui-quality`). This skill is for when there is
**nothing to be faithful to**. The goal is a site that fits **this** business and its visitors, not a realtor site with
the words changed. Realtors have a ready-made library in the James' Tech Help repo (`design-library/realtors/`);
for anything else, follow these steps.

Outputs, all committed in the client repo:
- `docs/DESIGN-BRIEF.md` (step 1)
- `docs/DESIGN-RESEARCH.md` (step 2)
- `design/directions/` (step 5), which **is not** part of the production build
- `docs/DESIGN-DECISION.md` (step 6)

## 1. Brief: who visits and what must they do? (20-minute talk with the client)
Write `docs/DESIGN-BRIEF.md`:
- **Visitors**, ranked: e.g. for a club team, recruits → parents → alumni/donors → opponents.
- **The one main action** per visitor: join or try out, donate, find the next game, contact. The homepage is built around the first one.
- **What they already have:** logo, colors, photos (whose rights?), social accounts, any existing pages (a university or league page counts).
- **Who will edit, and what changes often** (schedule? roster? menu?). Anything weekly needs an editor area (`editor-extend` skill) or a link to where it already lives, e.g. a league schedule page.
- **Words the client uses about themselves.** Write down 3 adjectives they'd pick, and 3 they'd hate.

## 2. Category research: patterns, not looks
Order and job of each design skill: `docs/DESIGN-PIPELINE.md` Track B. Start here with
`python .claude/skills/ui-ux-pro-max/scripts/search.py "<category> <audience> <3 words>" --design-system` for the page pattern
and UX rules (ignore its palette if the client has colours), then the real-site research below.
- Find **8–12 real sites in the same category** and **2–3 from a nearby category** (fresh ideas without copying). Use searches like:
  - `"<category>" website <city>`
  - `best <category> websites 2026`
  - for clubs: `"club volleyball" site:.edu`
  - Award or "best of" lists for that industry.
- Use WebSearch/WebFetch. For each site, record in `docs/DESIGN-RESEARCH.md`:
  - URL, what it does well, what's weak, which **pages** and **parts** it uses.
  - Never record or reuse their text, photos or logos. **Describe**, with the URL as the source.
- Finish with a short **"patterns"** list: the pages almost all of them have, the parts that work, and the common mistakes (outdated dates, dead social links, a schedule from last season…). These mistakes are your pitch.

## 3. Rules and permission checks for this category
Check what applies, and write it in the brief:
- **Logos and names owned by someone else.** For example, a **university club team** usually needs the school's approval to use its name, logo, mascot or colors. Check that school's club sports or brand office. The same goes for league logos, sponsor logos (written permission) and franchise or brokerage brand rules.
- **People in photos.** Players, kids, customers. Get consent; for anyone under 18, a parent or guardian.
- **Industry rules:** realtors (see the realtor library), food (allergens and prices on menus), contractors (license number, if their state or trade expects it), nonprofits (donation wording, and the tax status they actually have).
- Forms that collect phone numbers for texting need the optional consent box (see `ui-quality` and SECURITY).

## 4. Pages and parts (start from the category table below, then trim)
Pick pages for the visitors in step 1. Fewer, better pages beat a big empty sitemap. For each page, choose parts from
`docs/PARTS.md` (the template's parts) and note anything new you'll need to build.

| Category | Main visitor → action | Must-have pages | Signature part | Watch out for |
|---|---|---|---|---|
| **Sports club** (college club, adult league, youth club) | Recruit → "Join / Tryouts"; parent or donor → "Support us" | Home, About/History, Team (roster), Schedule & Results, Join/Tryouts, Support (donate/sponsors), Contact | Next-game strip (opponent · date · place), action photo hero | School or league logo rights, stale schedules, minors' photos and names |
| **Restaurant / café** | Hungry local → menu, hours, directions | Home, Menu, Hours & Location, About, Contact/Order link | Hours + map on every page, menu as real text (not a PDF) | Prices out of date, menu only as a picture |
| **Contractor / home services** | Homeowner → call or request a quote | Home, Services, Work gallery, Reviews, Service area, Contact | Sticky call button, before/after gallery | License/insurance claims you can't verify, fake reviews |
| **Salon / barber** | Client → book | Home, Services & prices, Team, Gallery, Book (link out), Contact | Big "Book now" linking to their booking app | Booking tool already handled elsewhere: link, don't rebuild |
| **Retail / gallery** | Shopper → visit or call | Home, What we carry, About/Makers, Visit (hours/map), Contact | Collection gallery, "Visit us" block | No online store unless scoped (not static) |
| **Nonprofit** | Supporter → donate or volunteer | Home, Mission, Programs, Get involved, Donate (link out), Contact | Impact numbers with a source line, one clear Donate button | Tax-status wording, invented impact stats |
| **Professional services** | Client → book a consult | Home, Services, About, Reviews, Contact | Credentials + photo, clear service list | Claims and titles regulated by their profession |
| **Realtor** | See the James' Tech Help `design-library/realtors/` | | | NC advertising rules (firm name everywhere) |

## 5. Three original directions (the client picks one)
Make **3 directions that are really different**. Start each from a concrete style in `design-styles`
(`.claude/skills/design-styles/SKILL.md` has the index; run `npm run skills:design` if it's missing) and use
`frontend-design`'s two passes (token plan → review it against the brief → change what's generic) – then adapt to the client's colours, photos and words. Vary at least 3 of these:
- tone (bold, calm, warm, technical)
- type pairing (free Google fonts)
- color approach (brand-led, neutral plus one accent, dark)
- photo treatment (full-bleed action, framed, black and white)
- layout rhythm (dense or airy, grid or editorial)

For each direction, write in `docs/DESIGN-RESEARCH.md`: name, one-line mood, palette (hex + **contrast check**: body text ≥ 4.5:1), fonts, photo treatment, homepage order, and **why it fits the brief** (tie it to the visitors and the main action).

Build a **quick preview** for each in `design/directions/<1|2|3>.html`:
- The homepage hero plus 2 sections, using the **client's real content and photos**, never lorem ipsum.
- One file each, plain HTML/CSS, phone-first.
- Open each at 390 px and 1366 px (`visual-check`), run `npx impeccable detect design/directions/` (optionally TasteSkill's checker as a second opinion –
  `docs/DESIGN-PIPELINE.md` B6). Fix every
  generic-look finding (overused font, cream background, kicker labels…) before the client sees them.
- Send the client the three links, or screenshots.

**Avoid the generic look** (from `ui-quality`): no purple-blue gradients, no glassmorphism, no emoji icons, no stock "team high-five" photos, no animated counters, no made-up numbers.

## 6. Decide, then build
- The client picks a direction, plus tweaks. Write it in `docs/DESIGN-DECISION.md` with the date and their words.
- Move the chosen palette and fonts into the tokens at the top of `public/assets/css/site.css`. Build the pages in `src/site/`.
- **All visible wording goes through `t()`** (`src/lib/text.mjs`): headings, paragraphs, buttons, menu labels, top bar, footer (incl. legal lines), contact details. The words live in `content/text.json` (or a `site.json` field listed in its `siteFields`); never hard-code visible words in `src/`. `npm test` (`tests/text-coverage.test.mjs`) fails otherwise. (Approved words only – the client's, or ones they approved in writing.)
- Record the decision for every later session with the `impeccable` skill: `/impeccable init` (writes `PRODUCT.md`:
  visitors, main action, tone, from `docs/DESIGN-BRIEF.md`) and, once the first pages are built, `/impeccable document`
  (writes `DESIGN.md`: the chosen palette, fonts and parts). The detector then also flags drift from that system.
- From here on, `ui-quality` (the "faithful" rule now means faithful to **the chosen direction**) and `visual-check` apply as usual.

---

## Worked example: a men's college club volleyball team
**Brief:**
- Visitors: (1) students thinking of joining, (2) parents and alumni who might donate, (3) other teams looking for the venue and schedule.
- Main action: **"Come to tryouts / join"**.
- Changes often: schedule and results (weekly in season), roster (each semester).

**Research:** about 10 other college club volleyball sites, plus 2 from nearby categories, e.g. a club ultimate frisbee team and a local adult volleyball league.
- Record which have a roster with photos, a schedule, tryout info and a donate link, and how stale their pages are.
- Note common problems: last season's schedule, dead Instagram embeds, no tryout date.

**Rules:** university name, logo and colors only as the school's club sports or brand office allows (ask first). Players' consent to show their names and photos. Fundraising links go to the school's official giving page, if that's how the club raises money.

**Pages:**
- Home: action-photo hero, then a **next match strip**, then a "Join us" call-out, then a recent results line, then a sponsor/donate band.
- Team (roster cards: name, position, year; photos only with consent).
- Schedule & Results, Join/Tryouts (dates, what to bring, contact), Support (donate link, sponsors), About (history, ECVA division, achievements with dates), Contact.

**Three directions:**
1. **Game Day:** bold, high-contrast, school colors, condensed sans headings, full-bleed action photos.
2. **Clubhouse:** warm, friendly, lots of team and social photos; aimed at recruits who want community.
3. **Program:** clean, results-forward, sporty data feel (records, standings with sources and dates); aimed at serious players and alumni.

**Editor needs:** schedule/results and roster are weekly or per-semester changes. Either give the club editor access to those areas (`editor-extend`), or link to the league's official schedule and keep the site's version short.
