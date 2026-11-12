"""Train the CyberWatch attack classifier.

Run from training/:  python train_model.py
Reads ../data/cleaned_data.csv, writes to ../models/:
  attack_detection_rf.joblib, label_encoder.pkl  (used by the API)
  metrics.json          (test-set metrics + neural-network comparison, shown in the dashboard)
  demo_samples.parquet  (held-out test rows that /simulate replays; never seen in training)

The served model is a random forest. A small neural network is trained on the same
split purely for comparison: on this data the forest wins clearly (higher macro F1,
far fewer false alarms), so the network is not saved.
"""
import json
from datetime import datetime, timezone

import joblib
import keras
import numpy as np
import pandas as pd
from keras.layers import Dense, Input
from keras.models import Sequential
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

SEED = 42
MIN_CLASS_SAMPLES = 10      # classes smaller than this can't be split into train/val/test
CONFIDENCE_THRESHOLD = 0.6  # below this the API flags a prediction as low confidence
DEMO_ROWS_PER_CLASS = 1500  # cap per class for the dashboard's replay file

keras.utils.set_random_seed(SEED)

# ── 1. Load and clean ────────────────────────────────────────────────────────
df = pd.read_csv("../data/cleaned_data.csv")
df.columns = df.columns.str.strip()
print("Loaded:", df.shape)

# Exact duplicate rows would land in both train and test and inflate the score.
df = df.drop_duplicates()
# Identical features with different labels can't be learned; drop every copy of them.
features = df.columns.drop("Label")
df = df[~df.duplicated(subset=features, keep=False)]
print("After removing duplicates and conflicting rows:", df.shape)

counts = df["Label"].value_counts()
dropped_classes = counts[counts < MIN_CLASS_SAMPLES].index.tolist()
df = df[~df["Label"].isin(dropped_classes)]
print("Class counts:\n", df["Label"].value_counts().to_string())
if dropped_classes:
    print("Dropped (too few samples):", dropped_classes)

# Columns with a single value, or that duplicate another column, carry no information.
X = df.drop(columns="Label")
constant_cols = [c for c in X.columns if X[c].nunique() == 1]
duplicate_cols = [c for c in X.columns if c.endswith(".1") and c[:-2] in X.columns
                  and X[c].equals(X[c[:-2]])]
X = X.drop(columns=constant_cols + duplicate_cols)
print(f"Dropped {len(constant_cols)} constant + {len(duplicate_cols)} duplicate columns "
      f"-> {X.shape[1]} features")

encoder = LabelEncoder()
y = encoder.fit_transform(df["Label"])
class_names = list(encoder.classes_)
del df

# ── 2. Split 70 / 15 / 15, stratified so every class appears in each part ────
X_train, X_tmp, y_train, y_tmp = train_test_split(
    X, y, test_size=0.30, stratify=y, random_state=SEED)
X_val, X_test, y_val, y_test = train_test_split(
    X_tmp, y_tmp, test_size=0.50, stratify=y_tmp, random_state=SEED)
del X, X_tmp, y_tmp
print(f"Train {len(X_train):,} | Val {len(X_val):,} | Test {len(X_test):,}")


def summarize(y_true, y_pred):
    report = classification_report(
        y_true, y_pred, labels=range(len(class_names)), target_names=class_names,
        output_dict=True, zero_division=0)
    benign = class_names.index("BENIGN")
    benign_rows = y_true == benign
    return {
        "accuracy": round(report["accuracy"], 4),
        "macro_f1": round(f1_score(y_true, y_pred, average="macro"), 4),
        # Share of normal traffic wrongly raised as an attack.
        "benign_false_alarm_rate": round(float((y_pred[benign_rows] != benign).mean()), 4),
        "per_class": {
            name: {k: round(report[name][k], 4) for k in ("precision", "recall", "f1-score")}
            | {"support": int(report[name]["support"])}
            for name in class_names
        },
        "confusion_matrix": confusion_matrix(
            y_true, y_pred, labels=range(len(class_names))).tolist(),
    }


# ── 3. Random forest (the served model; trees need no feature scaling) ───────
rf = RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=SEED)
rf.fit(X_train, y_train)
rf_probs = rf.predict_proba(X_test)  # share of trees voting for each class
rf_pred = rf_probs.argmax(axis=1)
rf_metrics = summarize(y_test, rf_pred)
rf_metrics["low_confidence_share"] = round(float((rf_probs.max(axis=1) < CONFIDENCE_THRESHOLD).mean()), 4)
print("\n=== Random forest (test set) ===")
print(classification_report(y_test, rf_pred, target_names=class_names, digits=3, zero_division=0))

# ── 4. Neural network, for comparison only ───────────────────────────────────
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_val_s = scaler.transform(X_val)
X_test_s = scaler.transform(X_test)

# Square-root class weights: rare classes count more, without SMOTE's full rebalancing.
class_counts = np.bincount(y_train)
weights = np.sqrt(len(y_train) / (len(class_counts) * class_counts))
class_weight = dict(enumerate(weights / weights.min()))

nn = Sequential([
    Input(shape=(X_train_s.shape[1],)),
    Dense(128, activation="relu"),
    Dense(64, activation="relu"),
    Dense(32, activation="relu"),
    Dense(len(class_names), activation="softmax"),
])
nn.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
nn.fit(
    X_train_s, y_train,
    validation_data=(X_val_s, y_val),
    epochs=40,
    batch_size=1024,
    class_weight=class_weight,
    callbacks=[keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=4, restore_best_weights=True)],
    verbose=2,
)
nn_metrics = summarize(y_test, nn.predict(X_test_s, batch_size=8192, verbose=0).argmax(axis=1))

# ── 5. Save artifacts ────────────────────────────────────────────────────────
joblib.dump(rf, "../models/attack_detection_rf.joblib", compress=3)
joblib.dump(encoder, "../models/label_encoder.pkl")

metrics = {
    "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "classes": class_names,
    "features": list(X_train.columns),
    "confidence_threshold": CONFIDENCE_THRESHOLD,
    "dropped_classes": dropped_classes,
    "dropped_columns": constant_cols + duplicate_cols,
    "split_sizes": {"train": len(X_train), "val": len(X_val), "test": len(X_test)},
    "model": {"name": "Random forest (100 trees)"} | rf_metrics,
    "comparison": {"name": "Neural network (128 → 64 → 32)"}
                  | {k: nn_metrics[k] for k in ("accuracy", "macro_f1", "benign_false_alarm_rate", "per_class")},
}
with open("../models/metrics.json", "w") as f:
    json.dump(metrics, f, indent=2)

# Held-out rows for the dashboard, capped per class so attacks show up often.
demo = X_test.assign(Label=encoder.inverse_transform(y_test))
demo = (demo.groupby("Label", group_keys=False)
            .apply(lambda g: g.sample(min(len(g), DEMO_ROWS_PER_CLASS), random_state=SEED)))
demo.to_parquet("../models/demo_samples.parquet", index=False)

print(f"\nSaved model, metrics.json and {len(demo):,} demo rows to ../models/")
print(f"RF  macro F1 {rf_metrics['macro_f1']} | benign false alarms {rf_metrics['benign_false_alarm_rate']}")
print(f"NN  macro F1 {nn_metrics['macro_f1']} | benign false alarms {nn_metrics['benign_false_alarm_rate']}")
