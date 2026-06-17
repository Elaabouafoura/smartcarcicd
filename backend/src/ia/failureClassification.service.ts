import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity';
import { DtcEntry } from 'src/dtc/entities/dtc.entity';
import { MaintenanceRecord } from 'src/maintenance/entities/maintenance.entity';
import { Vehicle } from 'src/vehicle/entities/vehicle.entity';

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT DTO — mirrors FailurePredictionInput in FastAPI
// ─────────────────────────────────────────────────────────────────────────────

export interface FailureClassificationFeatures {
  // identity (not sent to model, used for routing)
  vehicle_id: string;
  snapshot_date: string;
  component: string;

  // vehicle static
  year: number;
  mileage_km: number;
  vehicle_age_years: number;

  // maintenance km gaps
  km_since_oil_change: number;
  km_since_brake_service: number;
  km_since_battery_change: number;
  km_since_coolant_flush: number;

  // sensor aggregates — 30-day window
  avg_rpm_30d: number;
  std_rpm_30d: number;
  avg_coolant_temp_30d: number;
  max_coolant_temp_30d: number;
  avg_voltage_30d: number;
  min_voltage_30d: number;
  avg_speed_30d: number;
  avg_throttle_30d: number;
  fuel_trim_mean_30d: number;
  fuel_trim_std_30d: number;

  // DTC counts
  dtc_count_7d: number;
  dtc_count_30d: number;
  dtc_count_90d: number;

  // derived sensor ratios
  rpm_speed_ratio: number;
  coolant_delta_30d: number;
  voltage_drop_30d: number;

  // driving behaviour (30-day)
  driving_aggression_score: number;
  idle_time_pct: number;
  highway_pct: number;
  total_engine_hours: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT DETECTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** DTC prefix → component category used by the Python model */
const DTC_PREFIX_COMPONENT: Record<string, string> = {
  P03: 'engine',       // P030x misfires
  P02: 'fuel_system',  // P02xx fuel/air
  P01: 'fuel_system',
  P00: 'engine',
  P07: 'transmission',
  P08: 'transmission',
  P06: 'electrical',
  B0: 'electrical',
  C0: 'brakes',
  U0: 'electrical',
};

/** Maintenance service_type keyword → component */
const SERVICE_COMPONENT_MAP: Array<[RegExp, string]> = [
  [/oil|huile|vidange/i, 'engine'],
  [/brake|frein/i, 'brakes'],
  [/battery|batterie/i, 'battery'],
  [/coolant|liquide.+refroid|radiator|thermostat/i, 'cooling_system'],
  [/transmission|gearbox|boite/i, 'transmission'],
  [/fuel|carburant|inject/i, 'fuel_system'],
  [/electr|alternator|alternateur|starter/i, 'electrical'],
];

function detectComponentFromDtcs(codes: string[]): string | null {
  for (const code of codes) {
    const upper = code.toUpperCase().trim();
    for (const [prefix, comp] of Object.entries(DTC_PREFIX_COMPONENT)) {
      if (upper.startsWith(prefix)) return comp;
    }
  }
  return null;
}

function detectComponentFromService(serviceType: string): string | null {
  for (const [re, comp] of SERVICE_COMPONENT_MAP) {
    if (re.test(serviceType)) return comp;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[], avg?: number): number {
  if (arr.length < 2) return 0;
  const mu = avg ?? mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length);
}

function safeDiv(a: number, b: number, fallback = 0): number {
  return b === 0 ? fallback : a / b;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class FailureClassificationService {
  constructor(
    @InjectRepository(SensorReading)
    private readonly sensorRepo: Repository<SensorReading>,

    @InjectRepository(DtcEntry)
    private readonly dtcRepo: Repository<DtcEntry>,

    @InjectRepository(MaintenanceRecord)
    private readonly maintenanceRepo: Repository<MaintenanceRecord>,

    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC — build features for ONE vehicle / ONE component
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build a FailureClassificationFeatures payload ready to be sent to FastAPI.
   *
   * @param vehicleId  UUID of the vehicle
   * @param component  one of: engine | electrical | transmission | battery |
   *                           brakes | fuel_system | cooling_system
   *                   Pass null to auto-detect from recent DTCs.
   * @param snapshotDate  reference date (defaults to now)
   */
  async buildFeatures(
    vehicleId: string,
    component: string | null = null,
    snapshotDate: Date = new Date(),
  ): Promise<FailureClassificationFeatures> {
    const vehicle = await this.vehicleRepo.findOneOrFail({
      where: { id: vehicleId },
    });

    const currentYear = snapshotDate.getFullYear();
    const vehicleYear = vehicle.year ?? currentYear;
    const vehicleAgeYears = currentYear - vehicleYear;
    const mileageKm: number = vehicle.currentMileageKm ?? 0;

    // ── 2. Date windows ──────────────────────────────────────────────────────
    const d7 = this._daysAgo(snapshotDate, 7);
    const d30 = this._daysAgo(snapshotDate, 30);
    const d90 = this._daysAgo(snapshotDate, 90);

    const sensors = await this.sensorRepo
      .createQueryBuilder('s')
      .where('s.vehicle = :vid', { vid: vehicleId })
      .andWhere('s.timestamp >= :from', { from: d30 })
      .andWhere('s.timestamp <= :to', { to: snapshotDate })
      .orderBy('s.timestamp', 'ASC')
      .getMany();

    const sensorFeatures = this._aggregateSensors(sensors);

    const [dtcCount7d, dtcCount30d, dtcCount90d, recentDtcCodes] =
      await this._dtcCounts(vehicleId, snapshotDate, d7, d30, d90);

    const resolvedComponent =
      component ??
      detectComponentFromDtcs(recentDtcCodes) ??
      (await this._detectComponentFromMaintenance(vehicleId, snapshotDate)) ??
      'engine'; 

    const maintenanceGaps = await this._maintenanceGaps(
      vehicleId,
      mileageKm,
      snapshotDate,
    );

    return {
      vehicle_id: vehicleId,
      snapshot_date: snapshotDate.toISOString(),
      component: resolvedComponent,

      year: vehicleYear,
      mileage_km: mileageKm,
      vehicle_age_years: vehicleAgeYears,

      ...maintenanceGaps,
      ...sensorFeatures,

      dtc_count_7d: dtcCount7d,
      dtc_count_30d: dtcCount30d,
      dtc_count_90d: dtcCount90d,
    };
  }


  async buildFeaturesAllComponents(
    vehicleId: string,
    snapshotDate: Date = new Date(),
  ): Promise<FailureClassificationFeatures[]> {
    const COMPONENTS = [
      'engine',
      'electrical',
      'transmission',
      'battery',
      'brakes',
      'fuel_system',
      'cooling_system',
    ];

    return Promise.all(
      COMPONENTS.map((comp) =>
        this.buildFeatures(vehicleId, comp, snapshotDate),
      ),
    );
  }

 

  private _aggregateSensors(readings: SensorReading[]): Omit<
    FailureClassificationFeatures,
    | 'vehicle_id'
    | 'snapshot_date'
    | 'component'
    | 'year'
    | 'mileage_km'
    | 'vehicle_age_years'
    | 'km_since_oil_change'
    | 'km_since_brake_service'
    | 'km_since_battery_change'
    | 'km_since_coolant_flush'
    | 'dtc_count_7d'
    | 'dtc_count_30d'
    | 'dtc_count_90d'
  > {
    if (!readings.length) {
      return this._zeroSensorFeatures();
    }

    const rpms    = readings.map((r) => r.engine_rpm ?? 0);
    const speeds  = readings.map((r) => r.vehicle_speed_kmh ?? 0);
    const coolant = readings.map((r) => r.coolant_temp_c ?? 0);
    const voltage = readings.map((r) => r.control_module_voltage_v ?? 0);
    const throttle= readings.map((r) => r.throttle_position_pct ?? 0);

    const fuelTrim = readings.map(
      (r) => ((r.short_fuel_trim_pct ?? 0) + (r.long_fuel_trim_pct ?? 0)) / 2,
    );

    const avgRpm     = mean(rpms);
    const stdRpm     = stddev(rpms, avgRpm);
    const avgCoolant = mean(coolant);
    const maxCoolant = Math.max(...coolant);
    const minCoolant = Math.min(...coolant);
    const avgVoltage = mean(voltage);
    const minVoltage = Math.min(...voltage);
    const avgSpeed   = mean(speeds);
    const avgThrottle= mean(throttle);
    const fuelTrimMean = mean(fuelTrim);
    const fuelTrimStd  = stddev(fuelTrim, fuelTrimMean);

    const rpmSpeedRatio  = safeDiv(avgRpm, avgSpeed + 1);
    const coolantDelta30d = maxCoolant - minCoolant;
    const voltageDrop30d  = avgVoltage - minVoltage;


    const aggressionScore = Math.min(
      1,
      (mean(throttle) / 100) * 0.5 + Math.min(avgRpm / 6000, 1) * 0.5,
    );

    const idleReadings = readings.filter(
      (r) => (r.vehicle_speed_kmh ?? 0) < 5 && (r.engine_rpm ?? 0) > 400,
    );
    const idleTimePct = safeDiv(idleReadings.length, readings.length);

    const highwayReadings = readings.filter(
      (r) => (r.vehicle_speed_kmh ?? 0) >= 90,
    );
    const highwayPct = safeDiv(highwayReadings.length, readings.length);


    const SAMPLING_INTERVAL_MINUTES = 1;
    const engineOnReadings = readings.filter(
      (r) => (r.engine_rpm ?? 0) > 400,
    );
    const totalEngineHours =
      (engineOnReadings.length * SAMPLING_INTERVAL_MINUTES) / 60;

    return {
      avg_rpm_30d: avgRpm,
      std_rpm_30d: stdRpm,
      avg_coolant_temp_30d: avgCoolant,
      max_coolant_temp_30d: maxCoolant,
      avg_voltage_30d: avgVoltage,
      min_voltage_30d: minVoltage,
      avg_speed_30d: avgSpeed,
      avg_throttle_30d: avgThrottle,
      fuel_trim_mean_30d: fuelTrimMean,
      fuel_trim_std_30d: fuelTrimStd,
      rpm_speed_ratio: rpmSpeedRatio,
      coolant_delta_30d: coolantDelta30d,
      voltage_drop_30d: voltageDrop30d,
      driving_aggression_score: aggressionScore,
      idle_time_pct: idleTimePct,
      highway_pct: highwayPct,
      total_engine_hours: totalEngineHours,
    };
  }

  private _zeroSensorFeatures() {
    return {
      avg_rpm_30d: 0,
      std_rpm_30d: 0,
      avg_coolant_temp_30d: 0,
      max_coolant_temp_30d: 0,
      avg_voltage_30d: 0,
      min_voltage_30d: 0,
      avg_speed_30d: 0,
      avg_throttle_30d: 0,
      fuel_trim_mean_30d: 0,
      fuel_trim_std_30d: 0,
      rpm_speed_ratio: 0,
      coolant_delta_30d: 0,
      voltage_drop_30d: 0,
      driving_aggression_score: 0,
      idle_time_pct: 0,
      highway_pct: 0,
      total_engine_hours: 0,
    };
  }


  private async _dtcCounts(
    vehicleId: string,
    snapshotDate: Date,
    d7: Date,
    d30: Date,
    d90: Date,
  ): Promise<[number, number, number, string[]]> {
    const dtcs = await this.dtcRepo
      .createQueryBuilder('d')
      .select(['d.timestamp', 'd.dtc_code'])
      .where('d.vehicle = :vid', { vid: vehicleId })
      .andWhere('d.timestamp >= :from', { from: d90 })
      .andWhere('d.timestamp <= :to', { to: snapshotDate })
      .getMany();

    const count7d  = dtcs.filter((d) => d.timestamp >= d7).length;
    const count30d = dtcs.filter((d) => d.timestamp >= d30).length;
    const count90d = dtcs.length;

    const recentCodes = dtcs
      .filter((d) => d.timestamp >= d7)
      .map((d) => d.dtc_code);

    return [count7d, count30d, count90d, recentCodes];
  }


  private async _maintenanceGaps(
    vehicleId: string,
    currentMileage: number,
    snapshotDate: Date,
  ): Promise<{
    km_since_oil_change: number;
    km_since_brake_service: number;
    km_since_battery_change: number;
    km_since_coolant_flush: number;
  }> {
    const records = await this.maintenanceRepo
      .createQueryBuilder('m')
      .where('m.vehicle = :vid', { vid: vehicleId })
      .andWhere('m.service_date <= :snap', {
        snap: snapshotDate.toISOString().slice(0, 10),
      })
      .orderBy('m.service_date', 'DESC')
      .getMany();

    const kmSince = (keywords: RegExp): number => {
      const match = records.find((r) => keywords.test(r.service_type));
      if (!match) return currentMileage;
      return currentMileage - (match.mileage_at_service_km ?? 0);
    };

    return {
      km_since_oil_change:     kmSince(/oil|huile|vidange/i),
      km_since_brake_service:  kmSince(/brake|frein/i),
      km_since_battery_change: kmSince(/battery|batterie/i),
      km_since_coolant_flush:  kmSince(/coolant|liquide.+refroid|flush/i),
    };
  }


  private async _detectComponentFromMaintenance(
    vehicleId: string,
    snapshotDate: Date,
  ): Promise<string | null> {
    const record = await this.maintenanceRepo
      .createQueryBuilder('m')
      .where('m.vehicle = :vid', { vid: vehicleId })
      .andWhere('m.service_date <= :snap', {
        snap: snapshotDate.toISOString().slice(0, 10),
      })
      .orderBy('m.service_date', 'DESC')
      .getOne();

    if (!record) return null;
    return detectComponentFromService(record.service_type);
  }

  

  private _daysAgo(from: Date, days: number): Date {
    const d = new Date(from);
    d.setDate(d.getDate() - days);
    return d;
  }
}