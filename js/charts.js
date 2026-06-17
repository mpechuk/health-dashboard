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
  goal: "#e2e8f0",
  grid: "rgba(255,255,255,0.06)",
  text: "#9aa0ad",
};

/**
 * Build a flat dashed "goal" line dataset spanning every label.
 * Mixed into bar/line charts to show a target value.
 */
function goalLineDataset(label, value, count) {
  return {
    type: "line",
    label,
    data: new Array(count).fill(value),
    borderColor: PALETTE.goal,
    borderDash: [6, 4],
    borderWidth: 2,
    pointRadius: 0,
    pointHitRadius: 0,
    fill: false,
    tension: 0,
  };
}

/**
 * Read the scalar from a Google Health dataPoint value array.
 * Falls back across the typed fields (intVal, then fpVal).
 */
function scalarValue(value) {
  const field = (value || [])[0] || {};
  return Number(field.intVal ?? field.fpVal ?? 0);
}

/**
 * Read calories consumed from a com.google.nutrition dataPoint value array:
 * the first map field holds nutrients; the "calories" key holds the energy.
 */
function caloriesConsumed(value) {
  const nutrients = (value || []).find((f) => f.mapVal)?.mapVal || [];
  const cal = nutrients.find((n) => n.key === "calories");
  return Number(cal?.value?.fpVal ?? cal?.value?.intVal ?? 0);
}

/**
 * Parse a Google Health series into a normalized array.
 * @param {{dataPoints:object[]}} series  e.g. { dataTypeName, dataPoints: [...] }
 * @param {(value:object[])=>number} [extract]  value reader (defaults to scalarValue)
 * @returns {{date:string,label:string,value:number}[]}
 */
function parseSeries(series, extract) {
  const points = (series && series.dataPoints) || [];
  const read = extract || scalarValue;
  return points.map((p) => {
    const date = p.startTime.slice(0, 10); // "YYYY-MM-DDT..." -> "YYYY-MM-DD"
    return { date, label: shortDayLabel(date), value: read(p.value) };
  });
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
 * @param {{goalWeight:number,deficit:number,latestWeight:number,caloriesGoal:number}} opts
 */
function renderCalories(canvasId, burned, consumed, opts) {
  const { goalWeight, deficit, latestWeight, caloriesGoal } = opts;
  const aboveGoal = latestWeight > goalWeight;

  const consumedColors = consumed.map((p, i) =>
    consumedColor(p.value, burned[i] ? burned[i].value : 0, deficit, aboveGoal)
  );

  const datasets = [
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
  ];

  if (Number.isFinite(caloriesGoal)) {
    datasets.push(goalLineDataset("Calories goal", caloriesGoal, burned.length));
  }

  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels: burned.map((p) => p.label),
      datasets,
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

/**
 * Weight chart: measured weight (line) with an optional goal weight line.
 * @param {string} canvasId
 * @param {{label:string,value:number}[]} series
 * @param {{goalWeight:number}} [opts]
 */
function renderWeight(canvasId, series, opts) {
  const goalWeight = opts && opts.goalWeight;

  const datasets = [
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
  ];

  if (Number.isFinite(goalWeight)) {
    datasets.push(goalLineDataset("Goal weight", goalWeight, series.length));
  }

  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels: series.map((p) => p.label),
      datasets,
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
          // No zero baseline so the trend is readable.
          beginAtZero: false,
        },
      },
    },
  });
}

window.HealthCharts = {
  parseSeries,
  caloriesConsumed,
  renderSteps,
  renderCalories,
  renderWeight,
};
