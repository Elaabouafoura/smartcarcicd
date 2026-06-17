import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common'
import { FailureClassificationService } from './failureClassification.service'
import { FailureNotificationService } from 'src/failure-notification/failure-notification.service'
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('failure-classification')
export class FailureClassificationController {
    constructor(
        private readonly failureService: FailureClassificationService,
        private readonly failureNotifService: FailureNotificationService,
    ) {}

    @Get(':vehicleId/predict')
    async predict(@Param('vehicleId') vehicleId: string) {
        const features = await this.failureService.buildFeatures(vehicleId, null)

        const response = await fetch(`${process.env.IA_URL}/api/predict/risk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features),
        })

        const result = await response.json()

        return { features, prediction: result }
    }

    @Get(':vehicleId')
    async classifyAll(@Param('vehicleId') vehicleId: string) {
        const allFeatures = await this.failureService.buildFeaturesAllComponents(vehicleId)
        const results: any[] = []

        for (const features of allFeatures) {
            try {
                const response = await fetch(
                    `${process.env.IA_URL}/api/predict/risk`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(features),
                    },
                )

                const result = await response.json()

                console.log(`[${features.component}]`, JSON.stringify(result))

                const riskLevel = result.risk_level ?? 'low_risk'
                const riskScore =
                    result.risk_probabilities?.high_risk ??
                    result.risk_score ??
                    0

                results.push({
                    component: features.component,
                    risk_score: riskScore,
                    risk_level: riskLevel,
                    risk_probabilities: result.risk_probabilities,
                    fault_type: result.fault_type,
                    fault_probabilities: result.fault_probabilities,
                })
            } catch (error) {
                console.error(`[${features.component}] prediction failed:`, error)
                results.push({
                    component: features.component,
                    error: 'FastAPI prediction failed',
                })
            }
        }

        return results
    }

    @Post(':vehicleId/notify')
    async notifyHighRisk(
        @Param('vehicleId') vehicleId: string,
        @Req() req: any,
    ) {
        const allFeatures = await this.failureService.buildFeaturesAllComponents(vehicleId)
        const toSave: any[] = []

        for (const features of allFeatures) {
            try {
                const response = await fetch(
                    `${process.env.IA_URL}/api/predict/risk`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(features),
                    },
                )

                const result = await response.json()

                const riskLevel = result.risk_level ?? 'low_risk'
                const riskScore =
                    result.risk_probabilities?.high_risk ??
                    result.risk_score ??
                    0

                if (riskLevel === 'high_risk' || riskScore >= 0.7) {
                    toSave.push({
                        vehicleId,
                        vehicleLabel: undefined,
                        component: features.component,
                        riskScore,
                        riskLevel,
                        userId: req.user.id,
                    })
                }
            } catch (error) {
                console.error(`[${features.component}] notify check failed:`, error)
            }
        }

        console.log('toSave:', JSON.stringify(toSave))

        if (toSave.length > 0) {
            await this.failureNotifService.createMany(toSave)
        }

        return { notified: toSave.length }
    }
}