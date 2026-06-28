import { useState, useEffect } from 'react'
import React from 'react'
import cloneDeep from 'lodash/cloneDeep'
import AdaptiveCard from '@/components/shared/AdaptiveCard'
import DataTable from '@/components/shared/DataTable'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useAnomalyNotificationStore } from '@/store/useAnomalyNotificationStore'
import { useFailureNotificationStore } from '@/store/useFailureNotificationStore'
import {
    apiGetAnomalyNotifications,
    apiMarkAllAnomaliesRead,
    apiMarkOneAnomalyRead,
} from '@/services/AnomalyNotificationService'
import {
    apiGetFailureNotifications,
    apiMarkAllFailuresRead,
    apiMarkOneFailureRead,
} from '@/services/FailureNotificationService'
import { apiGetAlerts } from '@/services/CommonService'
import { useNavigate } from 'react-router'
import classNames from 'classnames'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import {
    TbMailOpened,
    TbAlertTriangle,
    TbActivityHeartbeat,
    TbTool,
    TbEngine,
    TbCar,
    TbChevronRight,
    TbBellOff,
} from 'react-icons/tb'
import type { TableQueries } from '@/@types/common'

dayjs.extend(relativeTime)

type NotificationItem = {
    id: string
    type: 'dtc' | 'maintenance' | 'anomaly' | 'failure'
    level: 'critical' | 'warning' | 'info'
    title: string
    message: string
    vehicleId: string
    vehicleLabel?: string
    createdAt: string
    readed: boolean
}

const COMPONENT_LABELS: Record<string, string> = {
    engine: 'Engine',
    electrical: 'Electrical',
    transmission: 'Transmission',
    battery: 'Battery',
    brakes: 'Brakes',
    fuel_system: 'Fuel System',
    cooling_system: 'Cooling System',
}

// ── Per-type visual config ─────────────────────────────────────
type TypeConfig = {
    icon: React.ReactElement
    iconBg: string
    iconColor: string
    pillBg: string
    pillText: string
    pillLabel: string
    borderColor: string
    rowBg: string
}

const TYPE_CONFIG: Record<NotificationItem['type'], TypeConfig> = {
    anomaly: {
        icon: <TbActivityHeartbeat size={18} />,
        iconBg: 'bg-red-100 dark:bg-red-900/30',
        iconColor: 'text-red-600 dark:text-red-400',
        pillBg: 'bg-red-100 dark:bg-red-900/30',
        pillText: 'text-red-700 dark:text-red-400',
        pillLabel: 'Anomaly',
        borderColor: 'border-l-red-500',
        rowBg: 'bg-red-50/60 dark:bg-red-900/10',
    },
    failure: {
        icon: <TbAlertTriangle size={18} />,
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
        pillBg: 'bg-amber-100 dark:bg-amber-900/30',
        pillText: 'text-amber-700 dark:text-amber-400',
        pillLabel: 'High Risk',
        borderColor: 'border-l-amber-500',
        rowBg: 'bg-amber-50/60 dark:bg-amber-900/10',
    },
    dtc: {
        icon: <TbEngine size={18} />,
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconColor: 'text-purple-600 dark:text-purple-400',
        pillBg: 'bg-purple-100 dark:bg-purple-900/30',
        pillText: 'text-purple-700 dark:text-purple-400',
        pillLabel: 'DTC',
        borderColor: 'border-l-purple-500',
        rowBg: 'bg-purple-50/40 dark:bg-purple-900/10',
    },
    maintenance: {
        icon: <TbTool size={18} />,
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
        pillBg: 'bg-blue-100 dark:bg-blue-900/30',
        pillText: 'text-blue-700 dark:text-blue-400',
        pillLabel: 'Maintenance',
        borderColor: 'border-l-blue-500',
        rowBg: 'bg-blue-50/40 dark:bg-blue-900/10',
    },
}

// ── Notification row ───────────────────────────────────────────
const NotificationRow = ({
    item,
    onClick,
}: {
    item: NotificationItem
    onClick: () => void
}) => {
    const cfg = TYPE_CONFIG[item.type]
    const isUnread = !item.readed

    return (
        <div
            onClick={onClick}
            className={classNames(
                'group relative flex items-center gap-4 cursor-pointer',
                'rounded-xl px-4 py-3 border-l-4 transition-all duration-150',
                isUnread
                    ? [cfg.borderColor, cfg.rowBg]
                    : 'border-l-transparent bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700/50',
            )}
        >
            {/* Icon avatar — always colored */}
            <div
                className={classNames(
                    'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full',
                    cfg.iconBg,
                    cfg.iconColor,
                )}
            >
                {cfg.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Top row: pill + title */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className={classNames(
                            'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide',
                            cfg.pillBg,
                            cfg.pillText,
                        )}
                    >
                        {cfg.pillLabel}
                    </span>
                    <span
                        className={classNames(
                            'text-sm font-semibold truncate',
                            isUnread
                                ? 'text-gray-900 dark:text-gray-100'
                                : 'text-gray-700 dark:text-gray-200',
                        )}
                    >
                        {item.title}
                    </span>
                    {isUnread && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary ml-auto" />
                    )}
                </div>

                {/* Message */}
                <p className="text-xs mt-0.5 truncate text-gray-500 dark:text-gray-400">
                    {item.message}
                </p>

                {/* Footer: vehicle + time */}
                <div className="flex items-center gap-3 mt-1">
                    {item.vehicleLabel && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                            <TbCar size={11} />
                            {item.vehicleLabel}
                        </span>
                    )}
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {dayjs(item.createdAt).fromNow()}
                    </span>
                </div>
            </div>

            {/* Chevron */}
            <TbChevronRight
                size={16}
                className="flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors"
            />
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────
const ActivityLog = () => {
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(false)
    const [dtcMaintenanceList, setDtcMaintenanceList] = useState<NotificationItem[]>([])

    const [tableData, setTableData] = useState<TableQueries>({
        pageIndex: 1,
        pageSize: 10,
        sort: { order: '', key: '' },
        query: '',
    })

    const anomalies = useAnomalyNotificationStore((s) => s.anomalies)
    const setAnomalies = useAnomalyNotificationStore((s) => s.setAnomalies)
    const markAllAnomaliesRead = useAnomalyNotificationStore((s) => s.markAllRead)
    const markOneAnomalyRead = useAnomalyNotificationStore((s) => s.markOneRead)

    const failures = useFailureNotificationStore((s) => s.failures)
    const setFailures = useFailureNotificationStore((s) => s.setFailures)
    const markAllFailuresRead = useFailureNotificationStore((s) => s.markAllRead)
    const markOneFailureRead = useFailureNotificationStore((s) => s.markOneRead)

    useEffect(() => {
        setIsLoading(true)
        Promise.all([
            apiGetAnomalyNotifications()
                .then((res) => {
                    const items = Array.isArray(res) ? res : (res as any)?.data ?? []
                    setAnomalies(
                        items.map((a: any) => ({
                            id: a.id,
                            vehicleId: a.vehicleId,
                            vehicleLabel: a.vehicleLabel,
                            sensorReadingId: a.sensorReadingId,
                            timestamp: a.timestamp,
                            score: a.score,
                            anomalyProbability: a.anomalyProbability,
                            readed: a.readed,
                            createdAt: a.createdAt,
                        })),
                    )
                })
                .catch(console.error),

            apiGetFailureNotifications()
                .then((res) => {
                    const items = Array.isArray(res) ? res : (res as any)?.data ?? []
                    setFailures(
                        items.map((f: any) => ({
                            id: f.id,
                            vehicleId: f.vehicleId,
                            vehicleLabel: f.vehicleLabel,
                            component: f.component,
                            riskScore: f.riskScore,
                            riskLevel: f.riskLevel,
                            readed: f.readed,
                            createdAt: f.createdAt,
                        })),
                    )
                })
                .catch(console.error),

            apiGetAlerts()
                .then((resp) => {
                    const rawData = resp.data ?? []
                    setDtcMaintenanceList(
                        rawData.map((item: any) => ({
                            id: item.id || crypto.randomUUID(),
                            type: item.type === 'maintenance' ? 'maintenance' : 'dtc',
                            level:
                                item.level === 'critical' || item.level === 'warning' || item.level === 'info'
                                    ? item.level
                                    : 'info',
                            title: item.title || 'Notification',
                            message: item.message || '',
                            vehicleId: item.vehicleId || '',
                            vehicleLabel: item.vehicleLabel,
                            createdAt: item.createdAt || new Date().toISOString(),
                            readed: false,
                        })),
                    )
                })
                .catch(console.error),
        ]).finally(() => setIsLoading(false))
    }, [])

    const anomalyItems: NotificationItem[] = anomalies.map((a) => ({
        id: a.id,
        type: 'anomaly',
        level: 'critical',
        title: 'Sensor Anomaly Detected',
        message: `Score: ${a.score?.toFixed(3)} — Probability: ${(a.anomalyProbability * 100).toFixed(1)}%`,
        vehicleId: a.vehicleId,
        vehicleLabel: a.vehicleLabel,
        createdAt: a.createdAt,
        readed: a.readed,
    }))

    const failureItems: NotificationItem[] = failures.map((f) => ({
        id: f.id,
        type: 'failure',
        level: 'warning',
        title: `High Risk — ${COMPONENT_LABELS[f.component] ?? f.component}`,
        message: `Probability: ${(f.riskScore * 100).toFixed(1)}% — ${f.riskLevel.replace('_', ' ')}`,
        vehicleId: f.vehicleId,
        vehicleLabel: f.vehicleLabel,
        createdAt: f.createdAt,
        readed: f.readed,
    }))

    const allNotifications: NotificationItem[] = [
        ...anomalyItems,
        ...failureItems,
        ...dtcMaintenanceList,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const unreadCount = allNotifications.filter((n) => !n.readed).length

    // ── Pagination ─────────────────────────────────────────────
    const pageIndex = tableData.pageIndex as number
    const pageSize = tableData.pageSize as number
    const total = allNotifications.length
    const pagedNotifications = allNotifications.slice(
        (pageIndex - 1) * pageSize,
        pageIndex * pageSize,
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

    // ── Read handlers ──────────────────────────────────────────
    const handleMarkAllRead = async () => {
        setDtcMaintenanceList((prev) => prev.map((item) => ({ ...item, readed: true })))
        markAllAnomaliesRead()
        markAllFailuresRead()
        await apiMarkAllAnomaliesRead().catch(console.error)
        await apiMarkAllFailuresRead().catch(console.error)
    }

    const handleMarkOneRead = async (id: string, type: NotificationItem['type']) => {
        if (type === 'anomaly') {
            markOneAnomalyRead(id)
            await apiMarkOneAnomalyRead(id).catch(console.error)
        } else if (type === 'failure') {
            markOneFailureRead(id)
            await apiMarkOneFailureRead(id).catch(console.error)
        } else {
            setDtcMaintenanceList((prev) =>
                prev.map((item) => (item.id === id ? { ...item, readed: true } : item)),
            )
        }
    }

    const handleItemClick = (item: NotificationItem) => {
        handleMarkOneRead(item.id, item.type)
        if (item.type === 'anomaly') navigate(`/app/vehicles/${item.vehicleId}?tab=sensor`)
        else if (item.type === 'failure') navigate(`/app/vehicles/${item.vehicleId}?tab=failure`)
        else if (item.type === 'dtc') navigate(`/app/vehicles/${item.vehicleId}?tab=dtc`)
        else navigate(`/app/vehicles/${item.vehicleId}?tab=maintenance`)
    }

    return (
        <AdaptiveCard>
            <div className="max-w-[800px] mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <h3 className="mb-0">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-white text-xs font-semibold">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="plain"
                            size="sm"
                            icon={<TbMailOpened className="text-lg" />}
                            onClick={handleMarkAllRead}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Spinner size={40} />
                    </div>
                ) : allNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <TbBellOff size={26} className="text-gray-400" />
                        </div>
                        <div>
                            <h6 className="font-semibold text-gray-700 dark:text-gray-200">All caught up!</h6>
                            <p className="mt-0.5 text-sm text-gray-400">No new notifications for now.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-1">
                            {pagedNotifications.map((item) => (
                                <NotificationRow
                                    key={item.id}
                                    item={item}
                                    onClick={() => handleItemClick(item)}
                                />
                            ))}
                        </div>

                        <div className="mt-4">
                            <DataTable
                                columns={[]}
                                data={[]}
                                loading={false}
                                noData={false}
                                pagingData={{ total, pageIndex, pageSize }}
                                onPaginationChange={handlePaginationChange}
                                onSelectChange={handleSelectChange}
                            />
                        </div>
                    </>
                )}
            </div>
        </AdaptiveCard>
    )
}

export default ActivityLog