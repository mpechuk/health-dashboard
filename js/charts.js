/*
 * Chart rendering for the Health Dashboard, built on Chart.js v4.
 *
 * Each render function takes a canvas element id and a normalized series:
 *   [ { date: "YYYY-MM-DD", label: "Mon 16", value: 8423 }, ... ]
 */

const PALETTE = {
  steps: "#00b0b9",
  calories: "#f59e0b",
  weight: "#6c5ce7",
  // Calories-consumed status colors.
  good: "#22c55e",
  warn: "#f97316",
  danger: "#ef4444",
  grid: "rgba(255,255,255,0.06)",
  text: "#9aa0ad",
};

/**
 * Parse a Fitbit time-series object into a normalized array.
 * @param {object} fitbitObj  e.g. { "activities-steps": [ { dateTime, value }, ... ] }
 * @param {string} key        the response key to read (e.g. "activities-steps")
 * @returns {{date:string,label:string,value:number}[]}
 */
function parseSeries(fitbitObj, key) {
  const rows = fitbitObj[key] || [];
  return rows.map((row) => ({
    date: row.dateTime,
    label: shortDayLabel(row.dateTime),
    value: Number(row.value),
  }));
}

/** "2026-06-16" -> "Mon 16" */
function shortDayLabel(isoDate) {
  // Parse as local date (avoid TZ shift from `new Date("YYYY-MM-DD")` UTC parsing).
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday} ${d}`;
}

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1f2330",
      borderColor: "#2a2f3d",
      borderWidth: 1,
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { color: PALETTE.grid, drawBorder: false },
      ticks: { color: PALETTE.text },
    },
    y: {
      grid: { color: PALETTE.grid, drawBorder: false },
      ticks: { color: PALETTE.text },
    },
  },
};

function barChart(canvasId, series, color, label) {
  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels: series.map((p) => p.label),
      datasets: [
        {
          label,
          data: series.map((p) => p.value),
          backgroundColor: color,
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      ...BASE_OPTIONS,
      scales: {
        ...BASE_OPTIONS.scales,
        y: {
          ...BASE_OPTIONS.scales.y,
          beginAtZero: true,
        },
      },
    },
  });
}

function renderSteps(canvasId, series) {
  return barChart(canvasId, series, PALETTE.steps, "Steps");
}

/**
 * Decide the color for a day's "consumed" bar.
 *
 * When the latest weight is above the goal weight, days where the
 * calorie balance (consumed + deficit) overshoots what was burned are
 * flagged: orange past the burn line, red once it overshoots by 200+.
 * Otherwise (at/below goal, or comfortably under burn) the bar is green.
 */
function consumedColor(consumed, burned, deficit, aboveGoal) {
  const balance = consumed + deficit;
  if (aboveGoal && balance > burned + 200) return PALETTE.danger;
  if (aboveGoal && balance > burned) return PALETTE.warn;
  return PALETTE.good;
}

/**
 * Calories chart: burned (bars) alongside consumed (bars colored by status).
 * @param {string} canvasId
 * @param {{label:string,value:number}[]} burned    calories burned per day
 * @param {{label:string,value:number}[]} consumed  calories consumed per day
 * @param {{goalWeight:number,deficit:number,latestWeight:number}} opts
 */
function renderCalories(canvasId, burned, consumed, opts) {
  const { goalWeight, deficit, latestWeight } = opts;
  const aboveGoal = latestWeight > goalWeight;

  const consumedColors = consumed.map((p, i) =>
    consumedColor(p.value, burned[i] ? burned[i].value : 0, deficit, aboveGoal)
  );

  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels: burned.map((p) => p.label),
      datasets: [
        {
          label: "Burned",
          data: burned.map((p) => p.value),
          backgroundColor: PALETTE.calories,
          borderRadius: 6,
          maxBarThickness: 48,
        },
        {
          label: "Consumed",
          data: consumed.map((p) => p.value),
          backgroundColor: consumedColors,
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        legend: { display: true, labels: { color: PALETTE.text } },
      },
      scales: {
        ...BASE_OPTIONS.scales,
        y: {
          ...BASE_OPTIONS.scales.y,
          beginAtZero: true,
        },
      },
    },
  });
}

function renderWeight(canvasId, series) {
  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels: series.map((p) => p.label),
      datasets: [
        {
          label: "Weight",
          data: series.map((p) => p.value),
          borderColor: PALETTE.weight,
          backgroundColor: "rgba(108,92,231,0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: PALETTE.weight,
          borderWidth: 2,
        },
      ],
    },
    options: {
      ...BASE_OPTIONS,
      scales: {
        ...BASE_OPTIONS.scales,
        y: {
          ...BASE_OPTIONS.scales.y,
          // No zero baseline so the trend is readable.
          beginAtZero: false,
        },
      },
    },
  });
}

window.HealthCharts = { parseSeries, renderSteps, renderCalories, renderWeight };
