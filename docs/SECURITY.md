# Security review (template)

Architecture: static public site served by a Cloudflare Worker (no server-side code that reads visitor data) +
an owner editor Worker behind Cloudflare Access. Only the editor can write, and only to the client's repo.
Re-check this table for each client before launch (column "Client check").

| Item | How it's handled | Status in template |
|---|---|---|
| Secrets in code / history | None in the repo. GitHub token = editor Worker secret; Cloudflare token = GitHub Actions secret. `.gitignore` covers `.dev.vars` | Reviewed |
| Authentication | Cloudflare Access in front of the whole editor (attached to the Worker) | Host – set up per client |
| Server-side authorization | Every `/api/*` call verifies the Access JWT (RS256 via JWKS, audience, issuer, expiry) **and** an email allow-list (owner vs maintainer). Fails closed if not configured | Tested (missing/forged/expired/wrong-aud/not-listed → 401) |
| Write protection | Writes only in the Worker; fine-grained GitHub token limited to one repo (Contents + Actions) | Tested |
| Drafts private | Drafts/photos live in D1/KV and are only served through the authenticated API | Tested |
| Input validation | Build refuses bad content (`scripts/build.mjs → loadContent`); editor validates every field; IDs/paths by regex | Tested |
| Output escaping | Every value through `escapeHtml` (`e()`) in templates and the editor UI | Tested |
| SQL injection | D1 bound parameters only | Reviewed |
| Uploads | Magic-byte sniffing, JPEG structure parse, size + dimension caps, fakes rejected | Tested |
| Location metadata | Browser re-encodes; server strips EXIF/GPS again; `npm run photo` strips for repo photos | Tested |
| CSRF | Writes need header `X-Site-Editor` (forces a CORS preflight that is never granted) + matching `Origin` | Tested |
| Duplicate / lost changes | Idempotency keys; revision check (409 "Reload latest"); publish lock; non-forced Git push with retry | Tested |
| Security headers | Editor: CSP `default-src 'self'`, X-Frame-Options DENY, nosniff, HSTS, Referrer/Permissions-Policy. Live site worker: nosniff, SAMEORIGIN, Referrer/Permissions-Policy, HSTS | Tested (editor) / Reviewed (site) |
| Search engines | Testing link + workers.dev addresses: noindex. Live: canonical + sitemap | Tested |
| Visitor data (contact form) | Sent by the visitor's browser straight to FormSubmit → owner's inbox; nothing stored by us. Off on previews. Honeypot. Verify delivery with a test after activation | Tested (markup) – **verify per client** |
| Rate limits / spend | Per-user daily caps in the editor; everything on free plans (over-limit fails, never bills) | Reviewed |
| Phones | Editor refuses phone browsers (house rule, not security) – `ALLOW_PHONES=true` secret to allow | Tested |

**Per-client launch checks:** Access policy lists only the right emails · GitHub token scoped to that repo only ·
`curl -i <editor>/api/me` → 401 · temporary Cloudflare tokens deleted after setup · contact form test received.
