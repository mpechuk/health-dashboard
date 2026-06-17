# Health Dashboard

A lightweight, static HTML/JS dashboard that visualizes **steps, calories (burned &amp; consumed),
and weight over the last 7 days** — modeled on the
[Google Health API](https://developers.google.com/health) data format. It has **no build step
and no backend**, so it deploys cleanly to GitHub Pages.

Charts are rendered with [Chart.js v4](https://www.chartjs.org/) (loaded from a CDN).

> **Status:** Currently showing **demo data**. The data layer is shaped like Google Health API
> `dataPoints` responses, so connecting a live account later is a localized change — see
> [Going live with Google Health](#going-live-with-google-health).

## Project structure

```
index.html                     # markup: summary cards + 3 chart canvases
css/styles.css                 # responsive, dark UI
js/googleHealthData.js         # data layer — getDemoData() returns Google Health-shaped JSON
js/charts.js                   # Chart.js rendering (steps/calories bars, weight line)
js/app.js                      # wiring: load data, compute summaries, render charts
.github/workflows/deploy.yml      # publish main to the gh-pages branch
.github/workflows/pr-preview.yml  # deploy a temporary live preview per PR
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
site to the **`gh-pages`** branch on every push to `main`, and on manual dispatch.

**One-time setup:** in the repo, go to **Settings → Pages → Build and deployment**, set
**Source = "Deploy from a branch"**, and choose **Branch = `gh-pages` / `/ (root)`**. After the
next push to `main`, the `Deploy to GitHub Pages` workflow commits the site to `gh-pages` and
Pages serves it at `https://<user>.github.io/health-dashboard/`.

> Both the production site and the PR previews below live on the single `gh-pages` branch — the
> main deploy excludes the `pr-preview/` directory so open previews survive a production deploy.

## Preview a pull request

Every pull request gets its own **temporary live preview** so reviewers can see the change before
it merges. The `.github/workflows/pr-preview.yml` workflow
([`rossjrw/pr-preview-action`](https://github.com/rossjrw/pr-preview-action)):

- deploys the PR's version of the site to `gh-pages` under `pr-preview/pr-<number>/` when the PR
  is opened or updated,
- posts (and keeps updating) a sticky comment on the PR with the preview URL
  `https://<user>.github.io/health-dashboard/pr-preview/pr-<number>/`, and
- deletes that directory automatically when the PR is closed or merged.

Previews run only for PRs from branches **in this repo** (forks get a read-only token that can't
publish). No extra setup is needed beyond the one-time Pages configuration above.

## Going live with Google Health

The dashboard reads from `getDemoData()` in [`js/googleHealthData.js`](js/googleHealthData.js).
To use real data, create OAuth credentials and replace that function with live fetches.

1. **Create OAuth credentials** in the [Google Cloud Console](https://console.cloud.google.com/):
   - Enable the **Google Health API** for your project.
   - Create an **OAuth client** (public / "Web application" → uses PKCE, no secret stored).
   - Add your GitHub Pages URL as an **Authorized redirect URI**
     (e.g. `https://<user>.github.io/health-dashboard/`).
   - Request read-only scopes: `googlehealth.activity.readonly`,
     `googlehealth.body.readonly`, `googlehealth.nutrition.readonly`.

2. **Authorize with OAuth 2.0 + PKCE** (entirely client-side; no secret stored):
   - Generate a random `code_verifier` and derive `code_challenge = base64url(SHA-256(verifier))`.
   - Redirect the user to Google's authorization endpoint
     (`https://accounts.google.com/o/oauth2/v2/auth?...&code_challenge=<CHALLENGE>&code_challenge_method=S256`).
   - On return, exchange the `code` at `https://oauth2.googleapis.com/token` (sending the
     `code_verifier`) to get an access token.

3. **Fetch the data** with the access token and return it from `getDemoData()`'s replacement,
   keeping the same series shape so `charts.js`/`app.js` need no changes. Each metric is read
   from the `dataPoints` endpoint for its data type:

   | Metric            | Data type                       | Value field                       |
   |-------------------|---------------------------------|-----------------------------------|
   | Steps             | `com.google.step_count.delta`   | `intVal` (count)                  |
   | Calories burned   | `com.google.calories.expended`  | `fpVal` (kcal)                    |
   | Calories consumed | `com.google.nutrition`          | `mapVal` → `calories` (kcal)      |
   | Weight            | `com.google.weight`             | `fpVal` (kg)                      |

   ```js
   const headers = { Authorization: `Bearer ${accessToken}` };
   const base = "https://health.googleapis.com/v4/users/me/dataTypes";
   const get = async (type) =>
     (await fetch(`${base}/${type}/dataPoints?startTime=...&endTime=...`, { headers })).json();
   const steps     = await get("com.google.step_count.delta");
   const calories  = await get("com.google.calories.expended");
   const nutrition = await get("com.google.nutrition");
   const weight    = await get("com.google.weight");
   return { steps, calories, nutrition, weight };
   ```

## Notes

- Calories consumed is read from the **nutrition log** (`com.google.nutrition`): each dataPoint
  carries a nutrient map, and the `calories` nutrient holds the energy consumed that day.
- Weight is shown in **kilograms** (the Google Health API reports mass in kg) — adjust labels if
  you prefer a different unit.
- Demo data always spans the **last 7 calendar days ending today**, so the dashboard always
  looks current.
