import { create } from 'zustand'

export type AnomalyNotif = {
    id: string
    vehicleId: string
    vehicleLabel?: string
    sensorReadingId: string
    timestamp: string
    score: number
    anomalyProbability: number
    readed: boolean
    createdAt: string
}

type Store = {
    anomalies: AnomalyNotif[]
    setAnomalies: (items: AnomalyNotif[]) => void
    addAnomalies: (items: AnomalyNotif[]) => void
    markAllRead: () => void
    markOneRead: (id: string) => void
}

export const useAnomalyNotificationStore = create<Store>((set, get) => ({
    anomalies: [],

    setAnomalies: (items) => set({ anomalies: items }),

    addAnomalies: (items) => {
        const existing = get().anomalies
        const newItems = items.filter(
            (item) => !existing.some((e) => e.sensorReadingId === item.sensorReadingId),
        )
        if (newItems.length === 0) return
        set((s) => ({ anomalies: [...newItems, ...s.anomalies] }))
    },

    markAllRead: () =>
        set((s) => ({
            anomalies: s.anomalies.map((a) => ({ ...a, readed: true })),
        })),

    markOneRead: (id) =>
        set((s) => ({
            anomalies: s.anomalies.map((a) =>
                a.id === id ? { ...a, readed: true } : a,
            ),
        })),
}))