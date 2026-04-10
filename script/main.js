import {
  renderKPIs,
  renderVitals,
  renderCascade,
  renderSeverity,
  renderTeam
} from "./renderers.js";

let D = null;

const rendered = new Set(["story"]);

const tabRenderers = {
  vitals: () => renderVitals(D),
  cascade: () => renderCascade(D),
  severity: () => renderSeverity(D),
  team: renderTeam
};

function getActiveTabId() {
  const activePanel = document.querySelector(".panel.active");
  return activePanel?.id?.replace("tab-", "") ?? null;
}

function resizePlotsInTab(id) {
  if (!id) return;

  const panel = document.getElementById(`tab-${id}`);
  if (!panel) return;

  panel.querySelectorAll(".plotly-graph-div").forEach((plot) => {
    Plotly.Plots.resize(plot);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function findSeverityRow(name) {
  return D?.severity_groups?.find((row) => row.SEVERITY === name) ?? null;
}

function getPeakWindowDeaths() {
  const targetBins = new Set(["(7, 10]", "(10, 14]"]);
  return (D?.days_to_death ?? [])
    .filter((row) => targetBins.has(row.bin))
    .reduce((sum, row) => sum + row.count, 0);
}

function populateText() {
  if (!D) return;

  const k = D.kpis;
  const outpatient = findSeverityRow("Mild (Outpatient)");
  const hospitalized = findSeverityRow("Severe (Hospitalized)");

  const outpatientPct = k.total
    ? `${(((outpatient?.total ?? 0) / k.total) * 100).toFixed(0)}%`
    : "0%";

  const hospitalMortality = hospitalized
    ? `${Number(hospitalized.mortality_rate).toFixed(1)}%`
    : "0.0%";

  const peakWindowDeaths = getPeakWindowDeaths().toLocaleString();

  setText("header-total-patients", k.total.toLocaleString());
  setText("story-total-patients", k.total.toLocaleString());
  setText("story-median-days", k.median_days_to_death);
  setText("cascade-deaths", k.died.toLocaleString());
  setText("cascade-survivors", k.survived.toLocaleString());
  setText("median-days", k.median_days_to_death);
  setText("median-days-hyphen", k.median_days_to_death);
  setText("cascade-deaths-2", k.died.toLocaleString());
  setText("peak-window-deaths", peakWindowDeaths);
  setText("severity-outpatient-pct", outpatientPct);
  setText("severity-outpatient-pct-2", outpatientPct);
  setText("severity-hospital-mortality", hospitalMortality);
  setText("severity-hospital-mortality-2", hospitalMortality);
}

function switchTab(id, btn = document.querySelector(`.tab[data-tab="${id}"]`)) {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.remove("active");
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.getElementById(`tab-${id}`).classList.add("active");

  if (btn) {
    btn.classList.add("active");
  }

  if (!rendered.has(id)) {
    rendered.add(id);
    const render = tabRenderers[id];
    if (render) {
      render();
    }
  }

  // Run resize after activation so Plotly measures visible containers.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      resizePlotsInTab(id);
    });
  });
}

async function init() {
  const response = await fetch("./covid_clinical_data.json");
  if (!response.ok) {
    throw new Error(`Failed to load covid_clinical_data.json: ${response.status}`);
  }

  D = await response.json();

  renderKPIs(D);
  populateText();

  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab, btn));
  });

  window.addEventListener("load", () => {
    const activeId = getActiveTabId();
    if (activeId) {
      switchTab(activeId);
    }
  });

  window.addEventListener("resize", () => {
    const activeId = getActiveTabId();
    if (activeId) {
      resizePlotsInTab(activeId);
    }
  });
}

init().catch((error) => {
  console.error(error);
});
