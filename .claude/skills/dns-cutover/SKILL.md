---
name: dns-cutover
description: Use when moving a client's domain to Cloudflare, changing nameservers, or touching any DNS record – a careful, ask-first procedure that protects the client's email and avoids downtime.
---

# DNS cutover (careful – this can break the client's email)

**Always ask the user before any DNS, nameserver or registrar change, and before cancelling an old host.**
Full context: `docs/PLAYBOOK.md` step 7.

## 1. Snapshot first
```
npm run dns:snapshot -- clientdomain.com     # writes docs/DNS-BEFORE.md
```
It records apex/www/MX/TXT/DKIM/DMARC/autodiscover and **follows SPF `include:` names on the client's own domain**
(GoDaddy hides the real SPF in `dc-xxxx._spfm.<domain>` – Cloudflare's import missed it on Dan's domain). Also look at
the registrar's DNS page for records that can't be seen from outside (custom subdomains, SRV for phones/Teams).
Commit `docs/DNS-BEFORE.md`.

## 2. Add the domain to Cloudflare (no effect yet)
"Connect a domain" (never "Transfer") → Quick scan → Free plan. Compare every imported record with DNS-BEFORE.md;
add anything missing. Mail/helper records (`email`, `ftp`, `_domainconnect`, `autodiscover`, mail CNAMEs) → **DNS only**
(gray cloud). MX and TXT exactly as before.

## 3. Point the website at Cloudflare (still no effect until nameservers change)
Delete the old host's apex `A`/`AAAA` and `www` record → add Worker custom domains `www.<domain>` and `<domain>` to the
`<slug>-site` worker → SSL/TLS → Always Use HTTPS on.

## 4. The switch (user does this at the registrar)
Give exact clicks for their registrar to set the two Cloudflare nameservers. The old site keeps working until the
switch propagates, so there's no downtime. Never touch the domain's registration, renewal or contact details.

## 5. Verify (don't skip)
* `dns.google/resolve?name=<domain>&type=NS` → Cloudflare nameservers.
* MX, SPF (and the hidden SPF helper), verification TXT → identical to DNS-BEFORE.md.
* `https://www.<domain>` → new site, padlock; bare domain → forwards to www; `/version.json` → latest commit.
* Ask the owner to send and receive one email.
* Then point the editor at the live site (`domain.main` → `npm run configure` → push).

## 6. Old host
Only after ~a week of the new site working: the owner cancels the old **website plan** (not the domain, not email).
