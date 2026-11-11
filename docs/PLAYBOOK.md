# Client playbook – from first meeting to handoff

How to rebuild a small business's website from its CURRENT site, give the owner a dead-simple
editor for photos and reviews, and move them onto Cloudflare without breaking email.
Proven on danmckennahomes.com (Nov 2026). Rough time: 1–3 days of work per client, spread over ~2 weeks.

> **The golden rule:** the new site is a copy of *their* site, done properly. Not a template look.
> Copy their words, colors, pages and addresses. Never invent facts, awards, numbers or reviews.

```
1 Intake → 2 Audit & copy → 3 Rebuild → 4 Testing link → 5 Editor → 6 Live site → 7 DNS switch → 8 Handoff → 9 Old host off
```

---

## 1. Intake (first meeting, ~30 min)
Use **[INTAKE-CHECKLIST.md](INTAKE-CHECKLIST.md)**. The must-haves before you start:
* Their current website address, and **who hosts it** (Wix, Squarespace, Placester, GoDaddy…).
* **Where the domain is registered** (GoDaddy, Namecheap, Google/Squarespace…) and a way to log in.
* **Who handles their email** on that domain (Google Workspace, Microsoft 365, GoDaddy email…). Email is the #1 thing a DNS move can break.
* Which photos they own, which reviews are real, what they want to change themselves (usually: photos, reviews).
* Which computer the owner edits on (the editor is laptop-only by default).

## 2. Audit & copy the current site
1. Make the client's repo (exact steps: [START-HERE.md](START-HERE.md)): **github.com/new** → *Repository template*: `client-site-template` → name `<client>-site`
   → **Public** (Private only with GitHub Pro – free accounts get the testing link for public repos only; secrets never live in the repo) → Create. (Or the green **Use this template** button on the template repo.)
2. Clone it, `npm ci`, `npm run skills:check` (lists the design skills – they come with the repo), then **`npm run new-client`** – answers ~10 questions and fills in
   `client.config.json`, `content/site.json` and the Cloudflare config files. Run `npm test` straight away: the tests read
   the client's own config (features switched off are skipped, photo spots and pages come from the config), so they must
   pass for every client – a failing test blocks every publish the owner makes.
3. Walk every page of their current site. Fill in **[MIGRATION-TEMPLATE.md](MIGRATION-TEMPLATE.md)** (copy it to `docs/MIGRATION.md`):
   one row per page: old address, title, what's on it, keep/merge/drop, and **who confirmed**.
4. Copy their text into `content/site.json` (and extra content files if needed), **word for word**.
5. Copy reviews into `content/reviews.json` word for word. If the old site only showed a cut-off part, keep only the
   complete sentences and mark `"excerptOnly": true`. Never reword a client's words.
6. Download their photos (only ones they own) → `npm run photo -- hero <file> 1` for slideshow photos,
   `npm run photo -- page <file> <name>` for others. This strips GPS/camera data and makes the right sizes.
7. Keep their **page addresses** (paths). If one must change, add it to `client.config.json → redirects`
   (`{ "/old-path/": "/new-path/" }`) so Google and old links keep working.

## 3. Rebuild their design
> **Which design skill does what:** [DESIGN-PIPELINE.md](DESIGN-PIPELINE.md). A faithful rebuild is **Track A** – checks
> only (web-design-guidelines, Impeccable, visual-check, playwright-cli); the restyling skills stay out of it.
> **No existing site, or no inspiration to work from?** Use the `design-from-scratch` skill instead of rebuilding: write a brief, research the category, make 3 direction previews, and let the client pick one.
* `src/site/layout.mjs` (header, menu, footer), `src/site/pages.mjs` (each page), `src/site/routes.mjs` (page list),
  `public/assets/css/site.css` (their colors, fonts, spacing). Start from the starter files and reshape them.
* Use parts from the **[parts library](PARTS.md)** only where their site has (or wants) that thing:
  slideshow, reviews row, contact form, fade-in, replaceable photos ("photo spots").
* Every photo the owner should be able to change → add a **photo spot** in `client.config.json → photoSpots`
  and render it with `spotImage(ctx, '<key>')`.
* Fonts: self-host (put `.woff2` files in `public/assets/fonts/`, `@font-face` in site.css). Check the font's licence.
* Favicon: replace `public/favicon.ico`, `public/assets/img/favicon-32.png`, `apple-touch-icon.png` with theirs.
* Mobile first. Check at 390 px wide (phone) and 1366 px (laptop). Big tap targets (48 px), readable text (≥16 px).
* Avoid the "AI website look": no stock gradients, no invented stats, no "Elevate your…" copy. Match what they have.
* Run Track A's checks (A2–A6 in [DESIGN-PIPELINE.md](DESIGN-PIPELINE.md)). `npm test` must pass (and `npm run test:ui` + `npm run test:visual` after editor or layout changes). `npm run build:preview` and open `dist/index.html` to check.

## 4. Testing link (GitHub Pages)
Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**. (Free GitHub accounts: public repos only.) Every push now updates
`https://<you>.github.io/<repo>/` – yellow "Testing preview" banner, hidden from Google, contact form off.
Send the link to the client and iterate until they're happy. **Get a clear "yes, this looks right."**

## 5. The owner editor (Cloudflare)
Do this on **your** computer. The client's Cloudflare account should be **theirs** (signed up with their email);
they invite you as **Super Administrator** (Members page → **Invite members** → **Add permission policies**; Cloudflare's docs only confirm that role can create API tokens). Ask them to turn on 2-step verification.

**a. Storage + first deploy**
```bash
cd owner
npx wrangler login
npx wrangler d1 create <slug>-editor            # → put the id in client.config.json → cloudflare.d1Id
npx wrangler kv namespace create PHOTOS         # → cloudflare.kvId
# also put the account id in cloudflare.accountId (dashboard → Workers & Pages, right side)
cd .. && npm run configure && cd owner
npx wrangler d1 migrations apply <slug>-editor --remote
```
**b. GitHub token for the editor** – github.com → Settings → Developer settings → Fine-grained tokens →
Generate. Name `<slug>-editor`, expiry 1 year (calendar reminder!), *Only select repositories* → the client repo,
Permissions: **Contents: Read and write**, **Actions: Read and write**.

**c. Secrets** (each asks you to paste a value; never commit these)
```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put OWNER_EMAILS        # the owner's sign-in email(s), comma-separated
npx wrangler secret put MAINTAINER_EMAILS   # your email
npx wrangler secret put SUPPORT_EMAIL       # your email (shown to the owner)
npx wrangler secret put SUPPORT_PHONE       # optional
npx wrangler deploy                         # → https://<slug>-editor.<subdomain>.workers.dev
```
**d. Sign-in (Cloudflare Access)** – first turn on email codes: Zero Trust → **Integrations → Identity providers** → Add → *One-time PIN*. Then Worker → Settings → **Domains & Routes → Enable Cloudflare Access** (or Zero Trust → **Access controls → Applications** → Create new application → *Self-hosted and private*).
Attach it **to the Worker** (destination type *Worker*, pick `<slug>-editor`) – a plain `*.workers.dev` hostname
alone was NOT enforced for us. Policy: *Allow* → Emails → owner + you. Session 30 days.
Login method: One-time PIN (6-digit email code) is easiest for owners; the Cloudflare-account login also works.
Turn on *auto-redirect to identity provider* so the owner lands straight on the sign-in page.
Copy the **team domain** and **AUD tag** into `client.config.json → cloudflare.accessTeamDomain / accessAud`,
`npm run configure`, `npx wrangler deploy`, commit + push.

**e. Check (all must pass before the owner sees it)**
* Private window → editor address → sign-in page appears. An email not on the list → refused.
* `curl -i https://<editor>/api/me` → **401**.
* Sign in → "Your website" screen with the right photo boxes. Preview works. Publish a harmless photo → **✓ Done**.
* On a phone → friendly "Please use your laptop" screen.

## 6. Live site on Cloudflare (still on a test address)
1. **GitHub secret** so pushes go live: Cloudflare → My Profile → API Tokens → Create Token →
   template **Edit Cloudflare Workers** → Account: the client's account → Zone: their domain (once added, step 7) →
   Create → **Copy** (just the token – not the curl command under it). GitHub repo → Settings → Secrets and variables →
   Actions → New secret `CLOUDFLARE_API_TOKEN` → paste → Add. (Pasting the wrong thing gives "Invalid access token" (9109)
   in the Actions log – roll the token and paste again.)
2. Push anything (or Actions → *Publish live website* → Run). Check `https://<slug>-site.<subdomain>.workers.dev`:
   every page, photos, form (off-domain it's still live – don't submit real tests yet), `/version.json`.
   That address sends `noindex`, so Google won't list it.

## 7. DNS switch (the risky part – go slow)
**Before touching anything, record every current DNS record.** Look them up yourself (e.g. `dns.google/resolve?name=<domain>&type=MX`)
for: apex `A/AAAA`, `www`, **MX**, all **TXT** (SPF, Google/Microsoft verification, DMARC), DKIM (`google._domainkey`,
`selector1._domainkey`…), `autodiscover`, and **every name an SPF `include:` points at on their own domain**.
> Dan's domain had `v=spf1 include:dc-xxxx._spfm.<domain>` – a hidden GoDaddy helper record. Cloudflare's scan
> **missed it**; without it his email would have started landing in spam. Always resolve SPF includes.

1. Cloudflare → **Domains → Onboard a domain** (NOT transfer) → scan DNS records → **Free** plan.
2. Compare the imported list with your notes. Add anything missing. Set helper records (`email`, `ftp`,
   `_domainconnect`, mail-related CNAMEs) to **DNS only** (gray cloud). Leave MX/TXT exactly as they were.
3. Point the site at Cloudflare: delete the old host's `A` (apex) and `www` records, then Worker `<slug>-site` →
   Settings → Domains & Routes → **Add custom domain** for `www.<domain>` and `<domain>` (the worker forwards the bare
   domain to www). Zone → SSL/TLS → Edge certificates → **Always Use HTTPS: on**.
4. **Only now** change nameservers at the registrar to the two Cloudflare gives you (GoDaddy: My Products → domain →
   DNS → Nameservers → Change → *I'll use my own*). Old site keeps working until it switches – no downtime.
5. Wait (minutes to 24 h). Check: `dns.google` shows Cloudflare nameservers; MX still the same; `https://www.<domain>`
   loads the new site with a padlock; bare domain forwards; `/version.json` = latest commit.
6. Point the editor at the live site: `client.config.json → domain.main` is used for `PUBLIC_SITE_URL`
   (`npm run configure`, commit, push – the editor redeploys itself).
7. Contact form: send one test message from the live site → the owner gets **"Activate Form"** from FormSubmit →
   they click it → send another test → confirm it arrives (check spam). Optional: swap their email in
   `content/site.json → contactFormTo` for the random alias FormSubmit shows, so the address isn't in the page code.

## 8. Handoff
* Copy **[OWNER-GUIDE-TEMPLATE.md](OWNER-GUIDE-TEMPLATE.md)** → `docs/OWNER-GUIDE.md`, fill in links + your contact.
* Sit with the owner on **their laptop**: open the editor, sign in once, bookmark it (Ctrl + D → bookmarks bar →
  "Website Editor"). Nothing to download or install.
* Have them do one real change themselves: replace a photo → Preview → Publish → **✓ Done** → View website.
* Send a test email to their address and have them reply (proves email survived).
* Write open items in `docs/CIRCLE-BACK.md` (from [CIRCLE-BACK-TEMPLATE.md](CIRCLE-BACK-TEMPLATE.md)).
* Delete any temporary Cloudflare tokens you made for setup. Keep only the GitHub secret one.

## 9. Old host off
Wait **about a week** of the new site running cleanly, then the owner cancels the old host (Wix/Placester/…).
Cancelling earlier means anyone whose internet still has the old address cached sees a dead page.
**Do not** cancel the domain registration or their email service – only the old website plan.

---

## After launch
* **Owner changes:** they publish from the editor; GitHub tests, builds and puts it live in ~2 minutes.
* **Your changes:** push to `main` → same pipeline. `git pull` first (the editor commits too). Undo = `git revert <sha>` + push.
* **Editor code changes** (`owner/`, `src/`) redeploy the editor automatically (`.github/workflows/editor.yml`).
* **Yearly:** renew the GitHub token (step 5b) and check the Cloudflare token's expiry.
* **Costs:** GitHub, Cloudflare (Workers, D1, KV, Access ≤ 50 users) and FormSubmit are free at this size.
  Over-limit requests fail rather than bill. The domain renewal stays with the registrar.
