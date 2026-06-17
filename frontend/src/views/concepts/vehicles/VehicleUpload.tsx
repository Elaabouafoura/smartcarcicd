import { useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Loading from '@/components/shared/Loading'
import {
    TbArrowLeft,
    TbUpload,
    TbDatabase,
    TbAlertTriangle,
    TbTool,
    TbCheck,
    TbAlertCircle,
} from 'react-icons/tb'
import {
    apiUploadVehicleSensorData,
    apiUploadVehicleDtc,
    apiUploadVehicleMaintenance,
} from '@/services/DashboardService'
import { useAnomalyDetection } from '@/hooks/useAnomalyDetection'
import { useFailureDetection } from '@/hooks/useFailureDetection'
import AnomalyToast from '@/components/ui/AnomalyToast'
import FailureToast from '@/components/ui/FailureToast'

// ─── Types ───────────────────────────────────────────────────────────────────

type FileCategory = 'sensor' | 'dtc' | 'maintenance'

interface AmbiguousFile {
    file: File
    matches: FileCategory[]
}

interface SlotState {
    sensor: File | null
    dtc: File | null
    maintenance: File | null
}

// ─── Classification rules ────────────────────────────────────────────────────

const RULES: Record<FileCategory, string[]> = {
    sensor: ['sensor', 'obd', 'reading'],
    dtc: ['dtc', 'fault', 'code'],
    maintenance: ['maintenance', 'service', 'repair'],
}

const SLOT_META: Record<FileCategory, { label: string; icon: React.ReactNode }> = {
    sensor: { label: 'Sensor data', icon: <TbDatabase /> },
    dtc: { label: 'DTC', icon: <TbAlertTriangle /> },
    maintenance: { label: 'Maintenance', icon: <TbTool /> },
}

function classifyFile(name: string): { type: FileCategory | null; matches: FileCategory[] } {
    const n = name.toLowerCase()
    const matches = (Object.keys(RULES) as FileCategory[]).filter((key) =>
        RULES[key].some((kw) => n.includes(kw)),
    )
    return matches.length === 1 ? { type: matches[0], matches } : { type: null, matches }
}

// ─── MultiUploadZone ─────────────────────────────────────────────────────────

interface MultiUploadZoneProps {
    onSensorUpload: (file: File) => Promise<void>
    onDtcUpload: (file: File) => Promise<void>
    onMaintenanceUpload: (file: File) => Promise<void>
    sensorDone: boolean
    dtcDone: boolean
    maintenanceDone: boolean
}

const MultiUploadZone = ({
    onSensorUpload,
    onDtcUpload,
    onMaintenanceUpload,
    sensorDone,
    dtcDone,
    maintenanceDone,
}: MultiUploadZoneProps) => {
    const [slots, setSlots] = useState<SlotState>({ sensor: null, dtc: null, maintenance: null })
    const [ambiguous, setAmbiguous] = useState<AmbiguousFile[]>([])
    const [resolutions, setResolutions] = useState<Record<number, FileCategory | ''>>({})
    const [dragging, setDragging] = useState(false)

    const uploaders: Record<FileCategory, (file: File) => Promise<void>> = {
        sensor: onSensorUpload,
        dtc: onDtcUpload,
        maintenance: onMaintenanceUpload,
    }

    const processFiles = useCallback(
        (files: FileList | File[]) => {
            const newSlots = { ...slots }
            const newAmbiguous = [...ambiguous]

            Array.from(files).forEach((file) => {
                const { type, matches } = classifyFile(file.name)
                if (type) {
                    newSlots[type] = file
                    uploaders[type](file)
                } else {
                    newAmbiguous.push({ file, matches })
                }
            })

            setSlots(newSlots)
            setAmbiguous(newAmbiguous)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [slots, ambiguous],
    )

    const resolveAmbiguous = (idx: number) => {
        const type = resolutions[idx]
        if (!type) return
        const item = ambiguous[idx]
        setSlots((prev) => ({ ...prev, [type]: item.file }))
        uploaders[type](item.file)
        setAmbiguous((prev) => prev.filter((_, i) => i !== idx))
        setResolutions((prev) => {
            const next = { ...prev }
            delete next[idx]
            return next
        })
    }

    const removeSlot = (key: FileCategory) => {
        setSlots((prev) => ({ ...prev, [key]: null }))
    }

    const doneMap: Record<FileCategory, boolean> = {
        sensor: sensorDone,
        dtc: dtcDone,
        maintenance: maintenanceDone,
    }

    const doneCount = [sensorDone, dtcDone, maintenanceDone].filter(Boolean).length

    return (
        <Card>
            <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    dragging
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                }`}
                onClick={() => document.getElementById('multi-upload-input')?.click()}
                onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    processFiles(e.dataTransfer.files)
                }}
            >
                <TbUpload className="mx-auto text-5xl text-gray-400 mb-3" />
                <p className="font-medium text-gray-800 dark:text-white">
                    Drop all 3 files here, or click to browse
                </p>
                <p className="text-sm text-gray-500 mt-1">
                    Sensor, DTC, and Maintenance — any order, detected automatically
                </p>
                <p className="text-xs text-gray-400 mt-1">.csv or .json only</p>
                <input
                    id="multi-upload-input"
                    type="file"
                    multiple
                    accept=".csv,.json"
                    className="hidden"
                    onChange={(e) => e.target.files && processFiles(e.target.files)}
                />
            </div>

            <div className="flex flex-col gap-2 mt-4">
                {(Object.keys(SLOT_META) as FileCategory[]).map((key) => {
                    const file = slots[key]
                    const done = doneMap[key]
                    const { label, icon } = SLOT_META[key]

                    return (
                        <div
                            key={key}
                            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                                done
                                    ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700'
                                    : 'border-gray-200 dark:border-gray-700 opacity-60'
                            }`}
                        >
                            <span className="text-lg">{icon}</span>
                            <span className="w-28 text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">
                                {label}
                            </span>
                            <span className="flex-1 text-sm truncate text-gray-800 dark:text-white">
                                {file ? file.name : 'Not uploaded'}
                            </span>
                            {done && (
                                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                                    <TbCheck size={12} /> Ready
                                </span>
                            )}
                            {file && !done && (
                                <button
                                    className="text-gray-400 hover:text-red-500 text-lg leading-none"
                                    onClick={() => removeSlot(key)}
                                    aria-label={`Remove ${label}`}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${(doneCount / 3) * 100}%` }}
                    />
                </div>
                <span className="text-sm font-semibold">{doneCount} / 3</span>
            </div>

            {ambiguous.length > 0 && (
                <div className="flex flex-col gap-3 mt-4">
                    {ambiguous.map((item, idx) => (
                        <div
                            key={idx}
                            className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 flex flex-col gap-2"
                        >
                            <div className="flex items-center gap-2">
                                <TbAlertCircle className="text-amber-500 shrink-0" />
                                <span className="text-sm font-medium text-amber-700 dark:text-amber-400 truncate flex-1">
                                    {item.file.name}
                                </span>
                                <span className="text-xs font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    Ambiguous
                                </span>
                            </div>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                {item.matches.length > 1
                                    ? `Matches multiple categories: ${item.matches.join(', ')}. Please assign manually.`
                                    : 'No matching keywords found. Please assign manually.'}
                            </p>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500">Assign to:</label>
                                <select
                                    className="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1"
                                    value={resolutions[idx] ?? ''}
                                    onChange={(e) =>
                                        setResolutions((prev) => ({
                                            ...prev,
                                            [idx]: e.target.value as FileCategory | '',
                                        }))
                                    }
                                >
                                    <option value="">— choose —</option>
                                    <option value="sensor">Sensor data</option>
                                    <option value="dtc">DTC</option>
                                    <option value="maintenance">Maintenance</option>
                                </select>
                                <button
                                    className="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    onClick={() => resolveAmbiguous(idx)}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    )
}

// ─── VehicleUpload ────────────────────────────────────────────────────────────

const VehicleUpload = () => {
    const { id } = useParams()
    const navigate = useNavigate()

    const [sensorDone, setSensorDone] = useState(false)
    const [dtcDone, setDtcDone] = useState(false)
    const [maintenanceDone, setMaintenanceDone] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)

    const hasTriggeredFailure = useRef(false)
    const doneRef = useRef({ sensor: false, dtc: false, maintenance: false })

    const {
        detectAfterUpload: detectAnomalies,
        toastState: anomalyToast,
        dismissToast: dismissAnomaly,
    } = useAnomalyDetection()

    const {
        detectAfterUpload: detectFailures,
        toastState: failureToast,
        dismissToast: dismissFailure,
    } = useFailureDetection()

    const allDone = sensorDone && dtcDone && maintenanceDone

    const checkAndTriggerAnalysis = () => {
        const { sensor, dtc, maintenance } = doneRef.current
        if (sensor && dtc && maintenance && id && !hasTriggeredFailure.current) {
            hasTriggeredFailure.current = true
            setAnalyzing(true)
            detectFailures(id).finally(() => setAnalyzing(false))
        }
    }

    const handleSensorUpload = async (file: File) => {
        if (!id) return
        try {
            await apiUploadVehicleSensorData(id, file)
            toast.push(
                <Notification type="success">Sensor data uploaded successfully</Notification>,
                { placement: 'top-center' },
            )
            setSensorDone(true)
            doneRef.current.sensor = true
            await detectAnomalies(id)
            checkAndTriggerAnalysis()
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger">Failed to upload sensor data</Notification>,
                { placement: 'top-center' },
            )
        }
    }

    const handleDtcUpload = async (file: File) => {
        if (!id) return
        try {
            await apiUploadVehicleDtc(id, file)
            toast.push(
                <Notification type="success">DTC file uploaded successfully</Notification>,
                { placement: 'top-center' },
            )
            setDtcDone(true)
            doneRef.current.dtc = true
            checkAndTriggerAnalysis()
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger">Failed to upload DTC file</Notification>,
                { placement: 'top-center' },
            )
        }
    }

    const handleMaintenanceUpload = async (file: File) => {
        if (!id) return
        try {
            await apiUploadVehicleMaintenance(id, file)
            toast.push(
                <Notification type="success">Maintenance file uploaded successfully</Notification>,
                { placement: 'top-center' },
            )
            setMaintenanceDone(true)
            doneRef.current.maintenance = true
            checkAndTriggerAnalysis()
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger">Failed to upload maintenance file</Notification>,
                { placement: 'top-center' },
            )
        }
    }

    return (
        <Loading loading={false}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4>Vehicle Upload Center</h4>
                        <p className="text-gray-500">Upload files related to this vehicle</p>
                    </div>
                    <Button
                        icon={<TbArrowLeft />}
                        onClick={() => navigate('/concepts/vehicles/vehicle-list')}
                    >
                        Back
                    </Button>
                </div>

                {(analyzing || allDone) && (
                    <div className="flex items-center justify-end rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
                        {analyzing && (
                            <span className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full">
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8z"
                                    />
                                </svg>
                                Analyse des risques...
                            </span>
                        )}
                        {allDone && !analyzing && (
                            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-1.5 rounded-full">
                                <TbCheck size={16} />
                                Analyse terminée
                            </span>
                        )}
                    </div>
                )}

                <MultiUploadZone
                    onSensorUpload={handleSensorUpload}
                    onDtcUpload={handleDtcUpload}
                    onMaintenanceUpload={handleMaintenanceUpload}
                    sensorDone={sensorDone}
                    dtcDone={dtcDone}
                    maintenanceDone={maintenanceDone}
                />

                {anomalyToast.visible && (
                    <AnomalyToast
                        count={anomalyToast.count}
                        vehicleLabel={anomalyToast.vehicleLabel}
                        onClose={dismissAnomaly}
                    />
                )}

                {failureToast.visible && (
                    <FailureToast
                        count={failureToast.count}
                        components={failureToast.components}
                        vehicleLabel={failureToast.vehicleLabel}
                        onClose={dismissFailure}
                    />
                )}
            </div>
        </Loading>
    )
}

export default VehicleUpload