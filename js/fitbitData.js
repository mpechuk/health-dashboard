/*
 * Data layer for the Health Dashboard.
 *
 * The shapes returned here intentionally mirror the real Fitbit Web API
 * time-series responses, so swapping in live data later is a localized change.
 *
 * Demo endpoints mirrored:
 *   steps    -> GET /1/user/-/activities/steps/date/today/7d.json
 *               { "activities-steps":    [ { "dateTime": "YYYY-MM-DD", "value": "8423" }, ... ] }
 *   calories -> GET /1/user/-/activities/calories/date/today/7d.json
 *               { "activities-calories": [ { "dateTime": "YYYY-MM-DD", "value": "2310" }, ... ] }
 *   weight   -> GET /1/user/-/body/weight/date/today/7d.json
 *               { "body-weight":         [ { "dateTime": "YYYY-MM-DD", "value": "70.4" }, ... ] }
 *
 * NOTE: Fitbit returns `value` as a string — we keep that here so the parsing
 * code in charts.js/app.js behaves identically against demo and live data.
 *
 * ---------------------------------------------------------------------------
 * TODO: live mode (Fitbit Web API, OAuth2 PKCE, fully client-side)
 * ---------------------------------------------------------------------------
 * 1. Register a "Personal" app at https://dev.fitbit.com (OAuth type = Client),
 *    set the redirect URI to this page's URL, scopes: "activity weight".
 * 2. Implement Authorization Code + PKCE:
 *      - generate a random code_verifier, derive code_challenge = S256(verifier)
 *      - redirect to https://www.fitbit.com/oauth2/authorize?...&code_challenge=...
 *      - exchange the returned code at https://api.fitbit.com/oauth2/token
 * 3. Replace getDemoData() with fetches, reusing the same keys, e.g.:
 *      const headers = { Authorization: `Bearer ${accessToken}` };
 *      const steps = await (await fetch(
 *        'https://api.fitbit.com/1/user/-/activities/steps/date/today/7d.json',
 *        { headers })).json();
 *    Then return { steps, calories, weight } just like getDemoData() does.
 * See README.md ("Going live with Fitbit") for the full walkthrough.
 */

/** Format a Date as Fitbit's "YYYY-MM-DD". */
function toFitbitDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a Fitbit-shaped time series for the last 7 calendar days ending today.
 * @param {string} key   the Fitbit response key (e.g. "activities-steps")
 * @param {(dayIndex:number)=>(number|string)} valueFor  value generator (0 = oldest)
 * @returns {object}     { [key]: [ { dateTime, value }, ... ] }
 */
function buildSeries(key, valueFor) {
  const series = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const dayIndex = 6 - i; // 0 = oldest day, 6 = today
    series.push({ dateTime: toFitbitDate(day), value: String(valueFor(dayIndex)) });
  }
  return { [key]: series };
}

/**
 * Returns demo data for steps, calories, and weight over the last 7 days.
 * Each property matches the corresponding Fitbit Web API response object.
 */
function getDemoData() {
  // Plausible weekday values (index 0 = six days ago ... index 6 = today).
  const stepsByDay = [9120, 6430, 12840, 8210, 5170, 13360, 7480];
  const caloriesByDay = [2410, 2080, 2760, 2330, 1890, 2820, 2210];
  // Gentle downward weight trend (kg), one decimal like Fitbit.
  const weightByDay = [70.9, 70.8, 70.6, 70.7, 70.4, 70.2, 70.3];

  return {
    steps: buildSeries("activities-steps", (i) => stepsByDay[i]),
    calories: buildSeries("activities-calories", (i) => caloriesByDay[i]),
    weight: buildSeries("body-weight", (i) => weightByDay[i].toFixed(1)),
  };
}

// Expose globally for the non-module scripts that follow.
window.HealthData = { getDemoData };
