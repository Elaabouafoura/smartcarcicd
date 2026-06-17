import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ForecastAggregationService, SEQ_LEN, N_FEATURES } from './forecast-aggregation.service';

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export interface ForecastTarget {
  label: string;
  unit: string;
  anchor: number;
  values: number[];       // 14 daily predictions
  alertThreshold: number;
  alertDirection: 'above' | 'below';
}

export interface ForecastDay {
  day: number;            // 1..14
  date: string;           // ISO date
  avg_battery_voltage_v: number;
  fuel_consumption_l100km: number;
  avg_coolant_temp_c: number;
  avg_speed_kmh: number;
  idle_minutes: number;
  alerts: string[];       // human-readable alert strings for this day
}

export interface ForecastResult {
  vehicleId: string;
  generatedAt: string;
  horizon: number;
  daysAvailable: number;
  missingDays: number;
  targets: ForecastTarget[];
  timeline: ForecastDay[];
  globalAlerts: string[];
}


const THRESHOLDS: Record<
  string,
  { value: number; direction: 'above' | 'below'; label: string; unit: string }
> = {
  avg_battery_voltage_v:    { value: 13.8,  direction: 'below', label: 'Battery Voltage',       unit: 'V'       },
  fuel_consumption_l100km:  { value: 12.0,  direction: 'above', label: 'Fuel Consumption',      unit: 'L/100km' },
  avg_coolant_temp_c:       { value: 105.0, direction: 'above', label: 'Coolant Temp',           unit: '°C'      },
  avg_speed_kmh:            { value: 20.0,  direction: 'below', label: 'Avg Speed',              unit: 'km/h'    },
  idle_minutes:             { value: 120.0, direction: 'above', label: 'Idle Minutes',           unit: 'min'     },
};

const TARGET_KEYS = [
  'avg_battery_voltage_v',
  'fuel_consumption_l100km',
  'avg_coolant_temp_c',
  'avg_speed_kmh',
  'idle_minutes',
] as const;

type TargetKey = (typeof TARGET_KEYS)[number];

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);
  private readonly fastapiBase: string;
  private readonly horizon = 14;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly aggregation: ForecastAggregationService,
  ) {
    this.fastapiBase = this.config.get<string>('IA_URL', 'http://ia:8000');
  }


  async getForecast(vehicleId: string): Promise<ForecastResult> {
    this.logger.log(`[Forecast] Aggregating data for vehicle ${vehicleId}`);
    const agg = await this.aggregation.buildSequence(vehicleId);

    this.logger.debug(
      `[Forecast] Sequence shape: (${agg.sequence.length}, ${agg.sequence[0]?.length ?? 0}) ` +
      `| Days with data: ${agg.daysAvailable}/${SEQ_LEN}`,
    );

   
    if (
      agg.sequence.length !== SEQ_LEN ||
      agg.sequence.some((row) => row.length !== N_FEATURES)
    ) {
      throw new HttpException(
        `Invalid sequence shape: expected (${SEQ_LEN}, ${N_FEATURES}), ` +
        `got (${agg.sequence.length}, ${agg.sequence[0]?.length})`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

  
    this.logger.log(`[Forecast] Calling FastAPI at ${this.fastapiBase}/api/predict/forecast`);
    let fastApiResponse: FastApiForcastResponse;

    try {
      const { data } = await firstValueFrom(
        this.http.post<FastApiForcastResponse>(
          `${this.fastapiBase}/api/predict/forecast`,
          { data: agg.sequence },
          { timeout: 30_000 },
        ),
      );
      fastApiResponse = data;
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'FastAPI unreachable';
      this.logger.error(`[Forecast] FastAPI error: ${detail}`);
      throw new HttpException(
        `Forecast service error: ${detail}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

 
    return this.shapeResponse(vehicleId, agg.anchor, fastApiResponse, agg.daysAvailable, agg.missingDays);
  }

  

  private shapeResponse(
    vehicleId: string,
    anchor: number[],
    raw: FastApiForcastResponse,
    daysAvailable: number = 0,
    missingDays: number = 0,
  ): ForecastResult {
    const prediction: number[][] = raw.prediction;

    const globalAlerts: string[] = [];

    const targets: ForecastTarget[] = TARGET_KEYS.map((key, idx) => {
      const thr = THRESHOLDS[key];
      const values = prediction.map((day) => parseFloat(day[idx].toFixed(3)));
      return {
        label: thr.label,
        unit: thr.unit,
        anchor: parseFloat(anchor[idx].toFixed(3)),
        values,
        alertThreshold: thr.value,
        alertDirection: thr.direction,
      };
    });

    const today = new Date();
    const timeline: ForecastDay[] = prediction.map((dayValues, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i + 1);

      const dayAlerts: string[] = [];

      TARGET_KEYS.forEach((key, idx) => {
        const thr = THRESHOLDS[key];
        const val = dayValues[idx];
        const breached =
          thr.direction === 'above' ? val > thr.value : val < thr.value;

        if (breached) {
          const msg =
            `${thr.label} ${thr.direction === 'above' ? '>' : '<'} ` +
            `${thr.value} ${thr.unit} on day ${i + 1} (predicted: ${val.toFixed(2)})`;
          dayAlerts.push(msg);
          if (!globalAlerts.includes(msg)) globalAlerts.push(msg);
        }
      });

      return {
        day: i + 1,
        date: date.toISOString().substring(0, 10),
        avg_battery_voltage_v:   parseFloat(dayValues[0].toFixed(3)),
        fuel_consumption_l100km: parseFloat(dayValues[1].toFixed(3)),
        avg_coolant_temp_c:      parseFloat(dayValues[2].toFixed(3)),
        avg_speed_kmh:           parseFloat(dayValues[3].toFixed(3)),
        idle_minutes:            parseFloat(dayValues[4].toFixed(3)),
        alerts: dayAlerts,
      };
    });

    return {
      vehicleId,
      generatedAt: new Date().toISOString(),
      horizon: this.horizon,
      daysAvailable,
      missingDays,
      targets,
      timeline,
      globalAlerts,
    };
  }
}



interface FastApiForcastResponse {
  anchor: number[][];       
  prediction: number[][]; 
}