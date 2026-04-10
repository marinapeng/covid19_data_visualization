import { CFG, buildLayout } from "./config.js";

export function renderKPIs(D) {
  const k = D.kpis;

  const items = [
    {
      label: "COVID Patients",
      value: k.total.toLocaleString(),
      sub: "Massachusetts 2020"
    },
    {
      label: "Fatality Rate",
      value: `${k.cfr}%`,
      sub: "Case fatality rate"
    },
    {
      label: "Deaths",
      value: k.died.toLocaleString(),
      sub: `vs ${k.survived.toLocaleString()} survived`
    },
    {
      label: "Median Days to Death",
      value: k.median_days_to_death,
      sub: "From diagnosis"
    }
  ];

  document.getElementById("kpi-strip").innerHTML = items
    .map(
      (item) => `
        <div class="kpi">
          <div class="kpi-label">${item.label}</div>
          <div class="kpi-value">${item.value}</div>
          <div class="kpi-sub">${item.sub}</div>
        </div>
      `
    )
    .join("");
}

export function renderTeam() {
  const members = [
    {
      name: "Arnold Jiang",
      role: "",
      detail:
        "Worked on the visual design and HTML implementation of the dashboard. Contributed to the layout, styling, and overall presentation of the project, and helped integrate the charts and written explanations into a clear final product. Also worked on chart formatting, labeling, annotation, and visual consistency across sections, while reviewing the dashboard for readability and accuracy."
    },
    {
      name: "Marina Peng",
      role: "",
      detail:
        "Led the analytical framing and written narrative of the project. Contributed to identifying the most important patterns in the data, deciding which comparisons to emphasize, and writing and revising the explanatory text across the dashboard. Contributed and built the Python data preparation process, attended office hours for feedback on the project’s direction, and helped connect the data analysis to the overall story being presented."
    }
  ];

  document.getElementById("team-members").innerHTML = members
    .map(
      (member) => `
        <div class="team-member">
          <div class="team-member-body">
            <div class="team-member-name">${member.name}</div>
            <div class="team-member-role">${member.role}</div>
            <p class="team-member-detail">${member.detail}</p>
          </div>
        </div>
      `
    )
    .join("");
}

export function renderVitals(D) {
  const vitalConfigs = [
    {
      key: "temperature",
      el: "v-temp",
      unit: "°C",
      yr: [36, 42],
      cs: "#26c0d3",
      cd: "#e0694a"
    },
    {
      key: "heart_rate",
      el: "v-hr",
      unit: "bpm",
      yr: [55, 165],
      cs: "#26c0d3",
      cd: "#e0694a"
    },
    {
      key: "resp_rate",
      el: "v-rr",
      unit: "br/min",
      yr: [12, 36],
      cs: "#26c0d3",
      cd: "#e0694a"
    },
    {
      key: "lymphocytes",
      el: "v-lymph",
      unit: "x10³/µL",
      yr: [0, 1.6],
      cs: "#26c0d3",
      cd: "#e0694a"
    }
  ];

  vitalConfigs.forEach((config) => {
    const rows = D.vitals[config.key];
    const days = rows.map((row) => row.day);
    const survived = rows.map((row) => row.survived);
    const died = rows.map((row) => row.died);

    Plotly.newPlot(
      config.el,
      [
        {
          x: days,
          y: survived,
          name: "Survived",
          mode: "lines+markers",
          line: {
            color: config.cs,
            width: 2.5,
            shape: "spline"
          },
          marker: {
            size: 4,
            color: config.cs
          },
          hovertemplate: `Day %{x}<br>Survived: %{y:.2f} ${config.unit}<extra></extra>`
        },
        {
          x: days,
          y: died,
          name: "Did Not Survive",
          mode: "lines+markers",
          line: {
            color: config.cd,
            width: 2.5,
            dash: "dot",
            shape: "spline"
          },
          marker: {
            size: 4,
            color: config.cd
          },
          hovertemplate: `Day %{x}<br>Non-survivor: %{y:.2f} ${config.unit}<extra></extra>`
        }
      ],
      buildLayout({
        yaxis: {
          gridcolor: "#252a38",
          zerolinecolor: "#252a38",
          tickfont: { size: 11 },
          range: config.yr,
          title: {
            text: config.unit,
            font: { size: 11 }
          }
        },
        xaxis: {
          gridcolor: "#252a38",
          zerolinecolor: "#252a38",
          tickfont: { size: 11 },
          title: {
            text: "Days since diagnosis",
            font: { size: 11 }
          },
          dtick: 5
        },
        margin: {
          t: 10,
          b: 48,
          l: 60,
          r: 12
        },
        shapes: [
          {
            type: "line",
            x0: 12,
            x1: 12,
            y0: 0,
            y1: 1,
            yref: "paper",
            line: {
              color: "rgba(242,185,49,0.3)",
              width: 1.5,
              dash: "dash"
            }
          }
        ],
        annotations: [
          {
            x: 12.3,
            y: 0.96,
            yref: "paper",
            text: "Median<br>death day",
            font: {
              size: 10,
              color: "#f2b931"
            },
            showarrow: false,
            align: "left"
          }
        ]
      }),
      CFG
    );
  });
}

export function renderCascade(D) {
  const totalDied = D.kpis.died;
  const totalSurvived = D.kpis.survived;

  const rows = [...D.cascade]
    .filter((item) => item.label !== "COVID-19 Diagnosis")
    .sort((a, b) => a.pct_of_died - b.pct_of_died);

  Plotly.newPlot(
    "chart-fatal",
    [
      {
        type: "bar",
        orientation: "h",
        x: rows.map((item) => item.pct_of_died),
        y: rows.map((item) => item.label),
        marker: { color: "#e0694a" },
        text: rows.map((item) => `${item.pct_of_died.toFixed(0)}%`),
        textposition: "outside",
        textfont: { size: 11, color: "#eaebef" },
        hovertemplate: `<b>%{y}</b><br>%{x:.1f}% of fatal cases (n=%{customdata} of ${totalDied})<extra></extra>`,
        customdata: rows.map((item) => item.n_died)
      }
    ],
    buildLayout({
      xaxis: {
        title: { text: "% of fatal cases", font: { size: 11 } },
        ticksuffix: "%",
        range: [0, 120]
      },
      yaxis: {
        tickfont: { size: 11 },
        automargin: true
      },
      margin: {
        t: 12,
        b: 48,
        l: 200,
        r: 64
      }
    }),
    CFG
  );

  Plotly.newPlot(
    "chart-surv",
    [
      {
        type: "bar",
        orientation: "h",
        x: rows.map((item) => item.pct_of_survived),
        y: rows.map((item) => item.label),
        marker: { color: "#26c0d3" },
        text: rows.map((item) => `${item.pct_of_survived.toFixed(0)}%`),
        textposition: "outside",
        textfont: { size: 11, color: "#eaebef" },
        hovertemplate: `<b>%{y}</b><br>%{x:.1f}% of survivors (n=%{customdata} of ${totalSurvived})<extra></extra>`,
        customdata: rows.map((item) => item.n_survived)
      }
    ],
    buildLayout({
      xaxis: {
        title: { text: "% of survivors", font: { size: 11 } },
        ticksuffix: "%",
        range: [0, 120]
      },
      yaxis: {
        tickfont: { size: 11 },
        automargin: true
      },
      margin: {
        t: 12,
        b: 48,
        l: 200,
        r: 64
      }
    }),
    CFG
  );

  const weekly = D.weekly;

  Plotly.newPlot(
    "chart-wave",
    [
      {
        type: "bar",
        name: "New Cases",
        x: weekly.map((item) => item.week),
        y: weekly.map((item) => item.cases),
        marker: { color: "rgba(38,192,211,0.50)" },
        hovertemplate: "Week %{x}<br>Cases: %{y:,}<extra></extra>",
        yaxis: "y"
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "Deaths",
        x: weekly.map((item) => item.week),
        y: weekly.map((item) => item.deaths),
        line: {
          color: "#e0694a",
          width: 2.5,
          shape: "spline"
        },
        marker: {
          size: 5,
          color: "#e0694a"
        },
        hovertemplate: "Week %{x}<br>Deaths: %{y}<extra></extra>",
        yaxis: "y2"
      }
    ],
    buildLayout({
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0.5,
        xanchor: "center",
        y: -0.22,
        font: { size: 11, color: "#7a8196" },
        bgcolor: "transparent"
      },
      yaxis: {
        title: { text: "Weekly new cases", font: { size: 11 } },
        gridcolor: "#252a38"
      },
      yaxis2: {
        title: { text: "Weekly deaths", font: { size: 11, color: "#e0694a" } },
        overlaying: "y",
        side: "right",
        gridcolor: "transparent",
        tickfont: { color: "#e0694a", size: 11 }
      },
      xaxis: {
        tickangle: -30,
        tickfont: { size: 10 }
      },
      margin: {
        t: 14,
        b: 80,
        l: 68,
        r: 72
      }
    }),
    CFG
  );

  Plotly.newPlot(
    "chart-dtd",
    [
      {
        type: "bar",
        x: D.days_to_death.map((item) => item.bin),
        y: D.days_to_death.map((item) => item.count),
        marker: { color: "#e0694a", opacity: 0.85 },
        text: D.days_to_death.map((item) => item.count),
        textposition: "outside",
        textfont: { size: 11, color: "#eaebef" },
        hovertemplate: "<b>%{x}</b><br>Deaths: %{y}<extra></extra>"
      }
    ],
    buildLayout({
      xaxis: {
        title: { text: "Days from diagnosis to death", font: { size: 11 } },
        tickangle: -20
      },
      yaxis: {
        title: { text: "Deaths", font: { size: 11 } },
        range: [0, 220]
      },
      margin: {
        t: 14,
        b: 72,
        l: 56,
        r: 18
      }
    }),
    CFG
  );
}

export function renderSeverity(D) {
  const severityGroups = D.severity_groups.filter(
    (item) => !item.SEVERITY.toLowerCase().includes("moderate")
  );

  Plotly.newPlot(
    "chart-sev-vol",
    [
      {
        type: "bar",
        x: severityGroups.map((item) => item.SEVERITY),
        y: severityGroups.map((item) => item.total),
        marker: { color: "#26c0d3" },
        text: severityGroups.map((item) => item.total.toLocaleString()),
        textposition: "outside",
        cliponaxis: false,
        textfont: { size: 12, color: "#eaebef" },
        hovertemplate: "<b>%{x}</b><br>%{y:,} patients<extra></extra>"
      }
    ],
    buildLayout({
      yaxis: {
        title: { text: "Patients", font: { size: 11 } },
        autorange: true,
        rangemode: "tozero"
      },
      xaxis: {
        tickangle: -12,
        tickfont: { size: 11 }
      },
      margin: {
        t: 44,
        b: 84,
        l: 60,
        r: 18
      }
    }),
    CFG
  );

  Plotly.newPlot(
    "chart-sev-mort",
    [
      {
        type: "bar",
        x: severityGroups.map((item) => item.SEVERITY),
        y: severityGroups.map((item) => item.mortality_rate),
        marker: { color: "#e0694a" },
        text: severityGroups.map((item) => `${item.mortality_rate}%`),
        textposition: "outside",
        cliponaxis: false,
        textfont: { size: 12, color: "#eaebef" },
        hovertemplate: "<b>%{x}</b><br>Mortality: %{y}%<br>n=%{customdata:,}<extra></extra>",
        customdata: severityGroups.map((item) => item.total)
      }
    ],
    buildLayout({
      yaxis: {
        title: { text: "Mortality rate (%)", font: { size: 11 } },
        ticksuffix: "%",
        autorange: true,
        rangemode: "tozero"
      },
      xaxis: {
        tickangle: -12,
        tickfont: { size: 11 }
      },
      margin: {
        t: 44,
        b: 84,
        l: 60,
        r: 18
      }
    }),
    CFG
  );

  const medMort = (D.medication_mortality ?? []).filter(
  (item) => item.unique_med_count <= 11
);
  const topMeds = [...(D.top_medications_died ?? [])].sort(
    (a, b) => a.patient_count - b.patient_count
  );

  Plotly.newPlot(
    "chart-med-mort",
    [
      {
        type: "bar",
        x: medMort.map((item) => item.unique_med_count),
        y: medMort.map((item) => item.mortality_rate),
        marker: { color: "#e0694a" },
        text: medMort.map((item) => `${item.mortality_rate}%`),
        textposition: "outside",
        cliponaxis: false,
        textfont: { size: 11, color: "#eaebef" },
        hovertemplate:
          "<b>%{x} unique medications</b><br>Mortality: %{y}%<br>n=%{customdata:,} patients<extra></extra>",
        customdata: medMort.map((item) => item.total_patients)
      }
    ],
    buildLayout({
      yaxis: {
        title: { text: "Mortality rate (%)", font: { size: 11 } },
        ticksuffix: "%",
        autorange: true,
        rangemode: "tozero"
      },
      xaxis: {
        title: { text: "Number of unique medications", font: { size: 11 } },
        tickfont: { size: 11 },
        dtick: 1
      },
      margin: {
        t: 20,
        b: 60,
        l: 60,
        r: 20
      }
    }),
    CFG
  );

  Plotly.newPlot(
    "chart-top-meds",
    [
      {
        type: "bar",
        orientation: "h",
        x: topMeds.map((item) => item.patient_count),
        y: topMeds.map((item) => item.DESCRIPTION),
        marker: { color: "#26c0d3" },
        text: topMeds.map((item) => `${item.patient_count}`),
        textposition: "outside",
        cliponaxis: false,
        textfont: { size: 11, color: "#eaebef" },
        hovertemplate:
          "<b>%{y}</b><br>%{x} deceased patients<br>%{customdata}% of deaths<extra></extra>",
        customdata: topMeds.map((item) => item.pct_of_deaths)
      }
    ],
    buildLayout({
      xaxis: {
        title: { text: "Deceased patients receiving medication", font: { size: 11 } },
        tickfont: { size: 11 },
        rangemode: "tozero"
      },
      yaxis: {
        tickfont: { size: 11 },
        automargin: true
      },
      margin: {
        t: 20,
        b: 48,
        l: 260,
        r: 40
      }
    }),
    CFG
  );
}