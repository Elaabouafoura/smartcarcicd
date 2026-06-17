import { useEffect, useState, useRef, useCallback } from 'react'
import classNames from 'classnames'
import { io, Socket } from 'socket.io-client'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import Dropdown from '@/components/ui/Dropdown'
import ScrollBar from '@/components/ui/ScrollBar'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import NotificationAvatar from './NotificationAvatar'
import NotificationToggle from './NotificationToggle'
import { HiOutlineMailOpen } from 'react-icons/hi'
import { apiGetAlerts } from '@/services/CommonService'
import isLastChild from '@/utils/isLastChild'
import useResponsive from '@/utils/hooks/useResponsive'
import { useNavigate } from 'react-router'
import dayjs from 'dayjs'
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

import type { DropdownRef } from '@/components/ui/Dropdown'

type NotificationItem = {
    id: string
    type: 'dtc' | 'maintenance' | 'anomaly' | 'failure'
    level: 'critical' | 'warning' | 'info'
    title: string
    message: string
    vehicleId: string
    vehicleLabel?: string
    createdAt: string
    metadata?: Record<string, any>
    readed: boolean
}

type AlertApiItem = {
    id: string
    type: 'dtc' | 'maintenance'
    level: 'critical' | 'warning' | 'info'
    title: string
    message: string
    vehicleId: string
    vehicleLabel?: string
    createdAt: string
    metadata?: Record<string, any>
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

const notificationHeight = 'h-[320px]'

const _Notification = ({ className }: { className?: string }) => {
    const [notificationList, setNotificationList] = useState<NotificationItem[]>([])
    const [unreadNotification, setUnreadNotification] = useState(false)
    const [noResult, setNoResult] = useState(false)
    const [loading, setLoading] = useState(false)

    const socketRef = useRef<Socket | null>(null)
    const hasFetchedRef = useRef(false)
    const notificationDropdownRef = useRef<DropdownRef>(null)

    const { larger } = useResponsive()
    const navigate = useNavigate()

    // ── Anomaly store ────────────────────────────────────────────
    const anomalies = useAnomalyNotificationStore((s) => s.anomalies)
    const setAnomalies = useAnomalyNotificationStore((s) => s.setAnomalies)
    const markAllRead = useAnomalyNotificationStore((s) => s.markAllRead)
    const markOneRead = useAnomalyNotificationStore((s) => s.markOneRead)

    // ── Failure store ────────────────────────────────────────────
    const failures = useFailureNotificationStore((s) => s.failures)
    const setFailures = useFailureNotificationStore((s) => s.setFailures)
    const markAllFailuresRead = useFailureNotificationStore((s) => s.markAllRead)
    const markOneFailureRead = useFailureNotificationStore((s) => s.markOneRead)

    // Load anomalies from backend on mount (once)
    useEffect(() => {
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
            .catch(console.error)
    }, [])

    // Load failures from backend on mount (once)
    useEffect(() => {
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
            .catch(console.error)
    }, [])

    // Map anomaly store → NotificationItem
    const anomalyItems: NotificationItem[] = anomalies.map((a) => ({
        id: a.id,
        type: 'anomaly',
        level: 'critical',
        title: 'Sensor Anomaly Detected',
        message: `Score: ${a.score?.toFixed(3)} — Probability: ${(a.anomalyProbability * 100).toFixed(1)}%`,
        vehicleId: a.vehicleId,
        vehicleLabel: a.vehicleLabel,
        createdAt: a.createdAt,
        metadata: {},
        readed: a.readed,
    }))

    // Map failure store → NotificationItem
    const failureItems: NotificationItem[] = failures.map((f) => ({
        id: f.id,
        type: 'failure',
        level: 'warning',
        title: `High Risk — ${COMPONENT_LABELS[f.component] ?? f.component}`,
        message: `Probability: ${(f.riskScore * 100).toFixed(1)}% — ${f.riskLevel.replace('_', ' ')}`,
        vehicleId: f.vehicleId,
        vehicleLabel: f.vehicleLabel,
        createdAt: f.createdAt,
        metadata: {},
        readed: f.readed,
    }))

    // Merged list: anomalies → failures → API notifications
    const mergedList: NotificationItem[] = [
        ...anomalyItems,
        ...failureItems,
        ...notificationList,
    ]

    const hasUnread = mergedList.some((item) => !item.readed)

    // Sync dot with list
    useEffect(() => {
        setUnreadNotification(hasUnread)
    }, [hasUnread])

    const mapIncomingNotification = useCallback(
        (item: Partial<AlertApiItem>): NotificationItem => ({
            id: item.id || crypto.randomUUID(),
            type: item.type === 'maintenance' ? 'maintenance' : 'dtc',
            level:
                item.level === 'critical' ||
                item.level === 'warning' ||
                item.level === 'info'
                    ? item.level
                    : 'info',
            title: item.title || 'Notification',
            message: item.message || '',
            vehicleId: item.vehicleId || '',
            vehicleLabel: item.vehicleLabel,
            createdAt: item.createdAt || new Date().toISOString(),
            metadata: item.metadata || {},
            readed: false,
        }),
        [],
    )

    const fetchNotifications = useCallback(async () => {
        setLoading(true)
        try {
            const resp = await apiGetAlerts()
            const rawData = resp.data ?? []
            const mapped = rawData.map((item: AlertApiItem) =>
                mapIncomingNotification(item),
            )
            setNotificationList(mapped)
            setNoResult(mapped.length === 0)
        } catch (error) {
            console.error('Failed to fetch notifications:', error)
            setNotificationList([])
            setNoResult(true)
        } finally {
            setLoading(false)
        }
    }, [mapIncomingNotification])

    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    // Socket.io
    useEffect(() => {
        const accessToken = localStorage.getItem('accessToken')
        const userId = localStorage.getItem('userId')

        const socket = io(
            import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000',
            {
                transports: ['websocket'],
                auth: { token: accessToken, userId },
            },
        )

        socketRef.current = socket

        socket.on('connect', () => console.log('socket connected'))

        socket.on('notification:new', (incoming: AlertApiItem) => {
            const notification = mapIncomingNotification(incoming)
            setNotificationList((prev) => [notification, ...prev])
            setUnreadNotification(true)
            setNoResult(false)
        })

        socket.on('notification:batch', (incoming: AlertApiItem[]) => {
            const notifications = Array.isArray(incoming)
                ? incoming.map(mapIncomingNotification)
                : []
            setNotificationList((prev) => [...notifications.reverse(), ...prev])
            if (notifications.length > 0) {
                setUnreadNotification(true)
                setNoResult(false)
            }
        })

        socket.on('disconnect', () => console.log('socket disconnected'))

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [mapIncomingNotification])

    const onNotificationOpen = async () => {
        if (!hasFetchedRef.current && notificationList.length === 0) {
            hasFetchedRef.current = true
            await fetchNotifications()
        }
    }

    const onMarkAllAsRead = async () => {
        setNotificationList((prev) =>
            prev.map((item) => ({ ...item, readed: true })),
        )
        markAllRead()
        markAllFailuresRead()
        setUnreadNotification(false)
        await apiMarkAllAnomaliesRead().catch(console.error)
        await apiMarkAllFailuresRead().catch(console.error)
    }

    const onMarkAsRead = async (id: string, type: NotificationItem['type']) => {
        if (type === 'anomaly') {
            markOneRead(id)
            await apiMarkOneAnomalyRead(id).catch(console.error)
        } else if (type === 'failure') {
            markOneFailureRead(id)
            await apiMarkOneFailureRead(id).catch(console.error)
        } else {
            setNotificationList((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, readed: true } : item,
                ),
            )
        }
    }

    const handleItemClick = (item: NotificationItem) => {
        onMarkAsRead(item.id, item.type)

        if (item.type === 'anomaly') {
            navigate(`/app/vehicles/${item.vehicleId}?tab=sensor`)
        } else if (item.type === 'failure') {
            navigate(`/app/vehicles/${item.vehicleId}?tab=failure`)
        } else if (item.type === 'dtc') {
            navigate(`/app/vehicles/${item.vehicleId}?tab=dtc`)
        } else {
            navigate(`/app/vehicles/${item.vehicleId}?tab=maintenance`)
        }

        notificationDropdownRef.current?.handleDropdownClose()
    }

    const handleViewAllActivity = () => {
        navigate('/concepts/account/activity-log')
        notificationDropdownRef.current?.handleDropdownClose()
    }

    const getBadgeColor = (item: NotificationItem) => {
        if (item.readed) return 'bg-gray-300 dark:bg-gray-600'
        if (item.type === 'anomaly') return 'bg-red-500 animate-pulse'
        if (item.type === 'failure') return 'bg-amber-500 animate-pulse'
        if (item.level === 'critical') return 'bg-red-500'
        if (item.level === 'warning') return 'bg-amber-500'
        return 'bg-primary'
    }

    const getItemBg = (item: NotificationItem) => {
        if (item.readed) return ''
        if (item.type === 'anomaly') return 'bg-red-50 dark:bg-red-900/10'
        if (item.type === 'failure') return 'bg-amber-50 dark:bg-amber-900/10'
        return ''
    }

    const getTitleColor = (item: NotificationItem) => {
        if (item.readed) return ''
        if (item.type === 'anomaly') return 'text-red-600 dark:text-red-400'
        if (item.type === 'failure') return 'text-amber-600 dark:text-amber-400'
        return ''
    }

    const unreadAnomalyCount = anomalyItems.filter((a) => !a.readed).length
    const unreadFailureCount = failureItems.filter((f) => !f.readed).length

    return (
        <Dropdown
            ref={notificationDropdownRef}
            renderTitle={
                <NotificationToggle
                    dot={unreadNotification}
                    className={className}
                />
            }
            menuClass="min-w-[280px] md:min-w-[380px]"
            placement={larger.md ? 'bottom-end' : 'bottom'}
            onOpen={onNotificationOpen}
        >
            <Dropdown.Item variant="header">
                <div className="mb-1 flex items-center justify-between px-2">
                    <div className="flex flex-col gap-0.5">
                        <h6>Notifications</h6>
                        {unreadAnomalyCount > 0 && (
                            <span className="text-xs text-red-500 font-medium">
                                {unreadAnomalyCount} unread anomal{unreadAnomalyCount > 1 ? 'ies' : 'y'}
                            </span>
                        )}
                        {unreadFailureCount > 0 && (
                            <span className="text-xs text-amber-500 font-medium">
                                {unreadFailureCount} high risk{unreadFailureCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <Button
                        variant="plain"
                        shape="circle"
                        size="sm"
                        icon={<HiOutlineMailOpen className="text-xl" />}
                        title="Mark all as read"
                        onClick={onMarkAllAsRead}
                    />
                </div>
            </Dropdown.Item>

            <ScrollBar className={classNames('overflow-y-auto', notificationHeight)}>
                {mergedList.length > 0 &&
                    mergedList.map((item, index) => (
                        <div key={item.id}>
                            <div
                                className={classNames(
                                    'relative flex cursor-pointer rounded-xl px-4 py-3 transition-colors',
                                    'hover:bg-gray-100 active:bg-gray-100 dark:hover:bg-gray-700',
                                    getItemBg(item),
                                )}
                                onClick={() => handleItemClick(item)}
                            >
                                <div>
                                    <NotificationAvatar
                                        type={
                                            item.type === 'anomaly'
                                                ? 3
                                                : item.type === 'failure'
                                                ? 4
                                                : item.type === 'maintenance'
                                                ? 2
                                                : 1
                                        }
                                        image=""
                                        target=""
                                        status=""
                                    />
                                </div>

                                <div className="mx-3 flex-1">
                                    <div className="pr-6">
                                        <span
                                            className={classNames(
                                                'font-semibold heading-text',
                                                getTitleColor(item),
                                            )}
                                        >
                                            {item.title}
                                        </span>
                                    </div>

                                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                        {item.message}
                                    </div>

                                    {item.vehicleLabel && (
                                        <div className="mt-1 text-xs text-gray-500">
                                            {item.vehicleLabel}
                                        </div>
                                    )}

                                    <span className="mt-1 block text-xs text-gray-500">
                                        {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                                    </span>
                                </div>

                                <Badge
                                    className="absolute top-4 mt-1.5 ltr:right-4 rtl:left-4"
                                    innerClass={getBadgeColor(item)}
                                />
                            </div>

                            {!isLastChild(mergedList, index) && (
                                <div className="my-2 border-b border-gray-200 dark:border-gray-700" />
                            )}
                        </div>
                    ))}

                {loading && (
                    <div
                        className={classNames(
                            'flex items-center justify-center',
                            notificationHeight,
                        )}
                    >
                        <Spinner size={40} />
                    </div>
                )}

                {noResult && mergedList.length === 0 && (
                    <div
                        className={classNames(
                            'flex items-center justify-center',
                            notificationHeight,
                        )}
                    >
                        <div className="text-center">
                            <img
                                className="mx-auto mb-2 max-w-[150px]"
                                src="/img/others/no-notification.png"
                                alt="no-notification"
                            />
                            <h6 className="font-semibold">No notifications!</h6>
                            <p className="mt-1">Please try again later</p>
                        </div>
                    </div>
                )}
            </ScrollBar>

            <Dropdown.Item variant="header">
                <div className="pt-4">
                    <Button block variant="solid" onClick={handleViewAllActivity}>
                        View All Activity
                    </Button>
                </div>
            </Dropdown.Item>
        </Dropdown>
    )
}

const Notification = withHeaderItem(_Notification)

export default Notification