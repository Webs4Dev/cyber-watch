import json
import math
import os
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"
LOG_FILE = Path(__file__).resolve().parent / "attack_logs.json"

load_dotenv(ROOT / ".env")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

app = FastAPI(title="CyberWatch API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

model = joblib.load(MODELS / "attack_detection_rf.joblib")
model.set_params(n_jobs=1)  # one row per request: thread start-up would cost more than it saves
encoder = joblib.load(MODELS / "label_encoder.pkl")
metrics = json.loads((MODELS / "metrics.json").read_text())

FEATURES = list(model.feature_names_in_)
CONFIDENCE_THRESHOLD = metrics["confidence_threshold"]

# Held-out test rows the model never trained on (written by training/train_model.py).
demo = pd.read_parquet(MODELS / "demo_samples.parquet")
demo_X = demo[FEATURES]
demo_y = demo["Label"]

# Severity depends on what the attack is, not on how confident the model is.
SEVERITY = {
    "BENIGN": "none",
    "PortScan": "medium",
    "DDoS": "high",
    "DoS Hulk": "high",
    "DoS GoldenEye": "high",
    "DoS slowloris": "high",
    "DoS Slowhttptest": "high",
    "FTP-Patator": "high",
    "SSH-Patator": "high",
    "Bot": "critical",
    "Infiltration": "critical",
    "Heartbleed": "critical",
}


class InputData(BaseModel):
    features: list[float]


def run_prediction(sample):
    sample_df = pd.DataFrame([sample], columns=FEATURES)
    probs = model.predict_proba(sample_df)[0]  # share of trees voting for each class
    attack_type = str(encoder.inverse_transform([int(np.argmax(probs))])[0])
    confidence = float(np.max(probs))
    return {
        "attack_type": attack_type,
        "confidence": confidence,
        "low_confidence": confidence < CONFIDENCE_THRESHOLD,
        "severity": SEVERITY.get(attack_type, "medium"),
    }


def random_demo_row():
    idx = np.random.randint(len(demo_X))
    return demo_X.iloc[idx].to_numpy(), str(demo_y.iloc[idx])


def log_event(simulated, result):
    entry = {"time": datetime.now().isoformat(), "simulated": simulated, **result}
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/model-info")
def model_info():
    return metrics | {"severity": SEVERITY}


@app.post("/predict")
def predict(data: InputData):
    if len(data.features) != len(FEATURES):
        raise HTTPException(422, f"Expected {len(FEATURES)} features, got {len(data.features)}")
    if not all(math.isfinite(v) for v in data.features):
        raise HTTPException(422, "Features must be finite numbers")
    return run_prediction(data.features)


@app.get("/sample")
def sample():
    """A real held-out row, so the Predict page can be filled with realistic values."""
    features, label = random_demo_row()
    return {"label": label, "features": features.tolist()}


@app.get("/simulate")
def simulate():
    features, true_label = random_demo_row()
    result = run_prediction(features)
    log_event(true_label, result)
    return {
        "simulated_attack": true_label,
        "predicted_attack": result["attack_type"],
        "confidence": result["confidence"],
        "low_confidence": result["low_confidence"],
        "severity": result["severity"],
        "correct": result["attack_type"] == true_label,
    }
