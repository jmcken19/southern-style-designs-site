# Migration table – [Client name]

<!-- Copy to docs/MIGRATION.md. One row per page/feature of the CURRENT site. Nothing is dropped or invented
     without the owner's OK – write who confirmed and when. -->

Old site: [https://www.example.com] (hosted by [host]) · audited [date] by [you]

| Old address | Page / feature | What's on it | New site | Confirmed by |
|---|---|---|---|---|
| `/` | Home | Slideshow (3 photos), intro text, reviews, call button | Same, slideshow editable | [owner, date] |
| `/about/` | About | Headshot + 4 paragraphs | Same, headshot = photo spot | |
| `/contact/` | Contact | Phone, email, form → [where?] | Same, FormSubmit form → [email] | |
| `/old-thing/` | [feature] | [description] | Dropped / merged into … (+ redirect) | |

## Content sources
| Content | Source | Rights | Status |
|---|---|---|---|
| Photos | Old site uploads | **Owner confirms ownership** | |
| Reviews | Old site, copied word for word | Real clients | |
| Logo | | | |

## Things the old host did that the new site doesn't (tell the owner)
- [e.g. built-in lead form with auto-reply, listings feed, blog, booking]

## Cutover
Live on Cloudflare since [date]. Old host cancelled [date]. DNS records copied and checked: [list MX/SPF/verification].
