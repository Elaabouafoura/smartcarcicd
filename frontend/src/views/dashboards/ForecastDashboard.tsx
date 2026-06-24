import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import axios from 'axios'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Loading from '@/components/shared/Loading'
import {
    TbArrowLeft,
    TbAlertTriangle,
    TbBattery2,
    TbDroplet,
    TbFlame,
    TbClock,
    TbShieldCheck,
    TbTrendingUp,
    TbTrendingDown,
    TbMinus,
    TbCalendarStats,
    TbChartLine,
    TbAlertCircle,
    TbInfoCircle,
} from 'react-icons/tb'
import {
    ResponsiveContainer,
    LineChart,
    Line,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
    AreaChart,
} from 'recharts'
import classNames from '@/utils/classNames'

// ── Types ──────────────────────────────────────────────────────
type ForecastTarget = {
    label: string
    values: number[]
    trend?: string
    unit?: string
}

type ForecastTimeline = {
    day: number
    avg_battery_voltage_v?: number
    avg_coolant_temp_c?: number
    fuel_consumption_l100km?: number
    idle_minutes?: number
}

type ForecastData = {
    vehicleId: string
    horizon: number
    daysAvailable: number
    missingDays: number
    globalAlerts: string[]
    targets: ForecastTarget[]
    timeline: ForecastTimeline[]
}

// ── Helpers ────────────────────────────────────────────────────
const getTrend = (values: number[] = []) => {
    if (values.length < 2) return 'stable'
    const delta = values[values.length - 1] - values[0]
    if (delta > 0.5) return 'up'
    if (delta < -0.5) return 'down'
    return 'stable'
}

const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up')
        return <TbTrendingUp size={14} className="text-red-500" />
    if (trend === 'down')
        return <TbTrendingDown size={14} className="text-emerald-500" />
    return <TbMinus size={14} className="text-gray-400" />
}

// ── Inline Stat Segment (identique au Dashboard) ───────────────
const InlineStatSegment = ({ title, value, unit, icon, iconClass, trend }: { 
    title: string; 
    value: string; 
    unit?: string; 
    icon: React.ReactNode; 
    iconClass: string;
    trend?: string;
}) => (
    <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-[140px]">
        <div className={classNames('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg', iconClass)}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{title}</div>
            <div className="flex items-baseline gap-1">
                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {value}
                </div>
                {unit && <span className="text-xs text-gray-500">{unit}</span>}
                {trend && (
                    <div className="flex items-center ml-1">
                        <TrendIcon trend={trend} />
                    </div>
                )}
            </div>
        </div>
    </div>
)

// ── Section Title (identique au Dashboard) ─────────────────────
const SectionTitle = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon && <span className="text-gray-400">{icon}</span>}
        {children}
    </div>
)

// ── Empty State ────────────────────────────────────────────────
const Empty = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/40 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/30">
        <div className="mb-2 text-4xl">📊</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{children}</div>
    </div>
)

// ── Skeleton Loader ────────────────────────────────────────────
const Skeleton = () => (
    <div className="space-y-3">
        {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
    </div>
)

// ── Custom tooltip ─────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, unit, color }: any) => {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900/95">
            <p className="text-xs text-gray-500 mb-1">Day {label}</p>
            <p className="font-semibold text-gray-900 dark:text-white" style={{ color }}>
                {payload[0].value?.toFixed(2)} {unit}
            </p>
        </div>
    )
}

// ── Chart card style Dashboard ─────────────────────────────────
const ForecastChartCard = ({
    title,
    data,
    dataKey,
    color,
    unit,
    icon,
    refValue,
}: {
    title: string
    data: ForecastTimeline[]
    dataKey: string
    color: string
    unit: string
    icon: React.ReactNode
    refValue?: number
}) => {
    const chartData = useMemo(() => 
        data.map(item => ({
            day: item.day,
            value: item[dataKey as keyof ForecastTimeline] as number,
        })), [data, dataKey]
    )

    const gradientId = `forecast-gradient-${dataKey}`

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ background: `${color}20` }}
                    >
                        <span style={{ color }}>{icon}</span>
                    </div>
                    <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {title}
                    </h5>
                </div>
                <span
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: `${color}15`, color }}
                >
                    {unit}
                </span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="#E5E7EB" 
                        vertical={false} 
                    />
                    <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        tickFormatter={(v) => `D${v}`}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                    />
                    <Tooltip
                        content={<ChartTooltip unit={unit} color={color} />}
                        cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    {refValue && (
                        <ReferenceLine
                            y={refValue}
                            stroke={color}
                            strokeDasharray="4 4"
                            strokeOpacity={0.4}
                            label={{ value: 'Warning', fill: color, fontSize: 10, position: 'right' }}
                        />
                    )}
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        fill={`url(#${gradientId})`}
                        strokeWidth={2.5} 
                        dot={false}
                        activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── Main Component ───────────────────────────────────────────────
const ForecastDashboard = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const vehicleId = id ?? window.location.pathname.split('/').pop()

    const [forecast, setForecast] = useState<ForecastData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!vehicleId) { setLoading(false); return }
        fetchForecast(vehicleId)
    }, [vehicleId])

    const fetchForecast = async (id: string) => {
        try {
            setLoading(true)
            setError(false)
            const { data } = await axios.get(
             `${import.meta.env.VITE_API_URL}/vehicles/${id}/forecast`,  
             )
            setForecast(data)
        } catch (e) {
            console.error('Forecast Error:', e)
            setError(true)
            setForecast(null)
        } finally {
            setLoading(false)
        }
    }

    const battery = forecast?.targets?.find((t) => t.label === 'Battery Voltage')
    const coolant = forecast?.targets?.find((t) => t.label === 'Coolant Temp')
    const fuel = forecast?.targets?.find((t) => t.label === 'Fuel Consumption')
    const idle = forecast?.targets?.find((t) => t.label === 'Idle Time')
    
    const healthScore = Math.max(0, 100 - (forecast?.globalAlerts?.length ?? 0) * 10)
    
    const healthColor =
        healthScore > 80
            ? 'text-emerald-600 dark:text-emerald-400'
            : healthScore > 50
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'

    const healthBg =
        healthScore > 80
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
            : healthScore > 50
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6 p-1">
                <Card className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-700/70 dark:bg-gray-900">
                    {/* Header */}
                    <div className="bg-white px-6 py-5 dark:bg-gray-900">
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                            Vehicle Forecast
                                        </h3>
                                    </div>
                                  
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="solid"
                                        size="sm"
                                        icon={<TbArrowLeft />}
                                        onClick={() => navigate(-1)}
                                        className="rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        Back
                                    </Button>
                                </div>
                            </div>

                            {/* Error display */}
                            {error && !loading && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-950/30">
                                    <TbAlertTriangle className="mr-2 inline" size={14} />
                                    Failed to load forecast data. Please try again.
                                    <Button
                                        size="xs"
                                        variant="solid"
                                        onClick={() => vehicleId && fetchForecast(vehicleId)}
                                        className="ml-3 bg-red-600 hover:bg-red-700"
                                    >
                                        Retry
                                    </Button>
                                </div>
                            )}

                            

                            {/* KPI Cards - styled like Dashboard stats row */}
                            <div className="rounded-2xl border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/40">
                                <div className="flex flex-wrap divide-x divide-gray-200 dark:divide-gray-700">
                                    <InlineStatSegment
                                        title="Battery Voltage"
                                        value={battery?.values?.[0]?.toFixed(2) ?? '—'}
                                        unit="V"
                                        icon={<TbBattery2 size={14} />}
                                        iconClass="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                                        trend={getTrend(battery?.values)}
                                    />
                                    <InlineStatSegment
                                        title="Coolant Temperature"
                                        value={coolant?.values?.[0]?.toFixed(1) ?? '—'}
                                        unit="°C"
                                        icon={<TbDroplet size={14} />}
                                        iconClass="bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300"
                                        trend={getTrend(coolant?.values)}
                                    />
                                    <InlineStatSegment
                                        title="Fuel Consumption"
                                        value={fuel?.values?.[0]?.toFixed(2) ?? '—'}
                                        unit="L/100km"
                                        icon={<TbFlame size={14} />}
                                        iconClass="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
                                        trend={getTrend(fuel?.values)}
                                    />
                                    <InlineStatSegment
                                        title="Health Score"
                                        value={String(healthScore)}
                                        unit="%"
                                        icon={<TbShieldCheck size={14} />}
                                        iconClass={healthBg}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="p-6 pt-0">
                        {!loading && !error && !forecast && (
                            <Empty>No forecast data available for this vehicle</Empty>
                        )}

                        {forecast && !loading && (
                            <>
                                <SectionTitle icon={<TbChartLine size={14} />}>
                                    Forecast Trends — Next {forecast.horizon} Days
                                </SectionTitle>
                                
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                    <ForecastChartCard
                                        title="Battery Voltage"
                                        data={forecast.timeline}
                                        dataKey="avg_battery_voltage_v"
                                        color="#3b82f6"
                                        unit="V"
                                        icon={<TbBattery2 size={16} />}
                                    />
                                    <ForecastChartCard
                                        title="Coolant Temperature"
                                        data={forecast.timeline}
                                        dataKey="avg_coolant_temp_c"
                                        color="#06b6d4"
                                        unit="°C"
                                        icon={<TbDroplet size={16} />}
                                        refValue={100}
                                    />
                                    <ForecastChartCard
                                        title="Fuel Consumption"
                                        data={forecast.timeline}
                                        dataKey="fuel_consumption_l100km"
                                        color="#f97316"
                                        unit="L/100km"
                                        icon={<TbFlame size={16} />}
                                    />
                                    <ForecastChartCard
                                        title="Idle Time"
                                        data={forecast.timeline}
                                        dataKey="idle_minutes"
                                        color="#f59e0b"
                                        unit="min"
                                        icon={<TbClock size={16} />}
                                    />
                                </div>

                                {/* Data Quality Note */}
                                {forecast.missingDays > 0 && (
                                    <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/40 p-3 dark:border-gray-700 dark:bg-gray-900/30">
                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <TbInfoCircle size={14} />
                                            <span>
                                                Note: {forecast.missingDays} day(s) of historical data are missing.
                                                Forecast accuracy may be affected.
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Card>
            </div>
        </Loading>
    )
}

export default ForecastDashboard