import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")

LABELS = {
    "critical": "🚨 CRITICAL THREAT",
    "high": "⚠️ HIGH THREAT",
    "medium": "⚠️ MEDIUM THREAT",
}


def play_alert():
    # Terminal bell: works on macOS, Linux and Windows (winsound was Windows-only).
    print("\a", end="", flush=True)


def print_alert(data):
    print(f"\n🎯 Simulated: {data['simulated_attack']}")
    print(f"🧠 Predicted: {data['predicted_attack']} ({data['confidence']:.2f})"
          f"{'' if data['correct'] else '  ✗ misclassified'}")

    if data["low_confidence"]:
        print("❔ Low confidence: treat this prediction with caution")

    if data["severity"] == "none":
        print("🟢 Normal Traffic")
    else:
        play_alert()
        print(LABELS[data["severity"]])


print(f"🚀 Cyber Attack Simulator running against {API_URL}\n")

while True:
    try:
        response = requests.get(f"{API_URL}/simulate", timeout=5)
        response.raise_for_status()
        print_alert(response.json())
    except Exception as e:
        print("❌ API Error:", e)

    time.sleep(5)
