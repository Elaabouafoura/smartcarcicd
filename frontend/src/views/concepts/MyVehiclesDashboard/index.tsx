import { useMemo, useState } from 'react'
import useSWR from 'swr'
import cloneDeep from 'lodash/cloneDeep'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Tooltip from '@/components/ui/Tooltip'
import Dialog from '@/components/ui/Dialog'
import Drawer from '@/components/ui/Drawer'
import Progress from '@/components/ui/Progress'
import Spinner from '@/components/ui/Spinner'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import DataTable from '@/components/shared/DataTable'
import { useNavigate } from 'react-router'
import {
    TbCar,
    TbEye,
    TbPencil,
    TbUpload,
    TbDownload,
    TbBrain,
    TbAlertTriangle,
    TbTool,
    TbArrowRight,
    TbShieldCheck,
    TbChevronRight,
} from 'react-icons/tb'
import type { ColumnDef, OnSortParam } from '@/components/shared/DataTable'
import type { TableQueries } from '@/@types/common'
import {
    apiGetMyVehicles,
    type VehicleListItem,
    type VehiclePaginatedResponse,
} from '@/services/DashboardService'
import ApiService from '@/services/ApiService'

// ── Types ──────────────────────────────────────────────────────
type Recommendation = {
    rank: number
    final_score: number
    urgency: string
    component: string
    problem_description: string
    diagnosis: string
    action: string
    repair_status: string
    results: string
    car_name: string
    confidence: number
    estimated_cost: string
    reasoning: string
    coherence: number
    _ml_risk_score?: number
    _risk_proba?: number
    _composite_score?: number
}

type ComponentResult = {
    component: string
    recommendations: {
        anomaly_prob: number
        risk_label: string
        risk_proba: number
        risk_probabilities: Record<string, number>
        fault_label: string
        fault_proba: number
        ml_risk_score: number
        triggered: boolean
        recommendations: Recommendation[]
    }
}

type RecommendationResponse = {
    vehicleId: string
    highRiskComponents: string[]
    recommendations: ComponentResult[]
}

type UploadItem = {
    id: string
    filename: string
    status: 'processing' | 'success' | 'failed'
    row_count?: number
    created_at?: string
    downloadUrl?: string
}

type UploadPaginatedResponse = {
    data: UploadItem[]
    total: number
    page: number
    totalPages: number
}

// ── Constants ──────────────────────────────────────────────────
const COMPONENT_LABELS: Record<string, string> = {
    engine: 'Moteur',
    electrical: 'Electrical',
    transmission: 'Transmission',
    battery: 'Batterie',
    brakes: 'Freins',
    fuel_system: 'Fuel system',
    cooling_system: 'Refroidissement',
}

const URGENCY_CONFIG: Record<
    string,
    { bg: string; text: string; border: string; label: string }
> = {
    HIGH: {
        bg: 'bg-red-50 dark:bg-red-900/10',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        label: 'Urgent',
    },
    MEDIUM: {
        bg: 'bg-amber-50 dark:bg-amber-900/10',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        label: 'Medium',
    },
    LOW: {
        bg: 'bg-blue-50 dark:bg-blue-900/10',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
        label: 'Low',
    },
}

// ── Helpers ────────────────────────────────────────────────────
const getUrgencyKey = (urgency: string) => {
    if (urgency.includes('HIGH')) return 'HIGH'
    if (urgency.includes('MEDIUM')) return 'MEDIUM'
    return 'LOW'
}

const normalizeUrgency = (urgency: string): string =>
    urgency.replace(/[^\w\s]/g, '').trim().toUpperCase()

const compositeScore = (mlRisk: number, riskProba: number, finalScore: number): number =>
    mlRisk * 0.4 + riskProba * 0.35 + finalScore * 0.25

const flattenRecs = (data: RecommendationResponse): Recommendation[] => {
    const all = data.recommendations.flatMap((r) =>
        (r.recommendations?.recommendations ?? []).map((rec) => ({
            ...rec,
            urgency: normalizeUrgency(rec.urgency),
            _ml_risk_score: r.recommendations.ml_risk_score,
            _risk_proba: r.recommendations.risk_proba,
            _composite_score: compositeScore(
                r.recommendations.ml_risk_score,
                r.recommendations.risk_proba,
                rec.final_score,
            ),
        })),
    )
    const byAction = new Map<string, Recommendation>()
    for (const rec of all) {
        const key = rec.action.trim().toLowerCase()
        const existing = byAction.get(key)
        if (!existing || (rec._composite_score ?? 0) > (existing._composite_score ?? 0)) {
            byAction.set(key, rec)
        }
    }
    return Array.from(byAction.values()).sort(
        (a, b) => (b._composite_score ?? 0) - (a._composite_score ?? 0),
    )
}

// ── API ────────────────────────────────────────────────────────
const apiGetUploadsByVehicle = async <
    T,
    U extends { vehicleId: string; page: number; limit: number },
>(
    params: U,
) =>
    ApiService.fetchDataWithAxios<T>({
        url: `/uploads/vehicle/${params.vehicleId}`,
        method: 'get',
        params: { page: params.page, limit: params.limit },
    })

const fetchRecommendations = (vehicleId: string) =>
    ApiService.fetchDataWithAxios<RecommendationResponse>({
        url: `/recommendation/${vehicleId}/all`,
        method: 'get',
    })

// ── AI Drawer ─────────────────────────────────────────────────
const AiDrawer = ({
    vehicle,
    isOpen,
    onClose,
}: {
    vehicle: VehicleListItem | null
    isOpen: boolean
    onClose: () => void
}) => {
    const navigate = useNavigate()

    const { data, isLoading, error } = useSWR(
        vehicle && isOpen ? [`/recommendation/${vehicle.id}/all`] : null,
        () => fetchRecommendations(vehicle!.id),
        { revalidateOnFocus: false },
    )

    const recommendations: RecommendationResponse | null = data
        ? Array.isArray(data)
            ? { vehicleId: vehicle!.id, highRiskComponents: [], recommendations: data as ComponentResult[] }
            : (data as RecommendationResponse)
        : null

    const topRecs = recommendations ? flattenRecs(recommendations).slice(0, 3) : []
    const highRisk = recommendations?.highRiskComponents?.length ?? 0
    const urgentCount = topRecs.filter((r) => r.urgency.includes('HIGH') && !r.urgency.includes('MEDIUM')).length
    const totalRecs = recommendations
        ? recommendations.recommendations.reduce(
              (sum, r) => sum + (r.recommendations?.recommendations?.length ?? 0),
              0,
          )
        : 0

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            onRequestClose={onClose}
            placement="right"
            width={400}
            title={
                vehicle ? (
                    <div>
                        <div className="flex items-center gap-2">
                            <TbBrain className="text-primary" size={18} />
                            <span className="font-semibold text-base">
                                AI recommendations
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 font-normal mt-0.5">
                            {vehicle.make} {vehicle.model} · {vehicle.plateNumber}
                        </p>
                    </div>
                ) : (
                    'AI recommendations'
                )
            }
        >
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Spinner size={36} />
                    <p className="text-sm text-gray-500">ML analysis in progress…</p>
                </div>
            )}

            {error && !isLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <TbAlertTriangle size={36} className="text-red-400" />
                    <p className="text-sm text-gray-500 text-center">
                        No data available. Please upload sensor, DTC and maintenance files.
                    </p>
                </div>
            )}

            {recommendations && !isLoading && (
                <div className="flex flex-col gap-5">
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-3 text-center">
                            <div className="text-xl font-semibold text-red-600 dark:text-red-400">
                                {highRisk}
                            </div>
                            <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                                At risk
                            </div>
                        </div>
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3 text-center">
                            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                                {urgentCount}
                            </div>
                            <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                                Urgent
                            </div>
                        </div>
                        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3 text-center">
                            <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                                {totalRecs}
                            </div>
                            <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                                Total
                            </div>
                        </div>
                    </div>

                    {/* Top recs */}
                    {topRecs.length > 0 ? (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                Top priorities
                            </p>
                            <div className="flex flex-col gap-2">
                                {topRecs.map((rec, i) => {
                                    const uk = getUrgencyKey(rec.urgency)
                                    const cfg = URGENCY_CONFIG[uk]
                                    return (
                                        <div
                                            key={i}
                                            className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <span
                                                        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                                                    >
                                                        {cfg.label}
                                                    </span>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                                                        {rec.action}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                        <TbTool size={12} />
                                                        {COMPONENT_LABELS[rec.component] ?? rec.component}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                                        {rec.estimated_cost}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {((rec._composite_score ?? rec.final_score) * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <TbShieldCheck size={36} className="text-emerald-400" />
                            <p className="text-sm text-gray-500">Aucun risque élevé détecté.</p>
                        </div>
                    )}

                    {/* CTA to full page */}
                    <Button
                        variant="solid"
                        className="w-full"
                        icon={<TbArrowRight />}
                        onClick={() => {
                            onClose()
                            navigate(`/concepts/vehicles/recommendation/${vehicle!.id}`)
                        }}
                    >
                        View full action plan
                    </Button>
                </div>
            )}
        </Drawer>
    )
}

// ── Sub-components ─────────────────────────────────────────────
const VehicleColumn = ({
    row,
    onPhotoClick,
}: {
    row: VehicleListItem
    onPhotoClick: (vehicle: VehicleListItem) => void
}) => (
    <div className="flex items-center gap-2">
        <button
            type="button"
            className="rounded-full"
            onClick={(e) => {
                e.stopPropagation()
                onPhotoClick(row)
            }}
            title="Show uploaded files"
        >
            <Avatar
                size={50}
                className="cursor-pointer transition-opacity hover:opacity-80"
                {...(row.photoUrl ? { src: row.photoUrl } : { icon: <TbCar /> })}
            />
        </button>
        <div>
            <div className="font-bold heading-text">
                {row.make} {row.model}
            </div>
            <div className="text-xs text-gray-500">{row.plateNumber}</div>
        </div>
    </div>
)

const ActionColumn = ({
    onView,
    onEdit,
    onUpload,
    onAI,
}: {
    onView: () => void
    onEdit: () => void
    onUpload: () => void
    onAI: () => void
}) => (
    <div className="flex items-center justify-end gap-3">
        <Tooltip title="View">
            <button
                type="button"
                className="cursor-pointer select-none text-xl"
                onClick={(e) => { e.stopPropagation(); onView() }}
            >
                <TbEye />
            </button>
        </Tooltip>
        <Tooltip title="Edit">
            <button
                type="button"
                className="cursor-pointer select-none text-xl"
                onClick={(e) => { e.stopPropagation(); onEdit() }}
            >
                <TbPencil />
            </button>
        </Tooltip>
        <Tooltip title="Upload files">
            <button
                type="button"
                className="cursor-pointer select-none text-xl"
                onClick={(e) => { e.stopPropagation(); onUpload() }}
            >
                <TbUpload />
            </button>
        </Tooltip>
        <Tooltip title="AI recommendations">
            <button
                type="button"
                className="cursor-pointer select-none text-xl text-gray-600 dark:text-gray-300 transition-colors"
                onClick={(e) => { e.stopPropagation(); onAI() }}
            >
                <TbBrain />
            </button>
        </Tooltip>
    </div>
)

const InfoItem = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-1 text-sm text-gray-500">{label}</div>
        <div className="break-words font-semibold">{value}</div>
    </div>
)

// ── Main ───────────────────────────────────────────────────────
const MyVehiclesDashboard = () => {
    const navigate = useNavigate()

    const [tableData, setTableData] = useState<TableQueries>({
        pageIndex: 1,
        pageSize: 5,
        sort: { order: '', key: '' },
        query: '',
    })

    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedVehicle, setSelectedVehicle] = useState<VehicleListItem | null>(null)

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const [uploadVehicle, setUploadVehicle] = useState<VehicleListItem | null>(null)
    const [uploadTableData, setUploadTableData] = useState<TableQueries>({
        pageIndex: 1,
        pageSize: 3,
        sort: { order: '', key: '' },
        query: '',
    })

    // AI Drawer state
    const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
    const [aiVehicle, setAiVehicle] = useState<VehicleListItem | null>(null)

    const { data, isLoading } = useSWR(
        ['/vehicles', tableData.pageIndex, tableData.pageSize],
        () =>
            apiGetMyVehicles<VehiclePaginatedResponse>({
                page: tableData.pageIndex as number,
                limit: tableData.pageSize as number,
            }),
        { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false },
    )

    const { data: uploadData, isLoading: uploadsLoading } = useSWR(
        uploadVehicle
            ? ['/uploads/vehicle', uploadVehicle.id, uploadTableData.pageIndex, uploadTableData.pageSize]
            : null,
        () =>
            apiGetUploadsByVehicle<
                UploadPaginatedResponse,
                { vehicleId: string; page: number; limit: number }
            >({
                vehicleId: uploadVehicle!.id,
                page: uploadTableData.pageIndex as number,
                limit: uploadTableData.pageSize as number,
            }),
        { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false },
    )

    const vehicles = data?.data ?? []
    const total = data?.total ?? 0
    const uploadItems = uploadData?.data ?? []
    const uploadTotal = uploadData?.total ?? 0

    const handleOpenAI = (vehicle: VehicleListItem) => {
        setAiVehicle(vehicle)
        setAiDrawerOpen(true)
    }

    const handleDownload = async (id: string, filename: string) => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `http://localhost:3000/api/v1/uploads/${id}/download`,
                { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
            )
            if (!response.ok) throw new Error(`Failed (${response.status})`)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('handleDownload error:', error)
            toast.push(
                <Notification type="danger">Failed to download file</Notification>,
                { placement: 'top-center' },
            )
        }
    }

    const columns: ColumnDef<VehicleListItem>[] = useMemo(
        () => [
            {
                header: 'Vehicle',
                accessorKey: 'make',
                cell: (props) => (
                    <VehicleColumn
                        row={props.row.original}
                        onPhotoClick={(v) => {
                            setUploadVehicle(v)
                            setUploadTableData((p) => ({ ...p, pageIndex: 1 }))
                            setUploadDialogOpen(true)
                        }}
                    />
                ),
            },
            {
                header: 'Plate',
                accessorKey: 'plateNumber',
                cell: (props) => (
                    <span className="text-sm text-gray-500">{props.row.original.plateNumber}</span>
                ),
            },
            {
                header: 'Year',
                accessorKey: 'year',
                cell: (props) => (
                    <span className="text-sm text-gray-500">{props.row.original.year}</span>
                ),
            },
            {
                header: 'Mileage',
                accessorKey: 'currentMileageKm',
                cell: (props) => (
                    <span className="text-sm text-gray-500">
                        {props.row.original.currentMileageKm} km
                    </span>
                ),
            },
            {
                header: '',
                id: 'action',
                cell: (props) => (
                    <ActionColumn
                        onView={() => {
                            setSelectedVehicle(props.row.original)
                            setDetailOpen(true)
                        }}
                        onEdit={() =>
                            navigate(`/concepts/vehicles/vehicle-edit/${props.row.original.id}`)
                        }
                        onUpload={() =>
                            navigate(`/concepts/vehicles/vehicle-upload/${props.row.original.id}`)
                        }
                        onAI={() => handleOpenAI(props.row.original)}
                    />
                ),
            },
        ],
        [navigate],
    )

    const handlePaginationChange = (page: number) => {
        const d = cloneDeep(tableData)
        d.pageIndex = page
        setTableData(d)
    }

    const handleSelectChange = (value: number) => {
        const d = cloneDeep(tableData)
        d.pageSize = Number(value)
        d.pageIndex = 1
        setTableData(d)
    }

    const handleSort = (sort: OnSortParam) => {
        const d = cloneDeep(tableData)
        d.sort = sort
        setTableData(d)
    }

    return (
        <>
            <Card>
                <div className="mb-4 flex items-center justify-between">
                    <h4>My vehicles</h4>
                    <Button onClick={() => navigate('/concepts/vehicles/vehicle-create')}>
                        Add vehicle
                    </Button>
                </div>

                <DataTable
                    columns={columns}
                    data={vehicles}
                    loading={isLoading}
                    noData={!isLoading && vehicles.length === 0}
                    skeletonAvatarColumns={[0]}
                    skeletonAvatarProps={{ width: 28, height: 28 }}
                    pagingData={{
                        total,
                        pageIndex: tableData.pageIndex as number,
                        pageSize: tableData.pageSize as number,
                    }}
                    onPaginationChange={handlePaginationChange}
                    onSelectChange={handleSelectChange}
                    onSort={handleSort}
                />
            </Card>

            {/* AI Drawer */}
            <AiDrawer
                vehicle={aiVehicle}
                isOpen={aiDrawerOpen}
                onClose={() => {
                    setAiDrawerOpen(false)
                    setAiVehicle(null)
                }}
            />

            {/* Vehicle detail dialog */}
            <Dialog
                isOpen={detailOpen}
                onClose={() => { setDetailOpen(false); setSelectedVehicle(null) }}
                onRequestClose={() => { setDetailOpen(false); setSelectedVehicle(null) }}
                width={800}
            >
                {selectedVehicle && (
                    <div className="flex flex-col gap-4">
                        <h4>Vehicle details</h4>
                        <Card>
                            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                                <Avatar
                                    size={72}
                                    {...(selectedVehicle.photoUrl
                                        ? { src: selectedVehicle.photoUrl }
                                        : { icon: <TbCar /> })}
                                />
                                <h3 className="mb-1">
                                    {selectedVehicle.make} {selectedVehicle.model}
                                </h3>
                            </div>
                            <div className="mt-8">
                                <div className="mb-2 text-sm text-gray-500">Health score</div>
                                <div className="mb-2 flex items-center gap-3">
                                    <span className="text-lg font-bold">
                                        {selectedVehicle.healthScore ?? 100}%
                                    </span>
                                </div>
                                <Progress
                                    percent={selectedVehicle.healthScore ?? 100}
                                    showInfo={false}
                                />
                            </div>
                        </Card>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <InfoItem label="Make" value={selectedVehicle.make || '-'} />
                            <InfoItem label="Model" value={selectedVehicle.model || '-'} />
                            <InfoItem label="VIN" value={selectedVehicle.vin || '-'} />
                            <InfoItem label="Plate number" value={selectedVehicle.plateNumber || '-'} />
                            <InfoItem label="Year" value={selectedVehicle.year || '-'} />
                            <InfoItem label="Mileage" value={`${selectedVehicle.currentMileageKm ?? 0} km`} />
                            <InfoItem
                                label="Updated at"
                                value={
                                    selectedVehicle.updatedAt
                                        ? new Date(selectedVehicle.updatedAt).toLocaleString()
                                        : '-'
                                }
                            />
                        </div>
                        <div className="mt-4 flex justify-between">
                            <Button
                                icon={<TbBrain />}
                                onClick={() => {
                                    setDetailOpen(false)
                                    handleOpenAI(selectedVehicle)
                                }}
                            >
                                AI recommendations
                            </Button>
                            <Button
                                variant="solid"
                                icon={<TbPencil />}
                                onClick={() =>
                                    navigate(`/concepts/vehicles/vehicle-edit/${selectedVehicle.id}`)
                                }
                            >
                                Edit
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Uploads dialog */}
            <Dialog
                isOpen={uploadDialogOpen}
                onClose={() => {
                    setUploadDialogOpen(false)
                    setUploadVehicle(null)
                    setUploadTableData((p) => ({ ...p, pageIndex: 1 }))
                }}
                onRequestClose={() => {
                    setUploadDialogOpen(false)
                    setUploadVehicle(null)
                }}
                width={700}
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <h4>Uploaded files</h4>
                        {uploadVehicle && (
                            <div className="mt-1 text-sm text-gray-500">
                                {uploadVehicle.make} {uploadVehicle.model}
                                {uploadVehicle.plateNumber ? ` - ${uploadVehicle.plateNumber}` : ''}
                            </div>
                        )}
                    </div>

                    {uploadsLoading ? (
                        <div className="text-sm text-gray-500">Loading…</div>
                    ) : !uploadItems.length ? (
                        <Card>
                            <div className="text-sm text-gray-500">
                                No uploaded files for this vehicle.
                            </div>
                        </Card>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {uploadItems.map((file) => (
                                <Card key={file.id}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="break-all font-semibold">{file.filename}</div>
                                            <div className="mt-1 text-sm text-gray-500">
                                                Status: {file.status}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Rows: {file.row_count ?? 0}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            icon={<TbDownload />}
                                            onClick={() => handleDownload(file.id, file.filename)}
                                        >
                                            Download
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                            <div className="pt-2">
                                <DataTable
                                    columns={[]}
                                    data={[]}
                                    loading={false}
                                    noData={false}
                                    pagingData={{
                                        total: uploadTotal,
                                        pageIndex: uploadTableData.pageIndex as number,
                                        pageSize: uploadTableData.pageSize as number,
                                    }}
                                    onPaginationChange={(page) => {
                                        const d = cloneDeep(uploadTableData)
                                        d.pageIndex = page
                                        setUploadTableData(d)
                                    }}
                                    onSelectChange={(value) => {
                                        const d = cloneDeep(uploadTableData)
                                        d.pageSize = Number(value)
                                        d.pageIndex = 1
                                        setUploadTableData(d)
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </Dialog>
        </>
    )
}

export default MyVehiclesDashboard
