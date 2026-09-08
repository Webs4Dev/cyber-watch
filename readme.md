# ⚡ CyberWatch – AI-Powered Cyber Attack Detection System

CyberWatch is a real-time cyber threat detection platform that uses Deep Learning to identify malicious network activity.
It simulates network attacks, classifies them using a trained neural network, and visualizes results in a live cyber-themed dashboard.

---

## 🚀 Key Features

* 🧠 **Deep Learning Model (Keras + TensorFlow)** for multi-class attack detection
* ⚡ **Real-time Attack Simulation & Detection**
* 📊 **Confidence-based Predictions with UNKNOWN detection**
* 🖥️ **Live Cyber Dashboard (React + Vite)**
* 📁 **Automatic Logging of Attack Events**
* 🔊 **Alert System for Suspicious Activity**

---

## 🧠 Tech Stack

### 🔹 Backend

* FastAPI
* TensorFlow / Keras
* Scikit-learn
* Pandas / NumPy

### 🔹 Frontend

* React (Vite)
* JavaScript
* Custom Cyberpunk UI

### 🔹 Tools & Utilities

* Joblib
* Python Dotenv
* Requests

---

## 📂 Project Structure

```id="2m9f0f"
cyber-watch/
│
├── api/
│   └── main.py                 # FastAPI backend
│
├── training/
│   ├── train_model.py          # Model training
│   ├── preprocessing.py        # Data preprocessing
│   └── explore_data.py         # Data analysis
│
├── simulator/
│   └── attack_simulator.py     # Real-time attack simulator
│
├── models/
│   ├── attack_detection_NN_model.keras
│   ├── scaler.pkl
│   └── label_encoder.pkl
│
├── data/
│   ├── cleaned_data.csv
│   └── combined.csv
│
├── react-dashboard/
│   ├── src/
│   ├── .env                    # Frontend env (VITE_API_URL)
│   └── package.json
│
├── cyber_attack/               # Virtual environment (ignored)
│
├── attack_logs.json            # Prediction logs
├── requirements.txt
└── .gitignore
```

---

## ⚙️ Setup Guide

### 1️⃣ Clone Repository

```id="k2x7wo"
git clone https://github.com/Webs4Dev/cyber-watch.git
cd cyber-watch
```

---

### 2️⃣ Backend Setup (FastAPI)

```id="3f7r0q"
cd api
pip install -r ../requirements.txt
uvicorn main:app --reload
```

👉 Runs on: `http://localhost:8000`

---

### 3️⃣ Frontend Setup (React)

```id="kq6mcm"
cd frontend
npm install
```

Create `.env` file in `frontend/`:

```id="j5joxp"
VITE_API_URL=http://localhost:8000
```

Run frontend:

```id="e4a3lc"
npm run dev
```

👉 Runs on: `http://localhost:5173`

---

### 4️⃣ Run Simulator (Optional)

```id="3vfr9o"
cd simulator
python attack_simulator.py
```

---

## 🔌 API Endpoints

### 🔹 Simulate Attack

```id="b2gq6n"
GET /simulate
```

Returns:

```json id="k9d2x0"
{
  "simulated_attack": "DoS Hulk",
  "predicted_attack": "DDoS",
  "confidence": 0.92
}
```

---

### 🔹 Predict Custom Input

```id="z1g0fc"
POST /predict
```

```json id="3rht5r"
{
  "features": [0.1, 0.2, ..., 0.3]
}
```

---

## 🧠 Model Architecture

* Input: Network traffic features
* Preprocessing:

  * StandardScaler
  * Label Encoding
* Model:

  * Dense Neural Network
  * Layers: **128 → 64 → 32 → Output**
* Output:

  * Multi-class classification
* Special Logic:

  * Low confidence → classified as **UNKNOWN**

---

## 📊 Supported Attack Types

* BENIGN
* DoS Hulk
* DDoS
* PortScan
* DoS GoldenEye
* FTP-Patator
* SSH-Patator
* More (based on dataset)

---

## ⚠️ Known Limitations

* Class imbalance may affect rare attack detection
* Requires correctly scaled input features
* Confidence threshold tuning needed

---

## 🚀 Future Enhancements

* 📈 Attack analytics (charts & trends)
* 🌐 Deployment (Docker / Cloud)
* 🤖 AI vs AI cyber range simulation
* 🔐 Real packet capture integration
* 📡 Live network monitoring

---

