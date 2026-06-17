# Health Dashboard

A lightweight, static HTML/JS dashboard that visualizes **steps, calories burned, and weight
over the last 7 days** — modeled on the [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/)
data format. It has **no build step and no backend**, so it deploys cleanly to GitHub Pages.

Charts are rendered with [Chart.js v4](https://www.chartjs.org/) (loaded from a CDN).

> **Status:** Currently showing **demo data**. The data layer is shaped exactly like real
> Fitbit Web API responses, so connecting a live account later is a localized change — see
> [Going live with Fitbit](#going-live-with-fitbit).

## Project structure

```
index.html                     # markup: summary cards + 3 chart canvases
css/styles.css                 # responsive, dark UI
js/fitbitData.js               # data layer — getDemoData() returns Fitbit-shaped JSON
js/charts.js                   # Chart.js rendering (steps/calories bars, weight line)
js/app.js                      # wiring: load data, compute summaries, render charts
.github/workflows/deploy.yml   # GitHub Actions deploy to Pages
.nojekyll                      # serve css/ and js/ folders verbatim (skip Jekyll)
```

## Run locally

It's a static site — open `index.html` directly, or serve it (recommended, mirrors hosting):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy (GitHub Pages)

This repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes the
site on every push to `main` or the working branch, and on manual dispatch.

**One-time setup:** in the repo, go to **Settings → Pages → Build and deployment** and set
**Source = "GitHub Actions"**. After the next push, the `Deploy to GitHub Pages` workflow
publishes the site and prints its URL in the run summary.

## Going live with Fitbit

The dashboard reads from `getDemoData()` in [`js/fitbitData.js`](js/fitbitData.js). To use real
data, register a Fitbit app and replace that function with live fetches.

1. **Register an app** at <https://dev.fitbit.com/apps/new>:
   - **OAuth 2.0 Application Type:** `Client` (public app, no client secret → uses PKCE)
   - **Callback URL / Redirect URI:** your GitHub Pages URL
     (e.g. `https://<user>.github.io/health-dashboard/`)
   - **Default Access Type:** Read-Only
   - Note your **Client ID**.

2. **Authorize with OAuth 2.0 + PKCE** (entirely client-side; no secret stored):
   - Generate a random `code_verifier` and derive `code_challenge = base64url(SHA-256(verifier))`.
   - Redirect the user to
     `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=<CLIENT_ID>&scope=activity%20weight&code_challenge=<CHALLENGE>&code_challenge_method=S256`.
   - On return, exchange the `code` at `https://api.fitbit.com/oauth2/token` (sending the
     `code_verifier`) to get an access token.

3. **Fetch the data** with the access token and return it from `getDemoData()`'s replacement,
   keeping the same response keys so `charts.js`/`app.js` need no changes:

   | Metric   | Endpoint                                                        | Response key          |
   |----------|-----------------------------------------------------------------|-----------------------|
   | Steps    | `GET /1/user/-/activities/steps/date/today/7d.json`             | `activities-steps`    |
   | Calories | `GET /1/user/-/activities/calories/date/today/7d.json`          | `activities-calories` |
   | Weight   | `GET /1/user/-/body/weight/date/today/7d.json`                  | `body-weight`         |

   ```js
   const headers = { Authorization: `Bearer ${accessToken}` };
   const base = "https://api.fitbit.com/1/user/-";
   const steps    = await (await fetch(`${base}/activities/steps/date/today/7d.json`,    { headers })).json();
   const calories = await (await fetch(`${base}/activities/calories/date/today/7d.json`, { headers })).json();
   const weight   = await (await fetch(`${base}/body/weight/date/today/7d.json`,         { headers })).json();
   return { steps, calories, weight };
   ```

The Fitbit Web API supports CORS for these requests, so they work directly from the browser.

## Notes

- Weight is shown in **kilograms**. Fitbit returns weight in the unit set by the
  `Accept-Language` header / account locale — adjust labels if you use a different unit.
- Demo data always spans the **last 7 calendar days ending today**, so the dashboard always
  looks current.
