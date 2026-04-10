# -*- coding: utf-8 -*-
"""Build dashboard-ready COVID clinical summary JSON from local Synthea CSV files.

Project structure expected:
covid19_data_visualization/
├─ 10k_synthea_covid19_csv/
│  ├─ patients.csv
│  ├─ conditions.csv
│  ├─ observations.csv
│  ├─ encounters.csv
│  ├─ medications.csv
│  └─ ...
├─ script/
├─ Synthea COVID-19 Analysis.html
├─ covid_clinical_data.json
└─ build_dashboard_data.py
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "10k_synthea_covid19_csv"
OUTPUT_PATH = BASE_DIR / "covid_clinical_data.json"

COVID_CODE = 840539006
REFERENCE_DATE = pd.Timestamp("2020-04-30", tz="UTC")


# ── Helpers ────────────────────────────────────────────────────────────────
def to_datetime_utc(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", utc=True)


def age_group(age: int) -> str:
    if age < 18:
        return "0–17"
    if age < 30:
        return "18–29"
    if age < 45:
        return "30–44"
    if age < 60:
        return "45–59"
    if age < 75:
        return "60–74"
    return "75+"


def pct(part: int, whole: int) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


def encounter_is_covid_related(encounters_df: pd.DataFrame) -> pd.Series:
    reason_code = pd.to_numeric(encounters_df.get("REASONCODE"), errors="coerce")
    reason_desc = encounters_df.get(
        "REASONDESCRIPTION", pd.Series("", index=encounters_df.index)
    ).fillna("")
    description = encounters_df.get(
        "DESCRIPTION", pd.Series("", index=encounters_df.index)
    ).fillna("")

    return (
        reason_code.eq(COVID_CODE)
        | reason_desc.str.contains("COVID", case=False, na=False)
        | description.str.contains("COVID", case=False, na=False)
    )


def classify_severity(classes: set[str]) -> str:
    normalized = {str(x).strip().lower() for x in classes if pd.notna(x)}
    if "inpatient" in normalized:
        return "Severe (Hospitalized)"
    if "emergency" in normalized:
        return "Moderate (ER)"
    if "urgentcare" in normalized:
        return "Moderate (Urgent Care)"
    return "Mild (Outpatient)"


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {path}")


def load_csv(name: str) -> pd.DataFrame:
    path = DATA_DIR / name
    require_file(path)
    return pd.read_csv(path, low_memory=False)


# ── Main build ─────────────────────────────────────────────────────────────
def main() -> None:
    print("Loading CSVs...")

    patients = load_csv("patients.csv")
    conditions = load_csv("conditions.csv")
    observations = load_csv("observations.csv")
    encounters = load_csv("encounters.csv")
    medications = load_csv("medications.csv")

    # Parse dates
    conditions["START"] = to_datetime_utc(conditions["START"])
    patients["DEATHDATE"] = to_datetime_utc(patients["DEATHDATE"])
    patients["BIRTHDATE"] = to_datetime_utc(patients["BIRTHDATE"])
    observations["DATE"] = to_datetime_utc(observations["DATE"])
    encounters["START"] = to_datetime_utc(encounters["START"])
    encounters["STOP"] = (
        to_datetime_utc(encounters["STOP"]) if "STOP" in encounters.columns else pd.NaT
    )
    medications["START"] = to_datetime_utc(medications["START"])
    medications["STOP"] = (
        to_datetime_utc(medications["STOP"]) if "STOP" in medications.columns else pd.NaT
    )

    # ── 1. Confirmed COVID cohort ──────────────────────────────────────────
    covid_cond = conditions[
        pd.to_numeric(conditions["CODE"], errors="coerce").eq(COVID_CODE)
    ].copy()

    diag = (
        covid_cond.groupby("PATIENT", as_index=False)["START"]
        .min()
        .rename(columns={"PATIENT": "Id", "START": "COVID_START"})
    )

    covid_ids = set(diag["Id"])
    print(f"Confirmed COVID patients: {len(covid_ids)}")

    covid_patients = patients[patients["Id"].isin(covid_ids)].copy()
    covid_patients = covid_patients.merge(diag, on="Id", how="left")

    age_calculated = (REFERENCE_DATE - covid_patients["BIRTHDATE"]).dt.days / 365.25
    covid_patients["AGE"] = (
        pd.to_numeric(age_calculated, errors="coerce").round().astype("Int64")
    )
    covid_patients["DIED"] = covid_patients["DEATHDATE"].notna().astype(int)

    total = len(covid_patients)
    died_count = int(covid_patients["DIED"].sum())
    surv_count = total - died_count

    print(
        f"Deaths: {died_count}, Survived: {surv_count}, "
        f"CFR: {died_count / total * 100:.1f}%"
    )

    out: dict[str, object] = {}

    died_id_set = set(covid_patients.loc[covid_patients["DIED"] == 1, "Id"])
    surv_id_set = set(covid_patients.loc[covid_patients["DIED"] == 0, "Id"])

    died_pts = covid_patients[covid_patients["DIED"] == 1].copy()
    died_pts["DAYS_TO_DEATH"] = (
        died_pts["DEATHDATE"] - died_pts["COVID_START"]
    ).dt.days
    died_pts = died_pts[died_pts["DAYS_TO_DEATH"] >= 0].copy()

    # ── 2. KPI cards ───────────────────────────────────────────────────────
    all_cond = conditions[conditions["PATIENT"].isin(covid_ids)].copy()
    all_cond = all_cond.merge(
        covid_patients[["Id", "COVID_START", "DIED"]],
        left_on="PATIENT",
        right_on="Id",
        how="left",
    )
    all_cond["DAY_REL"] = (all_cond["START"] - all_cond["COVID_START"]).dt.days
    post_diag = all_cond[all_cond["DAY_REL"] >= 0].copy()

    def pct_of_fatal(description: str) -> float:
        pts_with_cond = set(
            post_diag.loc[post_diag["DESCRIPTION"] == description, "PATIENT"].unique()
        )
        died_with_cond = len(pts_with_cond & died_id_set)
        return pct(died_with_cond, died_count)

    out["kpis"] = {
        "total": total,
        "died": died_count,
        "survived": surv_count,
        "cfr": round(died_count / total * 100, 1),
        "median_days_to_death": (
            int(died_pts["DAYS_TO_DEATH"].median()) if not died_pts.empty else None
        ),
        "pct_pneumonia_fatal": pct_of_fatal("Pneumonia (disorder)"),
        "pct_ards_fatal": pct_of_fatal("Acute respiratory distress syndrome (disorder)"),
    }

    # ── 3. Vital sign trajectories (day 0–21) ─────────────────────────────
    obs_covid = observations[observations["PATIENT"].isin(covid_ids)].copy()
    obs_covid["VALUE"] = pd.to_numeric(obs_covid["VALUE"], errors="coerce")
    obs_covid = obs_covid.merge(
        covid_patients[["Id", "COVID_START", "DIED"]],
        left_on="PATIENT",
        right_on="Id",
        how="left",
    )
    obs_covid["DAY_REL"] = (obs_covid["DATE"] - obs_covid["COVID_START"]).dt.days
    acute_obs = obs_covid[
        (obs_covid["DAY_REL"] >= 0) & (obs_covid["DAY_REL"] <= 21)
    ].copy()

    vitals_config = {
        "temperature": "Body temperature",
        "heart_rate": "Heart rate",
        "resp_rate": "Respiratory rate",
        "lymphocytes": "Lymphocytes [#/volume] in Blood by Automated count",
    }

    out["vitals"] = {}
    for key, desc in vitals_config.items():
        sub = acute_obs[acute_obs["DESCRIPTION"] == desc].dropna(subset=["VALUE"])
        traj = sub.groupby(["DIED", "DAY_REL"])["VALUE"].mean().unstack(level=0)

        if 0 not in traj.columns or 1 not in traj.columns:
            continue

        traj.columns = ["survived", "died"]
        records = []

        for day in range(22):
            row = (
                traj.loc[day]
                if day in traj.index
                else pd.Series({"survived": np.nan, "died": np.nan})
            )
            records.append(
                {
                    "day": day,
                    "survived": round(float(row["survived"]), 2)
                    if pd.notna(row["survived"])
                    else None,
                    "died": round(float(row["died"]), 2)
                    if pd.notna(row["died"])
                    else None,
                }
            )

        out["vitals"][key] = records

    # ── 4. Complication cascade ────────────────────────────────────────────
    complications = [
        ("COVID-19 Diagnosis", "COVID-19"),
        ("Fever", "Fever (finding)"),
        ("Cough", "Cough (finding)"),
        ("Pneumonia", "Pneumonia (disorder)"),
        ("Hypoxemia", "Hypoxemia (disorder)"),
        ("Respiratory Distress", "Respiratory distress (finding)"),
        ("Acute Respiratory Failure", "Acute respiratory failure (disorder)"),
        ("Sepsis", "Sepsis caused by virus (disorder)"),
        ("Pulmonary Embolism", "Acute pulmonary embolism (disorder)"),
        ("ARDS", "Acute respiratory distress syndrome (disorder)"),
        ("Septic Shock", "Septic shock (disorder)"),
        ("Heart Failure / Cardiac Injury", "Heart failure (disorder)"),
    ]

    cascade = []
    for label, desc in complications:
        pts_with = set(post_diag.loc[post_diag["DESCRIPTION"] == desc, "PATIENT"].unique())
        died_with = len(pts_with & died_id_set)
        surv_with = len(pts_with & surv_id_set)

        pts_cond = post_diag[post_diag["DESCRIPTION"] == desc]
        median_d = pts_cond.loc[pts_cond["DIED"] == 1, "DAY_REL"].median() if died_with else None
        median_s = pts_cond.loc[pts_cond["DIED"] == 0, "DAY_REL"].median() if surv_with else None

        cascade.append(
            {
                "label": label,
                "pct_of_died": pct(died_with, died_count),
                "pct_of_survived": pct(surv_with, surv_count),
                "n_died": died_with,
                "n_survived": surv_with,
                "median_day_died": round(float(median_d), 1) if pd.notna(median_d) else None,
                "median_day_surv": round(float(median_s), 1) if pd.notna(median_s) else None,
            }
        )

    out["cascade"] = cascade

    # ── 5. Disease severity groups ─────────────────────────────────────────
    enc_covid = encounters[encounters["PATIENT"].isin(covid_ids)].copy()
    enc_covid = enc_covid.merge(
        covid_patients[["Id", "COVID_START", "DIED", "AGE"]],
        left_on='PATIENT',
        right_on='Id',
        how='left',
    )

    enc_covid = enc_covid[enc_covid["START"] >= enc_covid["COVID_START"]].copy()
    enc_covid["COVID_RELATED"] = encounter_is_covid_related(enc_covid)

    covid_related_enc = enc_covid[enc_covid["COVID_RELATED"]].copy()
    severity_source = covid_related_enc.copy() if not covid_related_enc.empty else enc_covid.copy()

    patient_severity = (
        severity_source.groupby("PATIENT")["ENCOUNTERCLASS"]
        .apply(lambda s: classify_severity(set(s.dropna().astype(str))))
        .reset_index()
        .rename(columns={"PATIENT": "Id", "ENCOUNTERCLASS": "SEVERITY"})
    )

    covid_patients = covid_patients.merge(patient_severity, on="Id", how="left")
    covid_patients["SEVERITY"] = covid_patients["SEVERITY"].fillna("Mild (Outpatient)")

    severity_order = [
        "Mild (Outpatient)",
        "Moderate (ER)",
        "Moderate (Urgent Care)",
        "Severe (Hospitalized)",
    ]

    sev_stats = (
        covid_patients.groupby("SEVERITY")
        .agg(total=("Id", "count"), deaths=("DIED", "sum"), avg_age=("AGE", "mean"))
        .reindex(severity_order, fill_value=0)
        .reset_index()
    )
    sev_stats["avg_age"] = sev_stats["avg_age"].replace(0, np.nan).round(1)
    sev_stats["mortality_rate"] = (
        sev_stats["deaths"] / sev_stats["total"] * 100
    ).fillna(0).round(1)

    out["severity_groups"] = sev_stats.to_dict(orient="records")

    assert int(sev_stats["total"].sum()) == total, "Severity totals do not sum to cohort total."
    assert int(sev_stats["deaths"].sum()) == died_count, "Severity deaths do not sum to total deaths."

    # ── 6. Days to death distribution ──────────────────────────────────────
    dtd_bins = pd.cut(
        died_pts["DAYS_TO_DEATH"],
        bins=[0, 3, 7, 10, 14, 21, 30, 100],
    ).value_counts().sort_index()

    out["days_to_death"] = [
        {"bin": str(interval), "count": int(count)}
        for interval, count in dtd_bins.items()
    ]

    # ── 7. Age-group mortality ─────────────────────────────────────────────
    covid_patients["AGE_GROUP"] = covid_patients["AGE"].astype(int).apply(age_group)
    age_order = ["0–17", "18–29", "30–44", "45–59", "60–74", "75+"]

    age_mort = (
        covid_patients.groupby("AGE_GROUP")
        .agg(total=("Id", "count"), deaths=("DIED", "sum"))
        .reindex(age_order, fill_value=0)
        .reset_index()
    )
    age_mort["mortality_rate"] = (
        age_mort["deaths"] / age_mort["total"] * 100
    ).fillna(0).round(1)

    out["age_mortality"] = age_mort.to_dict(orient="records")

    # ── 8. Weekly epidemic curve + deaths ──────────────────────────────────
    covid_cond2 = covid_cond.copy()
    covid_cond2["WEEK"] = covid_cond2["START"].dt.to_period("W").dt.start_time

    weekly_cases = covid_cond2.groupby("WEEK")["PATIENT"].nunique().reset_index(name="cases")

    death_week = died_pts.copy()
    death_week["WEEK"] = death_week["DEATHDATE"].dt.to_period("W").dt.start_time
    weekly_deaths = death_week.groupby("WEEK")["Id"].nunique().reset_index(name="deaths")

    weekly = weekly_cases.merge(weekly_deaths, on="WEEK", how="left").fillna(0)
    weekly["week"] = weekly["WEEK"].dt.strftime("%Y-%m-%d")
    weekly["cases"] = weekly["cases"].astype(int)
    weekly["deaths"] = weekly["deaths"].astype(int)

    out["weekly"] = weekly[["week", "cases", "deaths"]].to_dict(orient="records")

    # ── 9. Medications ─────────────────────────────────────────────────────
    meds_covid = medications[medications["PATIENT"].isin(covid_ids)].copy()
    meds_covid = meds_covid.merge(
        covid_patients[["Id", "COVID_START", "DIED"]],
        left_on="PATIENT",
        right_on="Id",
        how="left",
    )

    meds_covid["DAY_REL"] = (meds_covid["START"] - meds_covid["COVID_START"]).dt.days
    meds_post = meds_covid[meds_covid["DAY_REL"] >= 0].copy()

    # A. Mortality by number of unique medications prescribed
    med_counts = (
        meds_post.groupby("PATIENT")["CODE"]
        .nunique()
        .reset_index(name="unique_med_count")
    )

    med_counts = covid_patients[["Id", "DIED"]].merge(
        med_counts,
        left_on="Id",
        right_on="PATIENT",
        how="left",
    )
    med_counts["unique_med_count"] = med_counts["unique_med_count"].fillna(0).astype(int)

    med_mort = (
        med_counts.groupby("unique_med_count")
        .agg(total_patients=("Id", "count"), deaths=("DIED", "sum"))
        .reset_index()
    )
    med_mort["mortality_rate"] = (
        med_mort["deaths"] / med_mort["total_patients"] * 100
    ).fillna(0).round(1)

    out["medication_mortality"] = med_mort.to_dict(orient="records")

    # B. Top 10 most common medications among patients who died
    dead_meds = meds_post[meds_post["DIED"] == 1].copy()

    top_dead_meds = (
        dead_meds.groupby(["CODE", "DESCRIPTION"])["PATIENT"]
        .nunique()
        .reset_index(name="patient_count")
        .sort_values("patient_count", ascending=False)
        .head(10)
    )
    top_dead_meds["pct_of_deaths"] = (
        top_dead_meds["patient_count"] / died_count * 100
    ).round(1)

    out["top_medications_died"] = top_dead_meds.to_dict(orient="records")

    # ── Save ───────────────────────────────────────────────────────────────
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), default=str)

    print(f"\n✅ Saved to {OUTPUT_PATH}")
    print("KPIs:", out["kpis"])
    print(
        "Severity totals:",
        sev_stats[["SEVERITY", "total", "deaths", "mortality_rate"]].to_dict(orient="records"),
    )
    print("Top medications among deceased:", out["top_medications_died"][:3])


if __name__ == "__main__":
    main()