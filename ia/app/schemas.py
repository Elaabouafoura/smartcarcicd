from pydantic import BaseModel

class FailureInput(BaseModel):
    make: str
    model: str
    year: int
    vehicle_age_years: float
    component: str
    mileage_km: float
    km_since_oil_change: float
    km_since_brake_service: float
    coolant_temp: float
    rpm: float
    speed: float
    battery_voltage: float
    dtc_count_7d: int
    dtc_count_30d: int
    dtc_count_90d: int
    rpm_speed_ratio: float
    coolant_delta_30d: float
    voltage_drop_30d: float
    driving_aggression_score: float
    idle_time_pct: float
    highway_pct: float
    total_engine_hours: float