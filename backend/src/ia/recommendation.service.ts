import {
    Injectable,
    HttpException,
    HttpStatus,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import axios from 'axios'
import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity'
import { DtcEntry } from 'src/dtc/entities/dtc.entity'
import { MaintenanceRecord } from 'src/maintenance/entities/maintenance.entity'
import { FailureClassificationService } from 'src/ia/failureClassification.service'

const COMPONENTS = [
    'engine',
    'electrical',
    'transmission',
    'battery',
    'brakes',
    'fuel_system',
    'cooling_system',
]

@Injectable()
export class RecommendationService {
    constructor(
        @InjectRepository(SensorReading)
        private readonly sensorRepo: Repository<SensorReading>,

        @InjectRepository(DtcEntry)
        private readonly dtcRepo: Repository<DtcEntry>,

        @InjectRepository(MaintenanceRecord)
        private readonly maintenanceRepo: Repository<MaintenanceRecord>,

        private readonly failureService: FailureClassificationService,
    ) {}

    async getRecommendations(vehicleId: string, component?: string) {
        const latestSensor = await this.sensorRepo.findOne({
            where: { vehicle: { id: vehicleId } },
            order: { timestamp: 'DESC' },
        })

        if (!latestSensor) {
            throw new HttpException(
                'No sensor readings found',
                HttpStatus.NOT_FOUND,
            )
        }

        const obd2_data = {
            engine_rpm: clean(latestSensor.engine_rpm),
            vehicle_speed_kmh: clean(latestSensor.vehicle_speed_kmh),
            coolant_temp_c: clean(latestSensor.coolant_temp_c),
            intake_air_temp_c: clean(latestSensor.intake_air_temp_c),
            maf_airflow_gs: clean(latestSensor.maf_airflow_gs),
            throttle_position_pct: clean(latestSensor.throttle_position_pct),
            control_module_voltage_v: clean(latestSensor.control_module_voltage_v),
            engine_load_pct: clean(latestSensor.engine_load_pct),
            short_fuel_trim_pct: clean(latestSensor.short_fuel_trim_pct),
            long_fuel_trim_pct: clean(latestSensor.long_fuel_trim_pct),
        }


        const resolvedComponent =
            component ?? (await this._autoDetectComponent(vehicleId))

        const vehicle_data = await this.failureService.buildFeatures(
            vehicleId,
            resolvedComponent,
        )

        const dtcs = await this.dtcRepo.find({
            where: { vehicle: { id: vehicleId } },
            order: { timestamp: 'DESC' },
            take: 10,
        })

        const ecu_data = dtcs.map((d) => d.dtc_code).join(' ')

        const maintenance = await this.maintenanceRepo.find({
            where: { vehicle: { id: vehicleId } },
            order: { service_date: 'DESC' },
            take: 5,
        })

        const service_history = maintenance
            .map((m) => `${m.service_type} at ${m.mileage_at_service_km}km`)
            .join(' | ')

        const problems: string[] = []
        if (obd2_data.coolant_temp_c > 100) problems.push('engine overheating')
        if (obd2_data.control_module_voltage_v < 12) problems.push('low battery voltage')
        if (dtcs.length > 0) problems.push(`${dtcs.length} DTC codes detected`)

        const problem_description =
            problems.join(', ') || 'vehicle anomaly detected'

        const payload = {
            obd2_data,
            vehicle_data,
            component: resolvedComponent,
            problem_description,
            ecu_data,
            service_history,
            top_k: 5,
            enrich: true,
        }

        try {
            const response = await axios.post(`${process.env.IA_URL}/api/predict/recommend`, payload)
            return response.data
        } catch (error: any) {
            throw new HttpException(
                error?.response?.data || 'FastAPI recommendation failed',
                HttpStatus.BAD_GATEWAY,
            )
        }
    }

    async getAllRecommendations(vehicleId: string) {
        const latestSensor = await this.sensorRepo.findOne({
            where: { vehicle: { id: vehicleId } },
            order: { timestamp: 'DESC' },
        })

        if (!latestSensor) {
            throw new HttpException(
                'No sensor readings found',
                HttpStatus.NOT_FOUND,
            )
        }

        const obd2_data = {
            engine_rpm: clean(latestSensor.engine_rpm),
            vehicle_speed_kmh: clean(latestSensor.vehicle_speed_kmh),
            coolant_temp_c: clean(latestSensor.coolant_temp_c),
            intake_air_temp_c: clean(latestSensor.intake_air_temp_c),
            maf_airflow_gs: clean(latestSensor.maf_airflow_gs),
            throttle_position_pct: clean(latestSensor.throttle_position_pct),
            control_module_voltage_v: clean(latestSensor.control_module_voltage_v),
            engine_load_pct: clean(latestSensor.engine_load_pct),
            short_fuel_trim_pct: clean(latestSensor.short_fuel_trim_pct),
            long_fuel_trim_pct: clean(latestSensor.long_fuel_trim_pct),
        }

        const dtcs = await this.dtcRepo.find({
            where: { vehicle: { id: vehicleId } },
            order: { timestamp: 'DESC' },
            take: 10,
        })

        const ecu_data = dtcs.map((d) => d.dtc_code).join(' ')

        const maintenance = await this.maintenanceRepo.find({
            where: { vehicle: { id: vehicleId } },
            order: { service_date: 'DESC' },
            take: 5,
        })

        const service_history = maintenance
            .map((m) => `${m.service_type} at ${m.mileage_at_service_km}km`)
            .join(' | ')

        const problems: string[] = []
        if (obd2_data.coolant_temp_c > 100) problems.push('engine overheating')
        if (obd2_data.control_module_voltage_v < 12) problems.push('low battery voltage')
        if (dtcs.length > 0) problems.push(`${dtcs.length} DTC codes detected`)
        const problem_description = problems.join(', ') || 'vehicle anomaly detected'

        const allFeatures = await Promise.all(
            COMPONENTS.map((comp) =>
                this.failureService.buildFeatures(vehicleId, comp),
            ),
        )

        const highRiskComponents: string[] = []

        await Promise.all(
            allFeatures.map(async (features) => {
                try {
                    const riskRes = await axios.post(
                        `${process.env.IA_URL}/api/predict/risk`,
                        features,
                    )
                    const riskLevel = riskRes.data.risk_level ?? 'low_risk'
                    const riskScore =
                        riskRes.data.risk_probabilities?.high_risk ?? 0

                    if (riskLevel === 'high_risk' || riskScore >= 0.7) {
                        highRiskComponents.push(features.component)
                    }
                } catch {
                }
            }),
        )

        if (highRiskComponents.length === 0) {
            const autoComp = await this._autoDetectComponent(vehicleId)
            highRiskComponents.push(autoComp)
        }

        const recommendations = await Promise.all(
            highRiskComponents.map(async (comp) => {
                const vehicle_data = await this.failureService.buildFeatures(
                    vehicleId,
                    comp,
                )

                const payload = {
                    obd2_data,
                    vehicle_data,
                    component: comp,
                    problem_description,
                    ecu_data,
                    service_history,
                    top_k: 5,
                    enrich: true,
                }

                try {
                    const response = await axios.post(
                        `${process.env.IA_URL}/api/predict/recommend`,
                        payload,
                    )
                    return {
                        component: comp,
                        recommendations: response.data,
                    }
                } catch (error: any) {
                    return {
                        component: comp,
                        error: 'FastAPI recommendation failed',
                    }
                }
            }),
        )

        return {
            vehicleId,
            highRiskComponents,
            recommendations,
        }
    }

    private async _autoDetectComponent(vehicleId: string): Promise<string> {
        const base_features = await this.failureService.buildFeatures(vehicleId)

        try {
            const classification = await axios.post(
                `${process.env.IA_URL}/api/predict/risk`,
                base_features,
            )
            return classification.data.component?.toLowerCase() ?? 'engine'
        } catch {
            return 'engine'
        }
    }
}

function clean(value: any): number {
    const num = Number(value)
    return isFinite(num) ? num : 0
}