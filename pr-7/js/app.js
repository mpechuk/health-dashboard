/*
 * App bootstrap: load data, render charts, fill summary cards.
 */

function formatNumber(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function fillSummaries(steps, calories, weight) {
  // Steps — weekly total + daily average.
  const totalSteps = sum(steps.map((p) => p.value));
  const avgSteps = Math.round(totalSteps / steps.length);
  document.getElementById("summary-steps").textContent = formatNumber(totalSteps);
  document.getElementById("summary-steps-sub").textContent =
    `${formatNumber(avgSteps)} / day avg`;

  // Calories — daily average (headline) + weekly total.
  const totalCalories = sum(calories.map((p) => p.value));
  const avgCalories = Math.round(totalCalories / calories.length);
  document.getElementById("summary-calories").textContent = formatNumber(avgCalories);
  document.getElementById("summary-calories-sub").textContent =
    `${formatNumber(totalCalories)} total this week`;

  // Weight — latest value + delta vs. start of week.
  const latest = weight[weight.length - 1].value;
  const start = weight[0].value;
  const delta = latest - start;
  const deltaAbs = Math.abs(delta).toFixed(1);
  document.getElementById("summary-weight").textContent = `${latest.toFixed(1)} kg`;

  const sub = document.getElementById("summary-weight-sub");
  if (delta === 0) {
    sub.textContent = "no change this week";
  } else {
    const dir = delta < 0 ? "down" : "up";
    const cls = delta < 0 ? "delta-down" : "delta-up";
    const arrow = delta < 0 ? "▼" : "▲";
    sub.innerHTML = `<span class="${cls}">${arrow} ${deltaAbs} kg ${dir}</span> this week`;
  }
}

function init() {
  const { getDemoData } = window.HealthData;
  const { parseSeries, caloriesConsumed, renderSteps, renderCalories, renderWeight } =
    window.HealthCharts;

  const data = getDemoData();
  const steps = parseSeries(data.steps);
  const calories = parseSeries(data.calories);
  const caloriesIn = parseSeries(data.nutrition, caloriesConsumed);
  const weight = parseSeries(data.weight);

  fillSummaries(steps, calories, weight);

  renderSteps("chart-steps", steps);

  const goalInput = document.getElementById("goal-weight");
  const deficitInput = document.getElementById("calorie-deficit");
  const deficitNInput = document.getElementById("calorie-deficit-n");

  // Re-render the calories chart whenever the goal weight or a deficit changes.
  let caloriesChart;
  function drawCalories() {
    const goalWeight = Number(goalInput.value);
    const deficit = Number(deficitInput.value);
    const deficitN = Number(deficitNInput.value);
    if (caloriesChart) caloriesChart.destroy();
    caloriesChart = renderCalories("chart-calories", calories, caloriesIn, {
      goalWeight,
      deficit,
      deficitN,
      weight,
    });
  }

  // Re-render the weight chart whenever the goal weight changes.
  let weightChart;
  function drawWeight() {
    const goalWeight = Number(goalInput.value);
    if (weightChart) weightChart.destroy();
    weightChart = renderWeight("chart-weight", weight, { goalWeight });
  }

  goalInput.addEventListener("input", () => {
    drawCalories();
    drawWeight();
  });
  deficitInput.addEventListener("input", drawCalories);
  deficitNInput.addEventListener("input", drawCalories);
  drawCalories();
  drawWeight();
}

document.addEventListener("DOMContentLoaded", init);
