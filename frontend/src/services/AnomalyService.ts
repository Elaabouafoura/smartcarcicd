import ApiService from './ApiService'

export const apiGetAnomalies = (vehicleId: string) =>
    ApiService.fetchDataWithAxios<any[]>({
        url: `/anomaly/${vehicleId}`,
        method: 'get',
    })
async function apiGetMyVehicles() {
    return ApiService.fetchDataWithAxios<any>({
        url: '/vehicles',   
        method: 'get',
    })
}

export const apiGetFailureClassification = (vehicleId: string) =>
    ApiService.fetchDataWithAxios<any[]>({
        url: `/failure-classification/${vehicleId}`,
        method: 'get',
    })

export const apiGetFailureClassificationByComponent = (
    vehicleId: string,
    component: string,
) =>
    ApiService.fetchDataWithAxios<any>({
        url: `/failure-classification/${vehicleId}/${component}`,
        method: 'get',
    })
   




export const apiGetAllRecommendations = (vehicleId: string) =>
    ApiService.fetchDataWithAxios<{
        vehicleId: string
        highRiskComponents: string[]
        recommendations: Array<{
            component: string
            recommendations?: any
            error?: string
        }>
    }>({
        url: `/recommendation/${vehicleId}/all`,
        method: 'get',
    })

export const apiGetRecommendation = (vehicleId: string, component?: string) =>
    ApiService.fetchDataWithAxios<any>({
        url: component
            ? `/recommendation/${vehicleId}?component=${component}`
            : `/recommendation/${vehicleId}`,
        method: 'get',
    })    