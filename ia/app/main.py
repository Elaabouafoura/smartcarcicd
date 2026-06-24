"""
Smart Car AI Service — FastAPI main.py
Integrates:
  • Anomaly detection  (IsolationForest)
  • Risk + Fault classification  (CatBoost per-component)
  • GRU Forecast
  • Recommendation engine  (TF-IDF + ML fusion + Claude API reasoning)
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
import warnings
from datetime import datetime, timezone
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.impute import SimpleImputer

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Car AI Service",
    version="2.0.0",
    description="Anomaly detection, risk/fault classification, GRU forecast, and recommendation engine.",
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ─────────────────────────────────────────────────────────────
# LOAD MODELS
# ─────────────────────────────────────────────────────────────

def _path(filename: str) -> str:
    return os.path.join(BASE_DIR, filename)


try:
    # Anomaly
    iso_model = joblib.load(_path("iso_model.pkl"))
    scaler    = joblib.load(_path("scaler.pkl"))

    # Forecast (GRU)
    scaler_x  = joblib.load(_path("scaler_x.pkl"))
    scaler_d  = joblib.load(_path("scaler_d.pkl"))
    gru_model = tf.keras.models.load_model(_path("best_gru_saved"), compile=False)
    # Risk
    risk_models   = joblib.load(_path("risk_models.pkl"))
    risk_encoders = joblib.load(_path("risk_encoders.pkl"))
    risk_imputers = joblib.load(_path("risk_imputers.pkl"))
    risk_features = joblib.load(_path("risk_features.pkl"))

    # Fault
    fault_models   = joblib.load(_path("fault_models.pkl"))
    fault_encoders = joblib.load(_path("fault_encoders.pkl"))
    fault_imputers = joblib.load(_path("fault_imputers.pkl"))
    fault_features = joblib.load(_path("fault_features.pkl"))

except Exception as exc:
    raise RuntimeError(f"Model loading error: {exc}") from exc


# ─────────────────────────────────────────────────────────────
# RECOMMENDATION DATASET — TF-IDF
# ─────────────────────────────────────────────────────────────

_rec_df: pd.DataFrame
_tfidf: TfidfVectorizer
_tfidf_matrix: object

def _load_rec_dataset():
    global _rec_df, _tfidf, _tfidf_matrix

    rec_df = pd.read_csv(_path("ML_Car_Diagnostic_Agent_AI_Assistant.csv"))
    rec_df.columns = rec_df.columns.str.strip().str.lower().str.replace(" ", "_")
    rec_df = rec_df.dropna(subset=["component", "problem_description"])

    RISK_MAP = {
        "low": 1, "low_risk": 1,
        "medium": 2, "medium_risk": 2,
        "high": 3, "high_risk": 3,
        "critical": 4, "critical_risk": 4,
    }
    rec_df["risk_score_num"] = (
        rec_df["risk_level"].str.lower().str.strip().map(RISK_MAP).fillna(2)
    )
    rec_df["combined_text"] = (
        rec_df["component"].fillna("") + " "
        + rec_df["component"].fillna("") + " "
        + rec_df["problem_description"].fillna("") + " "
        + rec_df["problem_description"].fillna("") + " "
        + rec_df["diagnosis"].fillna("") + " "
        + rec_df["ecu_data"].fillna("") + " "
        + rec_df["service_history"].fillna("") + " "
        + rec_df["how_to_fix_the_problem"].fillna("") + " "
        + rec_df["solution_used"].fillna("")
    )

    tfidf = TfidfVectorizer(ngram_range=(1, 2), max_features=10_000, sublinear_tf=True, min_df=1)
    tfidf_matrix = tfidf.fit_transform(rec_df["combined_text"])

    _rec_df = rec_df
    _tfidf = tfidf
    _tfidf_matrix = tfidf_matrix


_load_rec_dataset()


# ─────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────

SEQ_LEN   = 30
N_TARGETS = 5
HORIZON   = 14

OBD2_FEATURES = [
    "engine_rpm", "vehicle_speed_kmh", "coolant_temp_c",
    "intake_air_temp_c", "maf_airflow_gs", "throttle_position_pct",
    "control_module_voltage_v", "engine_load_pct",
    "short_fuel_trim_pct", "long_fuel_trim_pct",
]

SEMANTIC_RISK_ORDER = {
    "low": 0, "low_risk": 0,
    "medium": 1, "medium_risk": 1,
    "high": 2, "high_risk": 2,
    "critical": 3, "critical_risk": 3,
}

RESULT_MAP = {
    "resolved": 1.0, "fixed": 1.0, "success": 1.0,
    "partial": 0.5, "partially resolved": 0.5,
    "failed": 0.0, "unresolved": 0.0,
}
REPAIR_STATUS_MAP = {
    "fixed": 1.0, "completed": 1.0, "resolved": 1.0,
    "in progress": 0.5, "pending": 0.3,
    "failed": 0.0, "unresolved": 0.0,
}

COST_ESTIMATES = {
    "spark plug": (50, 150), "ignition coil": (150, 400),
    "timing belt": (300, 900), "fuel pump": (200, 600),
    "coolant": (100, 300), "thermostat": (80, 250),
    "radiator": (300, 900), "water pump": (250, 700),
    "battery": (100, 300), "alternator": (300, 700),
    "brake": (150, 500), "catalytic converter": (500, 1500),
    "oxygen sensor": (150, 400), "maf sensor": (100, 350),
    "egr valve": (150, 500), "turbo": (800, 2500),
    "head gasket": (1000, 2500), "transmission": (1500, 4000),
    "oil change": (50, 120), "air filter": (20, 60), "belt": (100, 400),
}

FAULT_TO_PROBLEMS: Dict[str, List[str]] = {
    "engine_misfire": ["engine misfire", "rough idling", "engine hesitation", "engine surging", "misfiring engine"],
    "engine_overheating": ["engine overheating", "overheating", "coolant temperature high", "engine running hot", "temperature warning light"],
    "engine_stalling": ["engine stalling", "engine stalls", "engine cuts out", "sudden engine shutdown", "engine dies while driving"],
    "battery_drain_fast": ["battery drain", "battery draining fast", "dead battery", "battery keeps dying", "battery discharge"],
    "wont_start": ["car won't start", "car does not start", "no crank no start", "engine won't crank", "starting problem"],
    "headlights_flicker": ["headlights flickering", "headlights dim", "flickering lights", "headlight issues"],
    "dashboard_flickering": ["dashboard flickering", "instrument cluster issues", "warning lights flickering", "gauge fluctuation"],
    "power_window_flickering": ["power window not working", "window motor failure", "window regulator issue", "electric window problem"],
    "transmission_overheating": ["transmission overheating", "transmission running hot", "gearbox overheating", "transmission temperature high", "gear shift hard"],
    "slipping_gears": ["slipping gears", "gear slipping", "transmission slipping", "delayed shifting", "gear grinding", "gear shift hard"],
    "battery_warning_light": ["battery warning light", "battery light on", "charging system warning", "alternator warning"],
    "brake_wear": ["brake noise", "squealing brakes", "vibration when braking", "brake wear", "grinding brakes", "brake pad worn"],
    "brake_overheating": ["brake pedal hard", "soft brake pedal", "brake overheating", "brake fade", "burning smell brakes"],
    "general_degradation": ["soft brake pedal", "vibration when braking", "general wear and tear", "brake pedal spongy", "brake performance loss"],
    "injector_clogging": ["fuel injector clogging", "injector fouling", "poor fuel economy", "rough idle lean", "engine hesitation acceleration"],
    "air_intake_leak_maf": ["air intake leak", "maf sensor fault", "mass airflow sensor", "rich mixture", "intake manifold leak"],
    "fuel_pump_weakness": ["fuel pump failure", "fuel pump weak", "fuel pressure low", "engine sputtering", "fuel starvation"],
    "thermostat_failure": ["thermostat failure", "thermostat stuck", "coolant temperature fluctuation", "heater not working", "engine slow to warm up"],
    "radiator_clogging": ["radiator clogging", "radiator blockage", "coolant flow restricted", "overheating highway", "coolant flush needed"],
    "overheating": ["engine overheating", "overheating", "coolant boiling", "temperature gauge high", "steam from engine"],
}

ANOMALY_THRESHOLD = 0.5
FAULT_TRIGGER_LABELS = {"high_risk", "critical_risk", "high", "critical"}


# ─────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────

class SensorData(BaseModel):
    timestamp: Optional[datetime] = None
    engine_rpm: float
    vehicle_speed_kmh: float
    coolant_temp_c: float
    intake_air_temp_c: float
    maf_airflow_gs: float
    throttle_position_pct: float
    control_module_voltage_v: float
    engine_load_pct: float
    short_fuel_trim_pct: float
    long_fuel_trim_pct: float


class FailurePredictionInput(BaseModel):
    component: str
    year: int
    mileage_km: float
    vehicle_age_years: float
    km_since_oil_change: float
    km_since_brake_service: float
    km_since_battery_change: float
    km_since_coolant_flush: float
    avg_rpm_30d: float
    std_rpm_30d: float
    avg_coolant_temp_30d: float
    max_coolant_temp_30d: float
    avg_voltage_30d: float
    min_voltage_30d: float
    avg_speed_30d: float
    avg_throttle_30d: float
    fuel_trim_mean_30d: float
    fuel_trim_std_30d: float
    dtc_count_7d: float
    dtc_count_30d: float
    dtc_count_90d: float
    rpm_speed_ratio: float
    coolant_delta_30d: float
    voltage_drop_30d: float
    driving_aggression_score: float
    idle_time_pct: float
    highway_pct: float
    total_engine_hours: float


class RecommendationRequest(BaseModel):
    obd2_data: Dict[str, float] = Field(
        ...,
        description="OBD-II sensor readings (keys = OBD2_FEATURES)",
        example={
            "engine_rpm": 4200, "vehicle_speed_kmh": 80, "coolant_temp_c": 108,
            "intake_air_temp_c": 45, "maf_airflow_gs": 12.5,
            "throttle_position_pct": 78, "control_module_voltage_v": 11.8,
            "engine_load_pct": 88, "short_fuel_trim_pct": 15, "long_fuel_trim_pct": 10,
        },
    )
    vehicle_data: FailurePredictionInput
    problem_description: str = Field(default="", description="Free-text symptom description")
    ecu_data: str = Field(default="", description="Space-separated DTC codes (e.g. 'P0300 P0171')")
    service_history: str = Field(default="", description="Free-text service notes")
    top_k: int = Field(default=5, ge=1, le=20)
    enrich: bool = Field(default=True, description="Generate cost estimates and AI reasoning")


class Recommendation(BaseModel):
    rank: int
    final_score: float
    similarity_score: float
    fault_match_score: float
    ml_risk_score: float
    urgency: str
    component: str
    problem_description: str
    diagnosis: str
    action: str
    solution_used: str
    repair_status: str
    results: str
    car_name: str
    confidence: float
    estimated_cost: Optional[str] = None
    reasoning: Optional[str] = None
    coherence: Optional[float] = None


class RecommendationResponse(BaseModel):
    anomaly_prob: float
    risk_label: str
    risk_proba: float
    risk_probabilities: Dict[str, float]
    fault_label: str
    fault_proba: float
    fault_probabilities: Dict[str, float]
    ml_risk_score: float
    triggered: bool
    trigger_message: str
    recommendations: List[Recommendation]


# ─────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────

def build_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()
    X["maintenance_stress"]    = X["km_since_oil_change"] / (X["km_since_brake_service"] + 1)
    X["thermal_stress"]        = X["avg_coolant_temp_30d"] * X["avg_rpm_30d"] / 1000
    X["thermal_overload_ratio"]= X["max_coolant_temp_30d"] / (X["avg_coolant_temp_30d"] + 1e-6)
    X["voltage_instability"]   = (X["avg_voltage_30d"] - X["min_voltage_30d"]) / (X["avg_voltage_30d"] + 1e-6)
    X["dtc_acceleration"]      = (X["dtc_count_7d"] * 4 - X["dtc_count_30d"]).clip(lower=0)
    X["dtc_density"]           = X["dtc_count_90d"] / (X["total_engine_hours"] + 1)
    X["cumulative_wear"]       = X["mileage_km"] / 1000 * X["vehicle_age_years"]
    X["engine_stress"]         = X["avg_rpm_30d"] * X["avg_throttle_30d"] * X["driving_aggression_score"]
    X["maintenance_neglect"]   = (
        X["km_since_oil_change"] + X["km_since_brake_service"]
        + X["km_since_battery_change"] + X["km_since_coolant_flush"]
    ) / 4
    return X


def _prepare_features(row: dict, feats: list, imputer) -> pd.DataFrame:
    X = build_engineered_features(pd.DataFrame([row]))
    for f in feats:
        if f not in X.columns:
            X[f] = np.nan
    X = X[feats]
    return pd.DataFrame(imputer.transform(X), columns=feats)


# ─────────────────────────────────────────────────────────────
# CORE PREDICTION HELPERS
# ─────────────────────────────────────────────────────────────

def _anomaly_prob(obd2_row: dict) -> float:
    df_row = pd.DataFrame([obd2_row])[OBD2_FEATURES]
    scaled = scaler.transform(df_row)
    score  = iso_model.decision_function(scaled)[0]
    return float(np.clip(1 / (1 + np.exp(score * 3)), 0, 1))


def _risk_level(vehicle_data: dict):
    comp = str(vehicle_data.get("component", "")).strip().lower()
    if comp not in risk_models:
        return "medium_risk", 0.5, 1, {}
    feats   = risk_features[comp]
    imputer = risk_imputers[comp]
    model   = risk_models[comp]
    encoder = risk_encoders[comp]
    X       = _prepare_features(vehicle_data, feats, imputer)
    idx     = int(model.predict(X).flatten()[0])
    probas  = model.predict_proba(X)[0]
    return (
        encoder.classes_[idx],
        float(probas[idx]),
        idx,
        {c: round(float(p), 4) for c, p in zip(encoder.classes_, probas)},
    )


def _fault_type(vehicle_data: dict):
    comp = str(vehicle_data.get("component", "")).strip().lower()
    if comp not in fault_models:
        return "normal", 0.5, {}
    feats   = fault_features[comp]
    imputer = fault_imputers[comp]
    model   = fault_models[comp]
    encoder = fault_encoders[comp]
    X       = _prepare_features(vehicle_data, feats, imputer)
    idx     = int(model.predict(X).flatten()[0])
    probas  = model.predict_proba(X)[0]
    return (
        encoder.classes_[idx],
        float(probas[idx]),
        {c: round(float(p), 4) for c, p in zip(encoder.classes_, probas)},
    )


def _ml_risk_score(anomaly_prob: float, risk_label: str, fault_label: str, fault_proba: float) -> float:
    order = SEMANTIC_RISK_ORDER.get(risk_label.lower().strip(), 1)
    norm  = order / 3.0
    fault_contrib = fault_proba if fault_label.lower() != "normal" else 0.0
    return float(np.clip(anomaly_prob * 0.35 + norm * 0.45 + fault_contrib * 0.20, 0, 1))


def _should_trigger(anomaly_prob: float, risk_label: str, fault_label: str):
    if anomaly_prob <= ANOMALY_THRESHOLD:
        return False, f"No anomaly detected (prob={anomaly_prob:.3f}). Monitoring only."
    if risk_label.lower().strip() in FAULT_TRIGGER_LABELS:
        return True, f"Anomaly confirmed + high/critical risk ({risk_label}). Triggering recommendations."
    if fault_label.lower() != "normal":
        return True, f"Anomaly confirmed + active fault ({fault_label}). Triggering recommendations."
    return False, f"Anomaly detected but risk='{risk_label}' and no specific fault. Continue monitoring."


# ─────────────────────────────────────────────────────────────
# RECOMMENDATION LOGIC
# ─────────────────────────────────────────────────────────────

def _encode_result(v) -> float:
    return RESULT_MAP.get(str(v).lower().strip(), 0.5) if not pd.isna(v) else 0.5

def _encode_repair(v) -> float:
    return REPAIR_STATUS_MAP.get(str(v).lower().strip(), 0.5) if not pd.isna(v) else 0.5

def _specificity(v) -> float:
    return float(np.clip(len(str(v).split()) / 8.0, 0, 1)) if not pd.isna(v) else 0.0

def _problem_match(q: str, c: str) -> float:
    qt = set(q.lower().split())
    ct = set(c.lower().split())
    return float(np.clip(len(qt & ct) / len(qt), 0, 1)) if qt else 0.0

def _fault_match(predicted_fault: str, case_problem: str) -> float:
    if not predicted_fault or predicted_fault == "normal":
        return 0.0
    associated = FAULT_TO_PROBLEMS.get(predicted_fault.lower(), [predicted_fault.replace("_", " ")])
    case_str = str(case_problem).lower().strip()
    for prob in associated:
        if prob.lower() == case_str:
            return 1.0
    best = 0.0
    c_tokens = set(case_str.split())
    for prob in associated:
        t_tokens = set(prob.lower().split())
        if t_tokens:
            best = max(best, len(t_tokens & c_tokens) / len(t_tokens))
    return float(np.clip(best * 0.5, 0, 0.5))

def _fuse_scores(similarity, ml_risk, fault_match, case_result, repair_status,
                 risk_alignment, specificity, risk_level_actuel) -> float:
    return float(np.clip(
        similarity      * 0.35
        + ml_risk       * 0.20
        + fault_match   * 0.12
        + case_result   * 0.10
        + repair_status * 0.09
        + risk_alignment* 0.07
        + specificity   * 0.04
        + risk_level_actuel * 0.03,
        0, 1,
    ))

def _diag_action_coherence(diag: str, action: str) -> float:
    stop = {"the","a","an","and","or","of","to","in","is","it","for","with","by","from",
            "issue","failure","problem","fault","wear","replaced","replace","repair",
            "check","inspect","clean"}
    d = set(re.sub(r"[^a-z ]", "", diag.lower()).split()) - stop
    a = set(re.sub(r"[^a-z ]", "", action.lower()).split()) - stop
    if not d:
        return 0.5
    return float(np.clip(0.3 + len(d & a) / len(d) * 0.7, 0, 1))

def _action_target(action: str) -> str:
    a = re.sub(r"^\w+\s+", "", action.lower().strip())
    a = re.sub(r"\b(the|a|an|faulty|worn|damaged|all|both|defective|and|or|leaking|clogged|dirty|old|new|broken|stuck|failed)\b", "", a)
    return re.sub(r"\s+", " ", re.sub(r"s\b", "", a)).strip()

def _estimate_cost(action: str) -> str:
    lo = action.lower()
    for kw, (mn, mx) in COST_ESTIMATES.items():
        if kw in lo:
            return f"TND{mn}–TND{mx}"
    return "TND100–TND500"

def _get_similar_cases(component, problem_description, fault_label="", ecu_data="",
                       service_history="", top_k=50) -> pd.DataFrame:
    fault_problems = FAULT_TO_PROBLEMS.get(fault_label.lower(), [])
    fault_hint = " ".join(fault_problems) if fault_problems else fault_label.replace("_", " ")
    query = " ".join(p for p in [
        component, component,
        problem_description, problem_description,
        fault_hint, fault_hint,
        ecu_data, service_history,
    ] if p)
    query_vec = _tfidf.transform([query])
    sims = cosine_similarity(query_vec, _tfidf_matrix).flatten()
    mask = _rec_df["component"].str.lower().str.strip() == component.strip().lower()
    sims_f = sims.copy()
    if mask.sum() >= top_k:
        sims_f[~mask.values] = -1.0
    top_idx = np.argsort(sims_f)[::-1][:top_k]
    out = _rec_df.iloc[top_idx].copy()
    out["similarity_score"] = sims[top_idx]
    return out.reset_index(drop=True)


def _generate_reasoning(component, problem_description, diagnosis, action,
                         anomaly_prob, risk_label, fault_label, ml_risk_score, ecu_data="") -> str:
    prompt = (
        "You are an expert automotive diagnostic AI. "
        "Given the following vehicle situation, write ONE concise sentence (max 25 words) "
        "explaining WHY this specific action is recommended. Be technical and specific. No preamble.\n\n"
        f"Component: {component}\nProblem: {problem_description}\n"
        f"Predicted fault type: {fault_label}\nDiagnosis: {diagnosis}\n"
        f"Recommended action: {action}\nECU codes: {ecu_data or 'none'}\n"
        f"Risk level: {risk_label} (ML score: {ml_risk_score:.2f})\n"
        f"Anomaly probability: {anomaly_prob:.2f}\n"
    )
    try:
        payload = json.dumps({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 80,
            "messages": [{"role": "user", "content": prompt}],
        }).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data["content"][0]["text"].strip()
    except Exception:
        fault_readable = fault_label.replace("_", " ") if fault_label != "normal" else component
        ecu_str = f" (codes: {ecu_data})" if ecu_data else ""
        return (
            f"ML model predicts {fault_readable} on {component}{ecu_str} — "
            f"{str(action).strip()[:70]} addresses this failure mode "
            f"({risk_label.replace('_', ' ')}, {anomaly_prob:.0%} anomaly probability)."
        )


def _run_recommendation(req: RecommendationRequest) -> RecommendationResponse:
    vehicle_dict = req.vehicle_data.dict()
    vehicle_dict["component"] = req.vehicle_data.component

    obd2 = {k: req.obd2_data.get(k, 0.0) for k in OBD2_FEATURES}

    # Predictions
    anomaly_prob                            = _anomaly_prob(obd2)
    risk_label, risk_proba, _, risk_all     = _risk_level(vehicle_dict)
    fault_label, fault_proba, fault_all     = _fault_type(vehicle_dict)
    ml_score                                = _ml_risk_score(anomaly_prob, risk_label, fault_label, fault_proba)
    triggered, trigger_msg                  = _should_trigger(anomaly_prob, risk_label, fault_label)

    recs: List[Recommendation] = []

    if triggered:
        component = req.vehicle_data.component

        # Auto-build problem description if empty
        problem_description = req.problem_description
        if not problem_description:
            problems = []
            if obd2.get("coolant_temp_c", 0) > 100:
                problems.append("engine overheating")
            if obd2.get("control_module_voltage_v", 14) < 12.0:
                problems.append("low battery voltage")
            if vehicle_dict.get("dtc_count_7d", 0) > 0:
                problems.append(f"{int(vehicle_dict['dtc_count_7d'])} DTC codes in last 7 days")
            problem_description = ", ".join(problems) if problems else f"{component} anomaly detected"
            if req.ecu_data:
                problem_description += f" ({req.ecu_data})"

        similar = _get_similar_cases(
            component=component,
            problem_description=problem_description,
            fault_label=" ".join(FAULT_TO_PROBLEMS.get(fault_label.lower(), [fault_label.replace("_", " ")])),
            ecu_data=req.ecu_data,
            service_history=req.service_history,
            top_k=max(req.top_k * 10, 50),
        )

        order = SEMANTIC_RISK_ORDER.get(risk_label.lower().strip(), 1)
        risk_level_actuel = order / 3.0

        raw: list = []
        for _, case in similar.iterrows():
            case_risk_norm = (case.get("risk_score_num", 2) - 1) / 3.0
            risk_align = 1.0 - abs(case_risk_norm - risk_level_actuel)
            fmatch = _fault_match(fault_label, case.get("problem_description", ""))
            base = _fuse_scores(
                case["similarity_score"], ml_score, fmatch,
                _encode_result(case.get("results")),
                _encode_repair(case.get("repair_status")),
                risk_align,
                _specificity(case.get("solution_used")),
                risk_level_actuel,
            )
            pmatch = _problem_match(problem_description, case.get("problem_description", ""))
            final = float(np.clip(base * (1.0 + 0.15 * pmatch), 0, 1))
            urgency = (
                "🔴 CRITICAL" if final >= 0.75 else
                "🟠 HIGH"    if final >= 0.55 else
                "🟡 MEDIUM"  if final >= 0.35 else
                "🟢 LOW"
            )
            raw.append({
                "rank": None, "final_score": round(final, 4),
                "similarity_score": round(case["similarity_score"], 4),
                "fault_match_score": round(fmatch, 4),
                "ml_risk_score": round(ml_score, 4),
                "urgency": urgency,
                "component": case.get("component", ""),
                "problem_description": case.get("problem_description", ""),
                "diagnosis": case.get("diagnosis", ""),
                "action": case.get("how_to_fix_the_problem", ""),
                "solution_used": case.get("solution_used", ""),
                "repair_status": case.get("repair_status", ""),
                "results": case.get("results", ""),
                "car_name": case.get("car_name", ""),
                "confidence": round(risk_proba, 4),
                "estimated_cost": None,
                "reasoning": None,
                "coherence": None,
            })

        # Coherence penalty
        for r in raw:
            coh = _diag_action_coherence(r["diagnosis"], r["action"])
            r["coherence"] = round(coh, 3)
            r["final_score"] = round(r["final_score"] * (0.8 + 0.2 * coh), 4)

        raw.sort(key=lambda x: x["final_score"], reverse=True)

        # Deduplication
        seen: set = set()
        deduped: list = []
        for r in raw:
            t = _action_target(r["action"])
            if t not in seen:
                seen.add(t)
                deduped.append(r)
            if len(deduped) >= req.top_k:
                break

        if len(deduped) < req.top_k:
            for r in raw:
                t = _action_target(r["action"])
                if t not in seen:
                    seen.add(t)
                    deduped.append(r)
                if len(deduped) >= req.top_k:
                    break

        for i, r in enumerate(deduped[: req.top_k]):
            r["rank"] = i + 1
            if req.enrich:
                r["estimated_cost"] = _estimate_cost(r["action"])
                r["reasoning"] = _generate_reasoning(
                    component=component,
                    problem_description=problem_description,
                    diagnosis=r["diagnosis"],
                    action=r["action"],
                    anomaly_prob=anomaly_prob,
                    risk_label=risk_label,
                    fault_label=fault_label,
                    ml_risk_score=ml_score,
                    ecu_data=req.ecu_data,
                )

        recs = [Recommendation(**r) for r in deduped[: req.top_k]]

    return RecommendationResponse(
        anomaly_prob=round(anomaly_prob, 4),
        risk_label=risk_label,
        risk_proba=round(risk_proba, 4),
        risk_probabilities=risk_all,
        fault_label=fault_label,
        fault_proba=round(fault_proba, 4),
        fault_probabilities=fault_all,
        ml_risk_score=round(ml_score, 4),
        triggered=triggered,
        trigger_message=trigger_msg,
        recommendations=recs,
    )


# ─────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "OK", "service": "Smart Car AI", "version": "2.0.0"}


# ── Anomaly ──────────────────────────────────────────────────

@app.post("/api/predict/anomaly")
def anomaly(data: SensorData):
    try:
        row = data.dict()
        df  = pd.DataFrame([row])[OBD2_FEATURES]
        X   = scaler.transform(df)
        pred  = iso_model.predict(X)[0]
        score = float(iso_model.decision_function(X)[0])
        return {
            "prediction": "ANOMALY" if pred == -1 else "NORMAL",
            "score": round(score, 4),
            "is_anomaly": bool(pred == -1),
            "anomaly_probability": round(float(np.clip(1 / (1 + np.exp(score * 3)), 0, 1)), 4),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Risk + Fault ──────────────────────────────────────────────

@app.post("/api/predict/risk")
def risk_fault(data: FailurePredictionInput):
    try:
        row = data.dict()
        comp = row["component"].lower()

        if comp not in risk_models:
            return {"component": comp, "risk_level": "unknown", "fault_type": "unknown",
                    "risk_probabilities": {}, "fault_probabilities": {}}

        df = build_engineered_features(pd.DataFrame([row]))

        # Risk
        Xr = pd.DataFrame(risk_imputers[comp].transform(df[risk_features[comp]]), columns=risk_features[comp])
        r_idx = int(np.array(risk_models[comp].predict(Xr)).flatten()[0])
        r_label = risk_encoders[comp].classes_[r_idx]
        r_probs = risk_models[comp].predict_proba(Xr)[0]

        # Fault
        Xf = pd.DataFrame(fault_imputers[comp].transform(df[fault_features[comp]]), columns=fault_features[comp])
        f_idx = int(np.array(fault_models[comp].predict(Xf)).flatten()[0])
        f_label = fault_encoders[comp].classes_[f_idx]
        f_probs = fault_models[comp].predict_proba(Xf)[0]

        return {
            "component": comp,
            "risk_level": r_label,
            "risk_probabilities": {c: round(float(p), 4) for c, p in zip(risk_encoders[comp].classes_, r_probs)},
            "fault_type": f_label,
            "fault_probabilities": {c: round(float(p), 4) for c, p in zip(fault_encoders[comp].classes_, f_probs)},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Forecast ──────────────────────────────────────────────────

@app.post("/api/predict/forecast")
def forecast(payload: dict):
    if "data" not in payload:
        raise HTTPException(status_code=400, detail="Missing 'data' key")
    data = np.array(payload["data"], dtype=np.float32)
    if data.shape != (SEQ_LEN, gru_model.input_shape[-1]):
        raise HTTPException(status_code=400, detail=f"Expected shape ({SEQ_LEN}, {gru_model.input_shape[-1]})")
    TARGETS = [17, 7, 15, 6, 12]
    anchor = data[-1, TARGETS].reshape(1, N_TARGETS)
    X = scaler_x.transform(data).reshape(1, SEQ_LEN, -1)
    preds = np.stack([gru_model(X, training=True).numpy().reshape(HORIZON, N_TARGETS) for _ in range(50)])
    mean   = preds.mean(axis=0)
    deltas = scaler_d.inverse_transform(mean.reshape(-1, N_TARGETS)).reshape(HORIZON, N_TARGETS)
    result = anchor + np.cumsum(deltas, axis=0)
    return {"anchor": anchor.tolist(), "prediction": result.tolist()}


# ── Recommendations ───────────────────────────────────────────

@app.post("/api/predict/recommend", response_model=RecommendationResponse)
def recommend(req: RecommendationRequest):
    """
    Full diagnostic recommendation pipeline:
    1. Anomaly detection (IsolationForest)
    2. Risk classification (CatBoost per-component)
    3. Fault classification (CatBoost per-component)
    4. TF-IDF similarity search over historical cases
    5. Score fusion with fault-match bonus
    6. Deduplication + coherence penalty
    7. Optional: cost estimation + Claude AI reasoning
    """
    try:
        return _run_recommendation(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))