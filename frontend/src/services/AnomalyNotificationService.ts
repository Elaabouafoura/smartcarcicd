import ApiService from './ApiService'

export type AnomalyNotifApi = {
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

export const apiGetAnomalyNotifications = () =>
    ApiService.fetchDataWithAxios<AnomalyNotifApi[]>({
        url: '/anomaly-notifications',
        method: 'get',
    })

export const apiMarkAllAnomaliesRead = () =>
    ApiService.fetchDataWithAxios({
        url: '/anomaly-notifications/mark-all-read',
        method: 'patch',
    })

export const apiMarkOneAnomalyRead = (id: string) =>
    ApiService.fetchDataWithAxios({
        url: `/anomaly-notifications/${id}/read`,
        method: 'patch',
    })

export const apiDeleteAnomalyNotification = (id: string) =>
    ApiService.fetchDataWithAxios({
        url: `/anomaly-notifications/${id}`,
        method: 'delete',
    })