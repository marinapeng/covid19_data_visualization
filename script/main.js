import {
  renderKPIs,
  renderVitals,
  renderCascade,
  renderSeverity,
  renderTeam
} from "./renderers.js";

const rendered = new Set(["story", "vitals"]);

const tabRenderers = {
  cascade: renderCascade,
  severity: renderSeverity,
  team: renderTeam
};

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
}

renderKPIs();
renderVitals();

document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab, btn));
});
