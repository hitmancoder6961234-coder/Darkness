# Deploying Darkness

Darkness is a **static site** (HTML, CSS, JS) whose data lives in a **Google Sheet** behind a **Google Apps Script** web app. There is no server of our own and no database, so any static host works. This file explains the hosting rules (`vercel.json`, `render.yaml`, `404.html`), where secrets live, and when (and when not) to bring in Aiven.

## What each file does

| File | Purpose |
|---|---|
| `vercel.json` | Vercel settings: publish only the website files, clean URLs, redirects/rewrites, security headers (CSP, HSTS, frame blocking), caching, "do not index" for admin pages. |
| `render.yaml` | The same rules as a Render Blueprint for a static site. |
| `404.html` | Branded "page not found" page (self-contained, works at any URL depth). Used by GitHub Pages, Vercel and Render. |
| `.gitignore` | Keeps `.secrets/`, `.env*`, build output out of git. |
| `tools/New-AdminHash.ps1` | Creates the private admin-login properties (see "Secrets"). Contains no secrets itself. |

Both Vercel and Render run `mkdir -p dist && cp -r *.html css js assets dist/` and publish only `dist/`, so `tools/`, `SETUP.md`, `DEPLOY.md` and `google-apps-script.js` are **not** served on those hosts.

## Rules applied on Vercel and Render

- **Security headers on every response:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (and CSP `frame-ancestors 'none'`, so the site cannot be embedded in someone else's page), `Referrer-Policy: strict-origin-when-cross-origin`, a locked-down `Permissions-Policy`, `Strict-Transport-Security`.
- **Content-Security-Policy:** scripts only from this site plus `cdn.jsdelivr.net` (Chart.js); styles/fonts only from this site plus Google Fonts; images from this site / `data:` / `blob:`; `connect-src` allows `https:` (the Apps Script web app and whichever AI provider you configure) and `http://localhost:*` (a local Ollama); no plugins (`object-src 'none'`). Inline scripts/styles are still allowed because the existing pages use them (`survey.html` has inline `onclick` handlers, `Quiz.html`/`breathing.html` have inline scripts). Tightening this further means moving those into files first.
- **Admin pages** (`/admin`, `/dashboard`, `/ai`): `X-Robots-Tag: noindex, nofollow` (and `<meta name="robots">` in the HTML, which also applies on GitHub Pages).
- **Caching:** CSS/JS 1 hour (revalidated), images 7 days, HTML always revalidated.
- **Routing:** `/request.html` redirects to the survey; `/survey`, `/dashboard`, `/admin`, `/ai`, `/quiz`, `/okay`, `/breathing` work without `.html`; unknown URLs show `404.html`.

## Secrets and environment variables (read this)

**Anything that ships to the browser is public** (and so is anything in a public GitHub repo). A static host has no private runtime environment, so putting an admin password, hash or key in Vercel/Render settings does not make it secret if the page's JavaScript can read it.

Where each secret actually lives:

| Secret | Lives in | Never in |
|---|---|---|
| Admin username, salt, password hash, session-signing secret | **Apps Script > Project Settings > Script properties** (`ADMIN_USER`, `ADMIN_SALT`, `ADMIN_PASS_HASH`, `ADMIN_ITER`, `SESSION_SECRET`). These are the project's environment variables. | GitHub, `vercel.json`, `render.yaml`, any `.js` file |
| Admin password (plaintext) | Your head / password manager | Any file. The PowerShell tool reads it from the `DARKNESS_ADMIN_PASSWORD` environment variable (or a hidden prompt) and wipes it afterwards. |
| AI provider API keys | The visitor's own browser tab (`sessionStorage`) | The repo or the hosting settings |

If you ever add a real server (a Render web service or Vercel Functions) that does the login itself, **that** is where you would set the same variable names as environment variables in the Render/Vercel dashboard (Settings > Environment). Mark them secret and never prefix them with anything that exposes them to the browser (for example Vercel's `NEXT_PUBLIC_`, or Vite's `VITE_`).

Rules to keep: use a long unique password (not your server/SSH one), rotate `SESSION_SECRET` to sign everyone out, never commit `.secrets/`, and never paste credentials into chat or issues.

## Deploy on GitHub Pages (current)

Push to `main`. Pages publishes from the branch root (repo **Settings > Pages > Deploy from a branch > `main` / `(root)`**). The headers and routing rules above do **not** apply on GitHub Pages (it ignores `vercel.json` and `render.yaml`); the `<meta name="robots">` tags and `404.html` do.

## Deploy on Vercel

1. vercel.com > **Add New > Project** > import the GitHub repo.
2. Framework preset **Other**; leave the build settings alone (they come from `vercel.json`). No environment variables are required.
3. **Deploy.** Add a custom domain under Settings > Domains if you want one.

## Deploy on Render

1. render.com > **New > Blueprint** > select the repo (Render reads `render.yaml`), or **New > Static Site** and use: build command `mkdir -p dist && cp -r *.html css js assets dist/`, publish directory `dist`.
2. **Apply.** Pushes to `main` redeploy automatically; pull requests get preview URLs.

## After moving to a new address

- In `google-apps-script.js` update `SURVEY_LINK` (it is used in the approval email) and redeploy the Apps Script. The `og:url` / `og:image` tags in `index.html` still point at the GitHub Pages address; change them to the new domain if you want link previews to use it.
- The Apps Script web app accepts requests from any origin, so no CORS change is needed.

## Aiven: not needed right now

Aiven provides managed databases (PostgreSQL, MySQL and others). **Darkness has no database**: requests and responses are rows in a Google Sheet, and login is checked by Apps Script. Adding Aiven today would only add cost and moving parts, so **no Aiven configuration was created**.

Consider Aiven if you outgrow the Sheet, for example: tens of thousands of responses (Sheets and Apps Script get slow, and have daily quotas), you need SQL analytics or joins, several admins edit at once, or you want a server-side audit log.

If you do adopt it, the rules to follow:

1. A browser must never connect to the database. Put an API in between (a Render web service or Vercel Functions) and move the admin API there from Apps Script.
2. Store the connection string only as an environment variable on that API (for example `DATABASE_URL`, using the Aiven service URI with `sslmode=require`), never in the repo or in front-end code.
3. Create a least-privilege database user for the API (no superuser), use a strong generated password, restrict access to the API's addresses where the host provides stable ones, and enable Aiven's backups.
4. Keep the admin login variables (`ADMIN_USER`, `ADMIN_SALT`, `ADMIN_PASS_HASH`, `ADMIN_ITER`, `SESSION_SECRET`) as environment variables of that API as well.
5. Check Aiven's current plans and free-tier limits before choosing a service.
