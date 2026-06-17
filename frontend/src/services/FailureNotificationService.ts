import ApiService from './ApiService'

export type FailureNotifApi = {
    id: string
    vehicleId: string
    vehicleLabel?: string
    component: string
    riskScore: number
    riskLevel: string
    readed: boolean
    createdAt: string
}

export const apiGetFailureNotifications = () =>
    ApiService.fetchDataWithAxios<FailureNotifApi[]>({
        url: '/failure-notifications',
        method: 'get',
    })

export const apiMarkAllFailuresRead = () =>
    ApiService.fetchDataWithAxios<void>({
        url: '/failure-notifications/mark-all-read',
        method: 'patch',
    })

export const apiMarkOneFailureRead = (id: string) =>
    ApiService.fetchDataWithAxios<void>({
        url: `/failure-notifications/${id}/read`,
        method: 'patch',
    })

export const apiClassifyFailures = (vehicleId: string) =>
    ApiService.fetchDataWithAxios<any[]>({
        url: `/failure-classification/${vehicleId}`,
        method: 'get',
    })

export const apiNotifyHighRisk = (vehicleId: string) =>
    ApiService.fetchDataWithAxios<{ notified: number }>({
        url: `/failure-classification/${vehicleId}/notify`,
        method: 'post',
    })    