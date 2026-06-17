import { create } from 'zustand'

export type FailureNotif = {
    id: string
    vehicleId: string
    vehicleLabel?: string
    component: string
    riskScore: number
    riskLevel: string
    readed: boolean
    createdAt: string
}

type Store = {
    failures: FailureNotif[]
    setFailures: (items: FailureNotif[]) => void
    addFailures: (items: FailureNotif[]) => void
    markAllRead: () => void
    markOneRead: (id: string) => void
}

export const useFailureNotificationStore = create<Store>((set, get) => ({
    failures: [],

    setFailures: (items) => set({ failures: items }),

    addFailures: (items) => {
        const existing = get().failures
        const newItems = items.filter(
            (item) =>
                !existing.some(
                    (e) =>
                        e.vehicleId === item.vehicleId &&
                        e.component === item.component,
                ),
        )
        if (newItems.length === 0) return
        set((s) => ({ failures: [...newItems, ...s.failures] }))
    },

    markAllRead: () =>
        set((s) => ({
            failures: s.failures.map((f) => ({ ...f, readed: true })),
        })),

    markOneRead: (id) =>
        set((s) => ({
            failures: s.failures.map((f) =>
                f.id === id ? { ...f, readed: true } : f,
            ),
        })),
}))