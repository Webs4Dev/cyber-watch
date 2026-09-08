import time
import requests
import winsound
import os
from dotenv import load_dotenv
load_dotenv()
API_URL = os.getenv("API_URL")

def play_alert():
    winsound.Beep(1000, 500)

def print_alert(simulated, predicted, confidence):

    print(f"\n🎯 Simulated: {simulated}")
    print(f"🧠 Predicted: {predicted} ({confidence:.2f})")

    if predicted == "UNKNOWN":
        play_alert()
        print("⚠️ Possible New / Unknown Attack")

    elif predicted != "BENIGN":
        play_alert()

        if confidence > 0.9:
            print("🚨 CRITICAL THREAT")
        elif confidence > 0.75:
            print("⚠️ HIGH THREAT")
        else:
            print("⚠️ MEDIUM THREAT")

    else:
        print("🟢 Normal Traffic")


print("🚀 Cyber Attack Simulator Running...\n")

while True:
    try:
        response = requests.get(API_URL)
        data = response.json()

        simulated = data.get("simulated_attack")
        predicted = data.get("predicted_attack")
        confidence = data.get("confidence")

        print_alert(simulated, predicted, confidence)

    except Exception as e:
        print("❌ API Error:", e)

    time.sleep(5)