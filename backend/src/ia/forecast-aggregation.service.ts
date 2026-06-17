import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity';
import { DtcEntry } from 'src/dtc/entities/dtc.entity';
import { MaintenanceRecord } from 'src/maintenance/entities/maintenance.entity';
import { Vehicle } from 'src/vehicle/entities/vehicle.entity';



export const N_FEATURES = 18;
export const SEQ_LEN = 30; // days

const MAKE_ENCODE: Record<string, number> = {
  'bmw': 0, 'dacia': 1, 'hyundai': 2, 'kia': 3,
  'mercedes': 4, 'peugeot': 5, 'renault': 6,
  'toyota': 7, 'volkswagen': 8,
};

const MODEL_ENCODE: Record<string, number> = {
  '118i': 0, '308': 1, 'accent': 2, 'c200': 3,
  'ceed': 4, 'clio': 5, 'corolla': 6, 'golf': 7,
  'logan': 8, 'megane': 9, 'polo': 10, 'rav4': 11,
  'tiguan': 12, 'tucson': 13,
};

function encodeMake(make: string): number {
  return MAKE_ENCODE[make.toLowerCase().trim()] ?? 6; // default: ford
}

function encodeModel(model: string): number {
  return MODEL_ENCODE[model.toLowerCase().trim().replace(/\s+/g, '')] ?? 13; // default: golf
}

// ─────────────────────────────────────────────────────────────────────────────

export interface DailyRow {
  date: string;        
  features: number[];     
}

export interface AggregationResult {
  vehicleId: string;
  anchor: number[];       
  sequence: number[][];   
  daysAvailable: number;
  missingDays: number;
}

@Injectable()
export class ForecastAggregationService {
  private readonly logger = new Logger(ForecastAggregationService.name);

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

  

  async buildSequence(vehicleId: string): Promise<AggregationResult> {
    const vehicle = await this.vehicleRepo.findOneOrFail({ where: { id: vehicleId } });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - SEQ_LEN - 1); // extra day for edge safety

    const [sensorByDay, dtcByDay, maintenanceHistory] = await Promise.all([
      this.aggregateSensorsByDay(vehicleId, startDate, endDate),
      this.aggregateDtcByDay(vehicleId, startDate, endDate),
      this.getMaintenanceSummary(vehicleId),
    ]);

    this.logger.log(`[DEBUG] vehicleId    = ${vehicleId}`);
    this.logger.log(`[DEBUG] startDate    = ${startDate.toISOString()}`);
    this.logger.log(`[DEBUG] endDate      = ${endDate.toISOString()}`);
    this.logger.log(`[DEBUG] sensorByDay  = ${sensorByDay.size} jours`);
    this.logger.log(`[DEBUG] dtcByDay     = ${dtcByDay.size} jours`);
    if (sensorByDay.size > 0) {
      this.logger.log(`[DEBUG] sensorByDay keys = ${[...sensorByDay.keys()].join(', ')}`);
    }

    const rows = this.buildDailyRows(
      vehicle,
      sensorByDay,
      dtcByDay,
      maintenanceHistory,
      startDate,
      endDate,
    );

    const sequence = this.normalizeSequenceLength(rows, N_FEATURES);

    const daysWithData = rows.filter((r) => r._hasData).length;

    this.logger.log(
      `Vehicle ${vehicleId}: ${daysWithData}/${SEQ_LEN} days with real sensor data`,
    );

    return {
      vehicleId,
      anchor: this.extractAnchor(rows),
      sequence: sequence.map((r) => r.features),
      daysAvailable: daysWithData,
      missingDays: SEQ_LEN - daysWithData,
    };
  }



  private async aggregateSensorsByDay(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, SensorDayAgg>> {
    const rows = await this.sensorRepo
      .createQueryBuilder('s')
      .select([
        `TO_CHAR(s.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD')       AS day`,
        `AVG(s.engine_rpm)                                          AS avg_rpm`,
        `AVG(s.vehicle_speed_kmh)                                   AS avg_speed`,
        `AVG(s.coolant_temp_c)                                      AS avg_coolant`,
        `MAX(s.coolant_temp_c)                                      AS max_coolant`,
        `AVG(s.intake_air_temp_c)                                   AS avg_intake`,
        `AVG(s.maf_airflow_gs)                                      AS avg_maf`,
        `AVG(s.throttle_position_pct)                               AS avg_throttle`,
        `AVG(s.engine_load_pct)                                     AS avg_load`,
        `AVG(s.short_fuel_trim_pct)                                 AS avg_stft`,
        `AVG(s.long_fuel_trim_pct)                                  AS avg_ltft`,
        `AVG(s.control_module_voltage_v)                            AS avg_voltage`,
        `AVG(s.ambient_temp_c)                                      AS avg_ambient`,
        `SUM(CASE WHEN s.vehicle_speed_kmh < 5 THEN 1 ELSE 0 END)  AS idle_readings`,
        `COUNT(*)                                                    AS reading_count`,
        `COUNT(*) * 10.0 / 3600.0                                   AS engine_hours_day`,
      ])
      .where('s."vehicleId" = :vehicleId', { vehicleId })
      .andWhere('s.timestamp >= :startDate', { startDate })
      .andWhere('s.timestamp <= :endDate', { endDate })
      .groupBy(`TO_CHAR(s.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
      .orderBy(`TO_CHAR(s.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, 'ASC')
      .getRawMany<SensorDayRaw>();

    const map = new Map<string, SensorDayAgg>();
    for (const r of rows) {
      const day = String(r.day).substring(0, 10);
      const readingCount = Number(r.reading_count) || 1;
      const idleReadings = Number(r.idle_readings) || 0;

      
      const avgSpeed = Number(r.avg_speed) || 0;
      const avgMaf = Number(r.avg_maf) || 0;
      const fuelConsumption =
        avgSpeed > 5 ? Math.min((avgMaf * 0.746) / avgSpeed, 25) : 0;

 
      const engineHoursDay = Number(r.engine_hours_day) || 0;
      const dailyKm = avgSpeed * engineHoursDay;

      const numTrips = Math.max(1, Math.round(readingCount / 360)); 

      const idleMinutes = (idleReadings * 10) / 60;

      map.set(day, {
        avgRpm: Number(r.avg_rpm) || 0,
        avgSpeed,
        avgCoolant: Number(r.avg_coolant) || 80,
        maxCoolant: Number(r.max_coolant) || 80,
        avgVoltage: Number(r.avg_voltage) || 12.6,
        avgAmbient: Number(r.avg_ambient) || 20,
        fuelConsumption,
        dailyKm,
        numTrips,
        idleMinutes,
        engineHoursDay,
        readingCount,
      });
    }
    return map;
  }



  private async aggregateDtcByDay(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, number>> {
    const rows = await this.dtcRepo
      .createQueryBuilder('d')
      .select([
        `TO_CHAR(d.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day`,
        `COUNT(*) AS dtc_count`,
      ])
      .where('d."vehicleId" = :vehicleId', { vehicleId })
      .andWhere('d.timestamp >= :startDate', { startDate })
      .andWhere('d.timestamp <= :endDate', { endDate })
      .groupBy(`TO_CHAR(d.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
      .getRawMany<{ day: string; dtc_count: string }>();

    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(String(r.day).substring(0, 10), Number(r.dtc_count));
    }
    return map;
  }



  private async getMaintenanceSummary(vehicleId: string): Promise<MaintenanceSummary> {
    const records = await this.maintenanceRepo
      .createQueryBuilder('m')
      .where('m."vehicleId" = :vehicleId', { vehicleId })
      .orderBy('m.service_date', 'DESC')
      .getMany();

    let lastOilKm = 0;
    let lastBrakeKm = 0;
    let lastBatteryKm = 0;
    let lastCoolantKm = 0;

    const currentMileage =
      (await this.vehicleRepo.findOneOrFail({ where: { id: vehicleId } }))
        .currentMileageKm;

    for (const rec of records) {
      const type = rec.service_type.toLowerCase();
      const km = rec.mileage_at_service_km;

      if (!lastOilKm && (type.includes('oil') || type.includes('vidange')))
        lastOilKm = currentMileage - km;
      if (!lastBrakeKm && (type.includes('brake') || type.includes('frein')))
        lastBrakeKm = currentMileage - km;
      if (!lastBatteryKm && type.includes('battery'))
        lastBatteryKm = currentMileage - km;
      if (!lastCoolantKm && (type.includes('coolant') || type.includes('radiateur')))
        lastCoolantKm = currentMileage - km;
    }

    const brakeHealthScore = Math.max(0, 100 - (lastBrakeKm / 50_000) * 100);

    return {
      kmSinceOilChange: lastOilKm,
      kmSinceBrakeService: lastBrakeKm,
      kmSinceBatteryChange: lastBatteryKm,
      kmSinceCoolantFlush: lastCoolantKm,
      brakeHealthScore,
    };
  }



  private buildDailyRows(
    vehicle: Vehicle,
    sensorByDay: Map<string, SensorDayAgg>,
    dtcByDay: Map<string, number>,
    maintenance: MaintenanceSummary,
    startDate: Date,
    endDate: Date,
  ): (DailyRow & { _hasData: boolean })[] {
    const makeEnc = encodeMake(vehicle.make);
    const modelEnc = encodeModel(vehicle.model);
    const year = vehicle.year;

  
    const days: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      days.push(cursor.toISOString().substring(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }


    const window = days.slice(-SEQ_LEN);

    let lastSensor: SensorDayAgg = defaultSensor();

    return window.map((date) => {
      const sensor = sensorByDay.get(date);
      const hasData = !!sensor;

      if (hasData) lastSensor = sensor!;
      const s = hasData ? sensor! : lastSensor; 

      const dtcCount = dtcByDay.get(date) ?? 0;

     
      const features: number[] = [
        makeEnc,                       
        modelEnc,                    
        year,                         
        s.dailyKm,                     
        s.numTrips,                   
        s.avgRpm,                      
        s.avgSpeed,                    
        s.fuelConsumption,            
        maintenance.brakeHealthScore,  
        dtcCount,                      
        0,                             // 10 hard_braking_events (unavailable)
        0,                             // 11 rapid_acceleration_events (unavailable)
        s.idleMinutes,                 // 12 idle_minutes
        s.engineHoursDay,              // 13 engine_hours
        s.avgAmbient,                  // 14 ambient_temp_c
        s.avgCoolant,                  // 15 avg_coolant_temp_c
        s.maxCoolant,                  // 16 max_coolant_temp_c
        s.avgVoltage,                  // 17 avg_battery_voltage_v
      ];

      return { date, features, _hasData: hasData };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  private normalizeSequenceLength(
    rows: (DailyRow & { _hasData: boolean })[],
    nFeatures: number,
  ): (DailyRow & { _hasData: boolean })[] {
    if (rows.length >= SEQ_LEN) return rows.slice(-SEQ_LEN);

    // Pad left with zeros if fewer than SEQ_LEN days exist
    const padding = SEQ_LEN - rows.length;
    const zeroRow = (i: number): DailyRow & { _hasData: boolean } => ({
      date: `pad_${i}`,
      features: new Array(nFeatures).fill(0),
      _hasData: false,
    });

    return [
      ...Array.from({ length: padding }, (_, i) => zeroRow(i)),
      ...rows,
    ];
  }

  // anchor = last known real values for the 5 GRU target sensors
  // [avg_battery_voltage_v, fuel_consumption_l100km, avg_coolant_temp_c, avg_speed_kmh, idle_minutes]
  private extractAnchor(rows: (DailyRow & { _hasData: boolean })[]): number[] {
    // Walk backward to find last row with real data
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i]._hasData) {
        const f = rows[i].features;
        return [
          f[17], // avg_battery_voltage_v
          f[7],  // fuel_consumption_l100km
          f[15], // avg_coolant_temp_c
          f[6],  // avg_speed_kmh
          f[12], // idle_minutes
        ];
      }
    }
    return [12.6, 8.0, 85.0, 50.0, 20.0]; // safe defaults
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface SensorDayRaw {
  day: string;
  avg_rpm: string;
  avg_speed: string;
  avg_coolant: string;
  max_coolant: string;
  avg_intake: string;
  avg_maf: string;
  avg_throttle: string;
  avg_load: string;
  avg_stft: string;
  avg_ltft: string;
  avg_voltage: string;
  avg_ambient: string;
  idle_readings: string;
  reading_count: string;
  engine_hours_day: string;
}

interface SensorDayAgg {
  avgRpm: number;
  avgSpeed: number;
  avgCoolant: number;
  maxCoolant: number;
  avgVoltage: number;
  avgAmbient: number;
  fuelConsumption: number;
  dailyKm: number;
  numTrips: number;
  idleMinutes: number;
  engineHoursDay: number;
  readingCount: number;
}

interface MaintenanceSummary {
  kmSinceOilChange: number;
  kmSinceBrakeService: number;
  kmSinceBatteryChange: number;
  kmSinceCoolantFlush: number;
  brakeHealthScore: number;
}

function defaultSensor(): SensorDayAgg {
  return {
    avgRpm: 800, avgSpeed: 0, avgCoolant: 80, maxCoolant: 80,
    avgVoltage: 12.6, avgAmbient: 20, fuelConsumption: 0,
    dailyKm: 0, numTrips: 0, idleMinutes: 0, engineHoursDay: 0,
    readingCount: 0,
  };
}