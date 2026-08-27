# Urmia Works site — PROJECT.md
Updated: 2026-06-28

What: Umbrella studio landing page for future apps (ReadFlow, MultiMic, etc.). Static site +
1 Cloudflare Pages Function. Apple-style light theme, Lake Urmia line-art logo. Currently stealth.
Status: LIVE

Accounts:
- Cloudflare: tohid.moradi.kh@gmail.com (account id 490d777337f916bad4335f86dffb4f5e).
  Pages project = `urmiaworks` (production branch main). Zone tag 9854d7efc928d62c1f7c8c1c5c81dd00.
- Domain: urmiaworks.com (+ www). DNS in Cloudflare (CNAME @ + www → urmiaworks.pages.dev, proxied).
- Email: post@urmiaworks.com (signup fallback target).
- Optional (not yet bound): Resend (RESEND_API_KEY) for signup emails; KV binding NOTIFY_KV.

GitHub: none (local only). Deployed directly via Wrangler.
Hosting: Cloudflare Pages. Live: https://urmiaworks.com , https://www.urmiaworks.com , https://urmiaworks.pages.dev
Local path: urmiaworks_site/

Build/Run:
- Deploy: `cd urmiaworks_site; npx wrangler pages deploy . --project-name urmiaworks --branch main --commit-dirty=true`
- Wrangler auth: OAuth (token at %APPDATA%\xdg.config\.wrangler\config\default.toml). Token can do
  pages:write but NOT DNS edits — manage DNS in the Cloudflare dashboard.

Key files / subfolders:
- index.html, privacy.html, terms.html, 404.html, styles.css, app.js, favicon.svg.
- functions/api/notify.js — POST /api/notify launch-list signup (KV + Resend optional; safe no-op without).
- logo/ — standalone logo exports (mark, mark-white, mark-mono, horizontal).
- robots.txt — Disallow:/ (stealth); flip to Allow when first app launches.
- README.md — deploy guide.

Notes:
- Stealth mode: apps shown only as locked "coming soon" teasers. robots.txt blocks indexing.
- When first app launches: swap teaser cards for real app, flip robots.txt, remove noindex,
  set up Email Routing (post@/support@/admin@), optionally bind NOTIFY_KV + RESEND_API_KEY.
- No secrets in repo. Logo source-of-truth = hand-traced Lake Urmia vectors (see README/notes).
