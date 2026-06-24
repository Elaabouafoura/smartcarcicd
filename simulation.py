import requests
import random
import time
import csv
from datetime import datetime, timezone

API_URL = "https://stagepfe-back.onrender.com/api/v1"

headers = {"Content-Type": "application/json"}

def get_jwt_token():
    print("🔐 Connexion à Smart Car Monitoring")
    email = input("Email : ").strip()
    password = input("Mot de passe : ").strip()

    res = requests.post(f"{API_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    data = res.json()
    if "accessToken" not in data:
        print(f"❌ Login échoué: {data}")
        exit(1)
    print("✅ Connecté !\n")
    return data["accessToken"]

def choisir_vehicule(token):
    res = requests.get(f"{API_URL}/vehicles", headers={
        "Authorization": f"Bearer {token}"
    })
    data = res.json()
    vehicules = data.get("data", [])

    if not vehicules:
        print("❌ Aucun véhicule trouvé pour ce compte.")
        exit(1)

    print("🚗 Vos véhicules :")
    print("─" * 50)
    for i, v in enumerate(vehicules):
        print(f"  [{i+1}] {v['make'].upper()} {v['model']} "
              f"({v['year']}) — {v.get('plateNumber', 'N/A')}")
    print("─" * 50)

    if len(vehicules) == 1:
        choix = 0
        print(f"✅ Véhicule sélectionné : {vehicules[0]['make']} {vehicules[0]['model']}\n")
    else:
        idx = input(f"Choisis un véhicule (1-{len(vehicules)}) : ").strip()
        choix = int(idx) - 1

    return vehicules[choix]["id"], vehicules[choix]

def now():
    return datetime.now(timezone.utc).isoformat()

def mode_normal(t):
    return {
        "timestamp": now(),
        "engine_rpm": round(random.uniform(1000, 2500), 2),
        "vehicle_speed_kmh": round(random.uniform(40, 90), 2),
        "coolant_temp_c": round(random.uniform(85, 95), 2),
        "intake_air_temp_c": round(random.uniform(20, 35), 2),
        "maf_airflow_gs": round(random.uniform(3, 15), 2),
        "throttle_position_pct": round(random.uniform(15, 45), 2),
        "fuel_level_pct": round(max(20, 80 - t * 0.05), 2),
        "engine_load_pct": round(random.uniform(25, 55), 2),
        "short_fuel_trim_pct": round(random.uniform(-5, 5), 2),
        "long_fuel_trim_pct": round(random.uniform(-5, 5), 2),
        "ambient_temp_c": round(random.uniform(22, 28), 2),
        "barometric_pressure_kpa": round(random.uniform(99, 102), 2),
        "control_module_voltage_v": round(random.uniform(13.5, 14.5), 2),
    }

def mode_anomalie(t):
    return {
        "timestamp": now(),
        "engine_rpm": round(random.uniform(2500, 4500), 2),
        "vehicle_speed_kmh": round(random.uniform(100, 130), 2),
        "coolant_temp_c": round(min(130, 90 + t * 2.5), 2),
        "intake_air_temp_c": round(random.uniform(40, 60), 2),
        "maf_airflow_gs": round(random.uniform(20, 35), 2),
        "throttle_position_pct": round(random.uniform(60, 85), 2),
        "fuel_level_pct": round(max(5, 40 - t * 0.1), 2),
        "engine_load_pct": round(random.uniform(75, 95), 2),
        "short_fuel_trim_pct": round(random.uniform(-15, -8), 2),
        "long_fuel_trim_pct": round(random.uniform(-15, -8), 2),
        "ambient_temp_c": round(random.uniform(35, 42), 2),
        "barometric_pressure_kpa": round(random.uniform(95, 98), 2),
        "control_module_voltage_v": round(random.uniform(11.5, 12.5), 2),
    }

def mode_demarrage(t):
    return {
        "timestamp": now(),
        "engine_rpm": round(max(800, 2000 - t * 50), 2),
        "vehicle_speed_kmh": 0,
        "coolant_temp_c": round(min(85, 20 + t * 5), 2),
        "intake_air_temp_c": round(random.uniform(18, 25), 2),
        "maf_airflow_gs": round(random.uniform(1, 5), 2),
        "throttle_position_pct": round(random.uniform(5, 15), 2),
        "fuel_level_pct": round(random.uniform(60, 80), 2),
        "engine_load_pct": round(random.uniform(30, 50), 2),
        "short_fuel_trim_pct": round(random.uniform(-3, 3), 2),
        "long_fuel_trim_pct": round(random.uniform(-3, 3), 2),
        "ambient_temp_c": round(random.uniform(18, 25), 2),
        "barometric_pressure_kpa": round(random.uniform(100, 103), 2),
        "control_module_voltage_v": round(random.uniform(13.8, 14.2), 2),
    }

def run_simulation(token, vehicle_id, vehicle_info):
    print(f"🚗 Simulation pour : {vehicle_info['make'].upper()} "
          f"{vehicle_info['model']} ({vehicle_info['year']})")
    print("─" * 50)
    print("  [1] Normal")
    print("  [2] Anomalie (pour tester l'IA)")
    print("  [3] Démarrage à froid")
    print("  [4] Séquence automatique (démarrage → normal → anomalie)")
    print("─" * 50)

    choix = input("Choisis un mode (1/2/3/4) : ").strip()
    intervalle = int(input("Intervalle en secondes (ex: 5) : ") or "5")
    batch = int(input("Upload tous les combien de lectures ? (ex: 20) : ") or "20")

    buffer = []
    t = 0
    upload_count = 0

    while True:
        try:
            if choix == "1":
                data = mode_normal(t)
                label = "🟢 NORMAL"
            elif choix == "2":
                data = mode_anomalie(t)
                label = "🔴 ANOMALIE"
            elif choix == "3":
                data = mode_demarrage(t)
                label = "🟡 DÉMARRAGE"
            elif choix == "4":
                if t < 5:
                    data = mode_demarrage(t)
                    label = "🟡 DÉMARRAGE"
                elif t < 15:
                    data = mode_normal(t)
                    label = "🟢 NORMAL"
                else:
                    data = mode_anomalie(t - 15)
                    label = "🔴 ANOMALIE"
            else:
                data = mode_normal(t)
                label = "🟢 NORMAL"

            buffer.append(data)

            print(f"[{label}] t={t}s | "
                  f"RPM: {data['engine_rpm']:.0f} | "
                  f"Temp: {data['coolant_temp_c']:.1f}°C | "
                  f"Buffer: {len(buffer)}/{batch}")

            if len(buffer) >= batch:
                upload_count += 1
                nom_fichier = f"batch_{upload_count}.csv"
                upload_csv(token, vehicle_id, nom_fichier, buffer)
                buffer = []
                print("🏁 Terminé !")
                break 

            t += 1
            time.sleep(intervalle)

        except KeyboardInterrupt:
            print("\n⛔ Simulation arrêtée.")
            if buffer:
                print(f"📤 Upload des {len(buffer)} lectures restantes...")
                upload_count += 1
                upload_csv(token, vehicle_id, f"batch_{upload_count}.csv", buffer)
            break
        except Exception as e:
            print(f"❌ Erreur: {e}")
            time.sleep(5)

CHAMPS = [
    "timestamp", "engine_rpm", "vehicle_speed_kmh", "coolant_temp_c",
    "intake_air_temp_c", "maf_airflow_gs", "throttle_position_pct",
    "fuel_level_pct", "engine_load_pct", "short_fuel_trim_pct",
    "long_fuel_trim_pct", "ambient_temp_c", "barometric_pressure_kpa",
    "control_module_voltage_v"
]

def upload_csv(token, vehicle_id, nom_fichier, buffer):
    with open(nom_fichier, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CHAMPS)
        writer.writeheader()
        writer.writerows(buffer)

    print(f"\n📁 CSV sauvegardé : {nom_fichier} ({len(buffer)} lectures)")
    print(f"⬆️  Upload en cours...")

    with open(nom_fichier, "rb") as f:
        res = requests.post(
            f"{API_URL}/vehicles/{vehicle_id}/sensor-data/upload",
            files={"file": (nom_fichier, f, "text/csv")},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )

    if res.status_code == 201:
        data = res.json()
        print(f"✅ Upload réussi ! {data.get('inserted', '?')} lignes → dashboard mis à jour !\n")
    else:
        print(f"❌ Upload échoué : {res.status_code} → {res.text}\n")

if __name__ == "__main__":
    TOKEN = get_jwt_token()
    headers["Authorization"] = f"Bearer {TOKEN}"
    VEHICLE_ID, VEHICLE_INFO = choisir_vehicule(TOKEN)
    run_simulation(TOKEN, VEHICLE_ID, VEHICLE_INFO)