export const CFG = {
  displayModeBar: false,
  responsive: true
};

export function buildLayout(overrides = {}) {
  return Object.assign(
    {
      paper_bgcolor: "transparent",
      plot_bgcolor: "#191d28",
      font: {
        family: "DM Sans",
        color: "#7a8196",
        size: 12
      },
      margin: {
        t: 12,
        b: 44,
        l: 52,
        r: 18
      },
      xaxis: {
        gridcolor: "#252a38",
        zerolinecolor: "#252a38",
        tickfont: { size: 11 }
      },
      yaxis: {
        gridcolor: "#252a38",
        zerolinecolor: "#252a38",
        tickfont: { size: 11 }
      },
      hoverlabel: {
        bgcolor: "#191d28",
        bordercolor: "#252a38",
        font: {
          family: "DM Sans",
          color: "#eaebef",
          size: 12
        }
      },
      showlegend: false
    },
    overrides
  );
}
