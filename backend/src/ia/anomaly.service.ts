import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import axios from 'axios'
import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity'
import { AnomalyNotificationService } from 'src/anomaly-notification/anomaly-notification.service'
import { Vehicle } from 'src/vehicle/entities/vehicle.entity'

@Injectable()
export class AnomalyService {
    constructor(
        @InjectRepository(SensorReading)
        private readonly sensorRepo: Repository<SensorReading>,

        @InjectRepository(Vehicle)
        private readonly vehicleRepo: Repository<Vehicle>,

        private readonly anomalyNotificationService: AnomalyNotificationService,
    ) {}

    async detectVehicleAnomalies(vehicleId: string) {
        const readings = await this.sensorRepo.find({
            where: { vehicle: { id: vehicleId } },
            order: { timestamp: 'DESC' },
            take: 20,
        })

        const results: any[] = []
        const toSave: any[] = []

        // Récupérer le label du véhicule
        const vehicle = await this.vehicleRepo.findOne({
            where: { id: vehicleId },
        })

        const vehicleLabel = vehicle
            ? `${(vehicle as any).make ?? ''} ${(vehicle as any).model ?? ''} - ${(vehicle as any).plateNumber ?? ''}`.trim()
            : undefined

        for (const reading of readings) {
            const payload = {
                timestamp: reading.timestamp?.toISOString?.() || new Date().toISOString(),
                engine_rpm: clean(reading.engine_rpm),
                vehicle_speed_kmh: clean(reading.vehicle_speed_kmh),
                coolant_temp_c: clean(reading.coolant_temp_c),
                intake_air_temp_c: clean(reading.intake_air_temp_c),
                maf_airflow_gs: clean(reading.maf_airflow_gs),
                throttle_position_pct: clean(reading.throttle_position_pct),
                control_module_voltage_v: clean(reading.control_module_voltage_v),
                engine_load_pct: clean(reading.engine_load_pct),
                short_fuel_trim_pct: clean(reading.short_fuel_trim_pct),
                long_fuel_trim_pct: clean(reading.long_fuel_trim_pct),
            }

            try {
                const response = await axios.post(`${process.env.IA_URL}/api/predict/anomaly`, payload)

                const result = {
                    sensorReadingId: reading.id,
                    timestamp: reading.timestamp,
                    prediction: response.data.prediction,
                    score: response.data.score,
                    is_anomaly: response.data.is_anomaly,
                    anomaly_probability: response.data.anomaly_probability,
                }

                results.push(result)

                // Collecter les anomalies à sauvegarder
                if (response.data.is_anomaly === true) {
                    toSave.push({
                        vehicleId,
                        vehicleLabel,
                        sensorReadingId: reading.id,
                        timestamp: reading.timestamp?.toISOString(),
                        score: response.data.score,
                        anomalyProbability: response.data.anomaly_probability,
                    })
                }
            } catch (error) {
                results.push({
                    sensorReadingId: reading.id,
                    error: 'FastAPI prediction failed',
                })
            }
        }

        // Sauvegarder toutes les anomalies en base (sans doublons)
        if (toSave.length > 0) {
            await this.anomalyNotificationService.createMany(toSave)
        }

        return results
    }
}

function clean(value: any): number {
    const num = Number(value)
    if (!isFinite(num)) return 0
    return num
}