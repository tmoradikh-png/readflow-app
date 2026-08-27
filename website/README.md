# Urmia Works — landing site

The umbrella site for **Urmia Works**, an independent software studio. It's a
single, polished landing page that introduces the studio and teases upcoming
apps **without revealing what they are** (everything is in "private
development" / "coming soon"). Built to deploy on **Cloudflare Pages**.

## What's here

```
urmiaworks_site/
├── index.html            Landing page (hero · apps teaser · studio · approach · notify)
├── privacy.html          Privacy policy
├── terms.html            Terms of use
├── 404.html              Friendly not-found page
├── styles.css            All styling (dark "aurora" studio theme)
├── app.js                Nav, scroll reveals, notify-form logic + mailto fallback
├── favicon.svg           Logo mark
├── robots.txt            Stealth: blocks crawlers for now (flip at launch)
├── _headers              Security + cache headers (Cloudflare Pages)
└── functions/
    └── api/
        └── notify.js     POST /api/notify — launch-list sign-ups
```

The site is **static + one serverless function**, so it runs on Cloudflare
Pages with zero servers to manage. Nothing about the actual apps is exposed.

---

## Deploy to Cloudflare Pages (recommended — domain is already on Cloudflare)

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages**.
2. Connect a Git repo **or** use **Direct Upload** and drop the contents of this
   `urmiaworks_site/` folder.
   - **Build command:** _(none)_
   - **Output directory:** `/` (the folder root)
3. After the first deploy, go to **Custom domains** and add `urmiaworks.com`
   (and `www.urmiaworks.com`). Since the domain is already on Cloudflare, DNS is
   wired automatically.

### Wire up the notify form (optional, additive)

The form at `/api/notify` works the moment the function deploys. To actually
**capture** sign-ups, add either or both in **Pages → Settings → Functions**:

- **Store them:** create a **KV namespace** and bind it as `NOTIFY_KV`.
  Every sign-up is saved as `signup:<email>`.
- **Get emailed:** set environment variable `RESEND_API_KEY` (from
  [resend.com](https://resend.com)). Optionally `NOTIFY_TO`
  (default `post@urmiaworks.com`) and `NOTIFY_FROM`
  (a verified sender, e.g. `Urmia Works <post@urmiaworks.com>`).

If neither is configured, the form still confirms politely. If the function
isn't deployed at all, the front-end falls back to opening the visitor's email
app addressed to **post@urmiaworks.com**.

> **No secrets in this repo.** API keys live only in Cloudflare env vars.

---

## Email

The site references your Cloudflare-routed addresses:

- `post@urmiaworks.com` — general contact (shown on the page)
- `support@urmiaworks.com` — support (shown in the footer)
- `admin@urmiaworks.com` — kept private (not published on the site)

Set these up under **Cloudflare → your domain → Email → Email Routing**.

---

## Local preview

Any static server works, e.g.:

```pwsh
cd urmiaworks_site
python -m http.server 8080
# open http://localhost:8080
```

To test the `/api/notify` function locally, use Wrangler:

```pwsh
npx wrangler pages dev .
```

---

## At launch (when the first app is public)

- Edit `index.html` → swap the "Project 01/02" teaser cards for the real apps.
- In `robots.txt`, change `Disallow: /` to `Allow: /` so search engines index it.
- Remove `<meta name="robots" content="noindex">` from `privacy.html` /
  `terms.html` if you want them indexed.

Until then, the site stays deliberately vague — it says a studio exists and
something is coming, nothing more.
