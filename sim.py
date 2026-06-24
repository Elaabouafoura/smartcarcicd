import csv
import random
from datetime import datetime, timezone, timedelta

def generer_csv_sensor():
    champs = [
        "timestamp", "engine_rpm", "vehicle_speed_kmh", "coolant_temp_c",
        "intake_air_temp_c", "maf_airflow_gs", "throttle_position_pct",
        "fuel_level_pct", "engine_load_pct", "short_fuel_trim_pct",
        "long_fuel_trim_pct", "ambient_temp_c", "barometric_pressure_kpa",
        "control_module_voltage_v"
    ]

    debut = datetime.now(timezone.utc)
    rows = []

    # Phase 1 : Démarrage à froid (20 lectures)
    for i in range(20):
        rows.append({
            "timestamp": (debut + timedelta(seconds=i*5)).isoformat(),
            "engine_rpm": round(max(800, 2000 - i*50), 2),
            "vehicle_speed_kmh": 0,
            "coolant_temp_c": round(min(85, 20 + i*3), 2),
            "intake_air_temp_c": round(random.uniform(18, 25), 2),
            "maf_airflow_gs": round(random.uniform(1, 5), 2),
            "throttle_position_pct": round(random.uniform(5, 15), 2),
            "fuel_level_pct": round(random.uniform(75, 80), 2),
            "engine_load_pct": round(random.uniform(30, 50), 2),
            "short_fuel_trim_pct": round(random.uniform(-3, 3), 2),
            "long_fuel_trim_pct": round(random.uniform(-3, 3), 2),
            "ambient_temp_c": round(random.uniform(18, 22), 2),
            "barometric_pressure_kpa": round(random.uniform(100, 103), 2),
            "control_module_voltage_v": round(random.uniform(13.8, 14.2), 2),
        })

    # Phase 2 : Conduite normale (40 lectures)
    for i in range(40):
        rows.append({
            "timestamp": (debut + timedelta(seconds=(20+i)*5)).isoformat(),
            "engine_rpm": round(random.uniform(1200, 2500), 2),
            "vehicle_speed_kmh": round(random.uniform(60, 100), 2),
            "coolant_temp_c": round(random.uniform(87, 93), 2),
            "intake_air_temp_c": round(random.uniform(22, 32), 2),
            "maf_airflow_gs": round(random.uniform(5, 15), 2),
            "throttle_position_pct": round(random.uniform(20, 45), 2),
            "fuel_level_pct": round(max(60, 78 - i*0.2), 2),
            "engine_load_pct": round(random.uniform(30, 55), 2),
            "short_fuel_trim_pct": round(random.uniform(-4, 4), 2),
            "long_fuel_trim_pct": round(random.uniform(-4, 4), 2),
            "ambient_temp_c": round(random.uniform(22, 26), 2),
            "barometric_pressure_kpa": round(random.uniform(100, 102), 2),
            "control_module_voltage_v": round(random.uniform(13.6, 14.4), 2),
        })

    # Phase 3 : Anomalie progressive (40 lectures) ⚠️
    for i in range(40):
        rows.append({
            "timestamp": (debut + timedelta(seconds=(60+i)*5)).isoformat(),
            "engine_rpm": round(random.uniform(2800, 4500), 2),
            "vehicle_speed_kmh": round(random.uniform(110, 140), 2),
            "coolant_temp_c": round(min(135, 93 + i*1.2), 2),      # ⚠️ surchauffe
            "intake_air_temp_c": round(random.uniform(45, 65), 2),  # ⚠️ élevée
            "maf_airflow_gs": round(random.uniform(22, 38), 2),
            "throttle_position_pct": round(random.uniform(65, 90), 2),
            "fuel_level_pct": round(max(5, 58 - i*0.8), 2),         # ⚠️ descend vite
            "engine_load_pct": round(random.uniform(80, 98), 2),
            "short_fuel_trim_pct": round(random.uniform(-18, -10), 2), # ⚠️ anormal
            "long_fuel_trim_pct": round(random.uniform(-18, -10), 2),  # ⚠️ anormal
            "ambient_temp_c": round(random.uniform(32, 42), 2),
            "barometric_pressure_kpa": round(random.uniform(94, 97), 2),
            "control_module_voltage_v": round(random.uniform(11.0, 12.2), 2), # ⚠️ basse
        })

    with open("soutenance.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=champs)
        writer.writeheader()
        writer.writerows(rows)

    print("✅ Fichier 'soutenance.csv' généré !")
    print(f"   📊 100 lectures au total")
    print(f"   🟡 Phase 1 : Démarrage à froid  (lectures 1-20)")
    print(f"   🟢 Phase 2 : Conduite normale   (lectures 21-60)")
    print(f"   🔴 Phase 3 : Anomalie/Surchauffe (lectures 61-100)")
    print()
    print("👉 Uploade 'soutenance.csv' depuis ton dashboard pendant la soutenance")

generer_csv_soutenance()