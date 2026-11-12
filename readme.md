# CyberWatch

Network-attack detection on the CIC-IDS2017 dataset. A random-forest classifier sorts network flows into benign traffic or one of nine attack types. A FastAPI backend serves predictions, and a React dashboard replays held-out flows live, showing what the model got right and wrong.

There is no live packet capture. The "live" stream replays real flows from the test set, which the model never saw during training.

## Results

Evaluated once on 291,041 held-out flows (after removing duplicates):

| Metric | Random forest (served) |
|---|---|
| Accuracy | 99.89% |
| Macro F1 (every class weighted equally) | 0.949 |
| False alarm rate (benign flows flagged as attacks) | 0.06% |
| Predictions below 0.6 confidence | 0.07% |

Accuracy looks high partly because 79% of flows are benign, so macro F1 is the more honest score. The weakest class is **Bot** (recall 0.78: about one in five Bot flows is missed). Full numbers are in `models/metrics.json` and on the dashboard's **Model** tab.

## Model comparison: neural network vs random forest

The project started as a deep-learning project, so we trained two models on exactly the same data split and kept the better one.

- **Neural network:** dense 128 → 64 → 32 → softmax, standardised inputs, square-root class weights, early stopping on the validation set.
- **Random forest:** 100 trees, default settings, unscaled inputs.

| Metric | Random forest | Neural network |
|---|---|---|
| Accuracy | **99.89%** | 99.18% |
| Macro F1 | **0.949** | 0.834 |
| False alarm rate | **0.06%** | 0.91% |

Per class (precision / recall):

| Class | Random forest | Neural network | Test flows |
|---|---|---|---|
| BENIGN | 0.999 / 0.999 | 0.999 / 0.991 | 228,977 |
| Bot | **0.905** / 0.781 | 0.184 / 0.890 | 292 |
| DDoS | 1.000 / 1.000 | 0.999 / 0.999 | 19,202 |
| DoS GoldenEye | 0.996 / 0.998 | 0.894 / 0.998 | 1,543 |
| DoS Hulk | 0.999 / 0.998 | 0.983 / 0.992 | 25,909 |
| DoS Slowhttptest | 0.999 / 0.994 | 0.893 / 0.990 | 784 |
| DoS slowloris | 0.998 / 0.995 | 0.947 / 0.980 | 808 |
| Heartbleed | 1.000 / 1.000 | 1.000 / 1.000 | 1 |
| Infiltration | 1.000 / 0.500 | 0.129 / 0.667 | 6 |
| PortScan | 0.995 / 0.995 | 0.987 / 0.999 | 13,519 |

**Why the random forest won.**
- **Far fewer false alarms.** At 0.91%, the network would raise about 2,000 false alerts for every 229,000 normal flows. The forest raises about 140.
- **Its alerts can be trusted.** Fewer than 1 in 5 of the network's "Bot" alerts were real bots. For the forest, 9 in 10 were.
- **Tree ensembles suit this kind of data.** On tabular data with heavy-tailed numeric features like these, tree ensembles usually match or beat plain neural networks, and they need no feature scaling.
- **Simpler to serve.** The API loads only scikit-learn (no TensorFlow), and a prediction takes about 3 ms.

The network catches slightly more Bot flows (recall 0.89 vs 0.78), but it pays for that with many false alarms. `training/train_model.py` still trains both models and writes both sets of scores to `metrics.json`, so the comparison stays reproducible.

An earlier version of the network was trained on a 200,000-row sample with SMOTE oversampling and no duplicate removal. That version had a 3.4% false-alarm rate and 0.12 Bot precision.

## How it works

```
data/combine.csv ─ preprocessing.py ─▶ data/cleaned_data.csv ─ train_model.py ─▶ models/
                                                                                   ├─ attack_detection_rf.joblib, label_encoder.pkl
                                                                                   ├─ metrics.json          (test metrics + NN comparison)
                                                                                   └─ demo_samples.parquet  (held-out flows to replay)
models/ ─▶ api/main.py (FastAPI) ─▶ frontend/ (React + Vite) and simulator/ (terminal)
```

**Training** (`training/train_model.py`): removes duplicate and contradictory rows and drops constant and duplicated columns, leaving 69 features. It splits the data 70/15/15 into train/validation/test (stratified, so every class appears in each part). It trains the random forest and the comparison network, then evaluates both once on the test set.

**Severity** comes from the attack type, not the model's confidence. It's defined once in `api/main.py`:

| Severity | Classes |
|---|---|
| Critical | Bot, Infiltration, Heartbleed |
| High | DDoS, DoS Hulk, DoS GoldenEye, DoS slowloris, DoS Slowhttptest |
| Medium | PortScan |

**Confidence** is the share of the forest's 100 trees that voted for the predicted class. Below 0.6, a prediction is flagged `low_confidence`, and the best guess is still returned. A low score doesn't reliably mean the attack is new, so it isn't labelled "unknown attack".

## Setup

Requires Python 3.12+ and Node 20+.

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                    # ALLOWED_ORIGINS, API_URL
cp frontend/.env.example frontend/.env  # VITE_API_URL
```

### Data (only needed to retrain)

Download the CIC-IDS2017 `MachineLearningCVE` CSVs from the [Canadian Institute for Cybersecurity](https://www.unb.ca/cic/datasets/ids-2017.html). Then concatenate them into `data/combine.csv`, keeping a single header row. The current model was trained on the Monday, Wednesday, Thursday-afternoon and both Friday files. Adding Tuesday (FTP-/SSH-Patator) and Thursday-morning (web attacks) would add those classes.

```bash
cd training
python explore_data.py    # class distribution of data/combine.csv
python preprocessing.py   # drops inf/NaN rows -> data/cleaned_data.csv
python train_model.py     # about 3 minutes on an M-series Mac; overwrites models/
```

The trained model files are committed, so the API and dashboard run without the dataset.

### Run

```bash
uvicorn main:app --app-dir api --reload   # API on http://localhost:8000
cd frontend && npm install && npm run dev  # dashboard on http://localhost:5173
python simulator/attack_simulator.py       # optional terminal alerts
```

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{"status": "ok"}` |
| GET | `/model-info` | classes, feature names, threshold, test metrics, NN comparison, severity map |
| GET | `/simulate` | a random held-out flow's true label, the prediction, `confidence`, `low_confidence`, `severity`, `correct` |
| GET | `/sample` | a random held-out flow: `{"label", "features"}` |
| POST | `/predict` | body `{"features": [69 numbers in /model-info order]}` → `attack_type`, `confidence`, `low_confidence`, `severity`. Returns 422 for wrong length or non-finite values |

Interactive docs are at `http://localhost:8000/docs`.

## Limitations

- CIC-IDS2017 is a lab dataset recorded in 2017. Scores this high rarely carry over to real networks.
- `Destination Port` is a feature, and some attacks in the dataset target fixed ports, so the model can partly learn ports rather than behaviour.
- Heartbleed (1 test flow) and Infiltration (6) are too rare for reliable scores.
