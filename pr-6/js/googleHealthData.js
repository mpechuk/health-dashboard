/*
 * Data layer for the Health Dashboard.
 *
 * The shapes returned here mirror the Google Health API (v4) `dataPoints`
 * model, so swapping in live data later is a localized change.
 *   https://developers.google.com/health
 *
 * Each metric is returned as a typed series:
 *   {
 *     dataTypeName: "com.google.step_count.delta",
 *     dataPoints: [
 *       { startTime, endTime, value: [ <typed field>, ... ] }, ...
 *     ]
 *   }
 *
 * `value` is an array of typed fields, matching the Google Health / Fit data
 * model — fields carry one of `intVal`, `fpVal`, `strVal`, or `mapVal`:
 *
 *   steps     -> com.google.step_count.delta   value: [ { intVal } ]            (count)
 *   calories  -> com.google.calories.expended  value: [ { fpVal } ]             (kcal)
 *   nutrition -> com.google.nutrition          value: [ { mapVal:[{key,value:{fpVal}}] },
 *                                                         { intVal }   // meal_type
 *                                                         { strVal } ] // food_item
 *   weight    -> com.google.weight             value: [ { fpVal } ]             (kg)
 *
 * Calories consumed comes from the nutrition log: each nutrition dataPoint
 * carries a nutrient map, and the `calories` key holds the energy consumed.
 *
 * ---------------------------------------------------------------------------
 * TODO: live mode (Google Health API, OAuth2, fully client-side)
 * ---------------------------------------------------------------------------
 * 1. Create OAuth credentials in Google Cloud, add the redirect URI to this
 *    page's URL, and request the read-only scopes you need, e.g.
 *    `googlehealth.activity.readonly`, `googlehealth.body.readonly`,
 *    `googlehealth.nutrition.readonly`.
 * 2. Implement Authorization Code + PKCE against Google's OAuth2 endpoints.
 * 3. Replace getDemoData() with calls to
 *      GET https://health.googleapis.com/v4/users/me/dataTypes/<type>/dataPoints
 *    reusing the same series shape so charts.js/app.js need no changes.
 * See README.md ("Going live with Google Health") for the full walkthrough.
 */

/** Format a Date as a local "YYYY-MM-DD" (avoids UTC TZ drift). */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a Google Health-shaped series for the last 7 calendar days ending today.
 * @param {string} dataTypeName  the data type id (e.g. "com.google.step_count.delta")
 * @param {(dayIndex:number)=>object[]} valueFor  value-field generator (0 = oldest)
 * @returns {{dataTypeName:string, dataPoints:object[]}}
 */
function buildSeries(dataTypeName, valueFor) {
  const dataPoints = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const dayIndex = 6 - i; // 0 = oldest day, 6 = today
    dataPoints.push({
      // Day-long window, RFC3339. Date portion is built from local Y-M-D so the
      // calendar day is stable regardless of the viewer's timezone.
      startTime: `${toDateStr(day)}T00:00:00Z`,
      endTime: `${toDateStr(next)}T00:00:00Z`,
      value: valueFor(dayIndex),
    });
  }
  return { dataTypeName, dataPoints };
}

/** A com.google.nutrition value: a calories nutrient map + meal_type + food_item. */
function nutritionValue(calories) {
  return [
    { mapVal: [{ key: "calories", value: { fpVal: calories } }] },
    { intVal: 0 }, // meal_type: 0 = unspecified (full-day total)
    { strVal: "Daily total" }, // food_item
  ];
}

/**
 * Returns demo data for steps, calories burned, nutrition (calories consumed),
 * and weight over the last 7 days. Each property is a Google Health series.
 */
function getDemoData() {
  // Plausible weekday values (index 0 = six days ago ... index 6 = today).
  const stepsByDay = [9120, 6430, 12840, 8210, 5170, 13360, 7480];
  const caloriesByDay = [2410, 2080, 2760, 2330, 1890, 2820, 2210];
  // Calories consumed, logged via the nutrition log (com.google.nutrition).
  const caloriesInByDay = [2300, 2200, 2500, 2600, 2100, 2400, 2350];
  // Gentle downward weight trend (kg), one decimal.
  const weightByDay = [70.9, 70.8, 70.6, 70.7, 70.4, 70.2, 70.3];

  return {
    steps: buildSeries("com.google.step_count.delta", (i) => [{ intVal: stepsByDay[i] }]),
    calories: buildSeries("com.google.calories.expended", (i) => [{ fpVal: caloriesByDay[i] }]),
    nutrition: buildSeries("com.google.nutrition", (i) => nutritionValue(caloriesInByDay[i])),
    weight: buildSeries("com.google.weight", (i) => [{ fpVal: weightByDay[i] }]),
  };
}

// Expose globally for the non-module scripts that follow.
window.HealthData = { getDemoData };
