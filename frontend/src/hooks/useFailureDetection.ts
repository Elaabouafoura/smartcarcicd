import { useCallback, useState } from 'react'
import {
    useFailureNotificationStore,
    FailureNotif,
} from '@/store/useFailureNotificationStore'
import {
    apiClassifyFailures,
    apiNotifyHighRisk,
} from '@/services/FailureNotificationService'

export type FailureToastState = {
    visible: boolean
    count: number
    components: string[]
    vehicleLabel?: string
}

export function useFailureDetection() {
    const addFailures = useFailureNotificationStore((s) => s.addFailures)

    const [toastState, setToastState] = useState<FailureToastState>({
        visible: false,
        count: 0,
        components: [],
    })

    const detectAfterUpload = useCallback(
        async (vehicleId: string, vehicleLabel?: string) => {
            console.log('detectAfterUpload called for vehicleId:', vehicleId)

            try {
                const res = await apiClassifyFailures(vehicleId)
                console.log('=== FAILURE RESULTS ===', JSON.stringify(res, null, 2))

                const results: any[] = Array.isArray(res)
                    ? res
                    : (res as any)?.data ?? []

                const highRisk = results.filter(
                    (r) =>
                        r.risk_level === 'high_risk' ||
                        r.risk_level === 'high' ||
                        (r.risk_probabilities?.high_risk ?? 0) >= 0.7,
                )

                console.log('highRisk filtered:', highRisk)

                if (highRisk.length === 0) {
                    console.log('No high risk detected')
                    return
                }

                const mapped: FailureNotif[] = highRisk.map((r) => ({
                    id: crypto.randomUUID(),
                    vehicleId,
                    vehicleLabel,
                    component: r.component,
                    riskScore: r.risk_probabilities?.high_risk ?? r.risk_score ?? 0,
                    riskLevel: r.risk_level ?? 'high_risk',
                    readed: false,
                    createdAt: new Date().toISOString(),
                }))

                addFailures(mapped)

                // Déclencher l'envoi d'email
                try {
                    await apiNotifyHighRisk(vehicleId)
                } catch (err) {
                    console.error('notify error:', err)
                }

                setToastState({
                    visible: true,
                    count: mapped.length,
                    components: mapped.map((m) => m.component),
                    vehicleLabel,
                })
            } catch (err) {
                console.error('Failure classification failed', err)
            }
        },
        [addFailures],
    )

    const dismissToast = useCallback(() => {
        setToastState((s) => ({ ...s, visible: false }))
    }, [])

    return { detectAfterUpload, toastState, dismissToast }
}