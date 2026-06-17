import { useCallback, useState } from 'react'
import { useAnomalyNotificationStore, AnomalyNotif } from '@/store/useAnomalyNotificationStore'
import { apiGetAnomalies } from '@/services/AnomalyService'

export type ToastState = {
    visible: boolean
    count: number
    vehicleLabel?: string
}

export function useAnomalyDetection() {
    const addAnomalies = useAnomalyNotificationStore((s) => s.addAnomalies)

    const [toastState, setToastState] = useState<ToastState>({
        visible: false,
        count: 0,
    })

    const detectAfterUpload = useCallback(
        async (vehicleId: string, vehicleLabel?: string) => {
            try {
                // Appeler le backend — il détecte ET sauvegarde en base
                const res = await apiGetAnomalies(vehicleId)
                const results: any[] = Array.isArray(res) ? res : (res as any)?.data ?? []

                const anomalies = results.filter((r) => r.is_anomaly === true)
                if (anomalies.length === 0) return

                const mapped: AnomalyNotif[] = anomalies.map((a) => ({
                    id: a.sensorReadingId,
                    vehicleId,
                    vehicleLabel,
                    sensorReadingId: a.sensorReadingId ?? '',
                    timestamp: a.timestamp ?? new Date().toISOString(),
                    score: a.score ?? 0,
                    anomalyProbability: a.anomaly_probability ?? 0,
                    readed: false,
                    createdAt: new Date().toISOString(),
                }))

                addAnomalies(mapped)
                setToastState({ visible: true, count: mapped.length, vehicleLabel })
            } catch (err) {
                console.error('Anomaly detection failed', err)
            }
        },
        [addAnomalies],
    )

    const dismissToast = useCallback(() => {
        setToastState((s) => ({ ...s, visible: false }))
    }, [])

    return { detectAfterUpload, toastState, dismissToast }
}