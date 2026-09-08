from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import pandas as pd
import joblib
import json
from datetime import datetime
from keras.models import load_model
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = load_model("../models/attack_detection_NN_model.keras")
scaler = joblib.load("../models/scaler.pkl")
encoder = joblib.load("../models/label_encoder.pkl")

NUM_FEATURES = scaler.mean_.shape[0]
CONFIDENCE_THRESHOLD = 0.6

df = pd.read_csv("../data/cleaned_data.csv")
df.columns = df.columns.str.strip()

X_real = df.drop("Label", axis=1)
y_real = df["Label"]

class InputData(BaseModel):
    features: list[float]

def run_prediction(sample):
    sample_df = pd.DataFrame([sample], columns=scaler.feature_names_in_)
    sample_scaled = scaler.transform(sample_df)

    prediction = model.predict(sample_scaled, verbose=0)
    probs = prediction[0]

    attack_class = int(np.argmax(probs))
    confidence = float(np.max(probs))
    attack_name = encoder.inverse_transform([attack_class])[0]

    if confidence < CONFIDENCE_THRESHOLD:
        attack_name = "UNKNOWN"

    return attack_name, confidence

def generate_real_sample():
    idx = np.random.randint(0, len(X_real))
    sample = X_real.iloc[idx].values
    label = y_real.iloc[idx]
    return sample, label

def log_event(simulated, predicted, confidence):
    log_data = {
        "time": datetime.now().isoformat(),
        "simulated": simulated,
        "predicted": predicted,
        "confidence": confidence
    }

    with open("attack_logs.json", "a") as f:
        f.write(json.dumps(log_data) + "\n")

@app.post("/predict")
def predict(data: InputData):

    if len(data.features) != NUM_FEATURES:
        return {"error": f"Expected {NUM_FEATURES} features"}

    attack_name, confidence = run_prediction(data.features)

    return {
        "attack_type": attack_name,
        "confidence": confidence
    }

@app.get("/simulate")
def simulate():

    sample, true_label = generate_real_sample()

    predicted, confidence = run_prediction(sample)

    log_event(true_label, predicted, confidence)

    return {
        "simulated_attack": true_label,
        "predicted_attack": predicted,
        "confidence": confidence
    }