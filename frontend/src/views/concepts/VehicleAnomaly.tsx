import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, AreaChart
} from 'recharts'
import { 
    PiWarningCircleFill, 
    PiEngineFill, 
    PiLightbulbFill, 
    PiCarFill,
    PiGaugeFill, 
    PiClockFill, 
    PiChartLineFill, 
    PiListBulletsFill,
    PiArrowDown, 
    PiArrowUp, 
    PiCheckCircleFill, 
    PiXBold,
    PiShieldCheckFill, 
    PiGearFill, 
    PiBatteryVerticalFullFill,
    PiPlugFill, 
    PiHandCoinsFill, 
    PiBrainFill, 
    PiChartBarFill,
    PiThermometer, 
    PiArrowClockwiseFill, 
    PiWarningCircle
} from 'react-icons/pi'

import {
    apiGetAnomalies,
    apiGetFailureClassification,
    apiGetAllRecommendations,
} from '@/services/AnomalyService'

import ApiService from '@/services/ApiService'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'
import { COLORS } from '@/constants/chart.constant'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface Vehicle {
    id: string
    make?: string
    model?: string
    year?: number
    plateNumber?: string
    vin?: string
    createdAt?: string
    created_at?: string
}

interface Anomaly {
    sensorReadingId: string
    timestamp: string
    prediction?: number
    score: number
    is_anomaly: boolean
    anomaly_probability: number
}

interface Failure {
    component: string
    risk_level: 'high_risk' | 'medium_risk' | 'low_risk'
    confidence?: number
    risk_probabilities?: {
        high_risk?: number
        medium_risk?: number
        low_risk?: number
    }
}

interface RecommendationAction {
    rank: number
    final_score: number
    similarity_score: number
    fault_match_score: number
    ml_risk_score: number
    urgency: string
    component: string
    problem_description: string
    diagnosis: string
    action: string
    solution_used: string
    repair_status: string
    results: string
    car_name: string
    confidence: number
    estimated_cost: string
    reasoning: string
    coherence: number
    title?: string
    description?: string
    cost_estimate?: string
}

interface ComponentRecommendation {
    anomaly_prob?: number
    risk_label?: string
    risk_proba?: number
    risk_probabilities?: {
        high_risk?: number
        medium_risk?: number
        low_risk?: number
        no_risk?: number
    }
    fault_label?: string
    fault_proba?: number
    ml_risk_score?: number
    triggered?: boolean
    trigger_message?: string
    recommendations?: RecommendationAction[]
    actions?: Array<{
        title: string
        description: string
        urgency: 'immediate' | 'soon' | 'routine'
        cost_estimate?: string
    }>
}

interface RecommendationItem {
    component: string
    recommendations?: ComponentRecommendation
    error?: string
}

interface RecommendationsResponse {
    vehicleId: string
    highRiskComponents: string[]
    recommendations: RecommendationItem[]
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

async function apiGetMyVehicles() {
    return ApiService.fetchDataWithAxios<any>({
        url: '/vehicles',
        method: 'get',
    })
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const RISK_META = {
    high_risk:   { label: 'High Risk',   color: '#DC2626', bg: '#FEF2F2', border: '#FEE2E2' },
    medium_risk: { label: 'Medium Risk', color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
    low_risk:    { label: 'Low Risk',    color: '#059669', bg: '#ECFDF5', border: '#D1FAE5' },
}

const COMPONENT_ICON: Record<string, React.ReactNode> = {
    engine:         <PiEngineFill size={18} />,
    electrical:     <PiPlugFill size={18} />,
    transmission:   <PiGearFill size={18} />,
    battery:        <PiBatteryVerticalFullFill size={18} />,
    brakes:         <PiWarningCircleFill size={18} />,
    fuel_system:    <PiGaugeFill size={18} />,
    cooling_system: <PiThermometer size={18} />,
}

function pct(v?: number) {
    return `${((v ?? 0) * 100).toFixed(0)}%`
}

function vehicleLabel(v?: Vehicle | null) {
    if (!v) return '—'
    const parts = [v.make, v.model, v.year].filter(Boolean).join(' ')
    return parts || v.plateNumber || v.vin || `Vehicle ${v.id.slice(0, 8)}`
}

function parseUrgencyLabel(raw: string): { label: string; color: string; bg: string } {
    if (raw.includes('HIGH')   || raw.includes('🟠')) return { label: 'High',   color: '#C2410C', bg: '#FFF7ED' }
    if (raw.includes('MEDIUM') || raw.includes('🟡')) return { label: 'Medium', color: '#B45309', bg: '#FFFBEB' }
    if (raw.includes('LOW')    || raw.includes('🟢')) return { label: 'Low',    color: '#15803D', bg: '#F0FDF4' }
    if (raw === 'immediate') return { label: 'Immediate', color: '#DC2626', bg: '#FEF2F2' }
    if (raw === 'soon')      return { label: 'Soon',      color: '#D97706', bg: '#FFFBEB' }
    if (raw === 'routine')   return { label: 'Routine',   color: '#3B82F6', bg: '#EFF6FF' }
    return { label: raw, color: '#64748B', bg: '#F8FAFC' }
}

// ─────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS (styled like Dashboard)
// ─────────────────────────────────────────────────────────────

function InlineStatSegment({ title, value, icon, iconClass, loading }: { title: string; value: string | number; icon: React.ReactNode; iconClass: string; loading?: boolean }) {
    return (
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-[140px]">
            <div className={classNames('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg', iconClass, loading ? 'opacity-50' : '')}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{title}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {loading ? '—' : value}
                </div>
            </div>
        </div>
    )
}

function RiskBadge({ level }: { level: string }) {
    const meta = RISK_META[level as keyof typeof RISK_META] ?? RISK_META.low_risk
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold`} style={{ background: meta.bg, color: meta.color }}>
            <PiShieldCheckFill size={10} />
            {meta.label}
        </span>
    )
}

function UrgencyBadge({ urgency }: { urgency: string }) {
    const meta = parseUrgencyLabel(urgency)
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold`} style={{ background: meta.bg, color: meta.color }}>
            <PiClockFill size={10} />
            {meta.label}
        </span>
    )
}

function ProgressBar({ value, color, label }: { value: number; color: string; label?: string }) {
    return (
        <div>
            {label && (
                <div className="mb-1 flex justify-between">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-semibold text-gray-700">{value.toFixed(0)}%</span>
                </div>
            )}
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
            </div>
        </div>
    )
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {icon && <span className="text-gray-400">{icon}</span>}
            {children}
        </div>
    )
}

function Empty({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/40 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/30">
            <div className="mb-2 text-4xl">📊</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{children}</div>
        </div>
    )
}

function Skeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// ANOMALY CHART COMPONENT (styled like Dashboard charts)
// ─────────────────────────────────────────────────────────────

function AnomalyChart({ anomalies, loading, vehicleId }: { anomalies: Anomaly[]; loading: boolean; vehicleId: string }) {
    if (loading) return <Skeleton />
    if (!anomalies.length) return <Empty>No anomaly data available</Empty>

    const chartData = anomalies
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((a) => ({
            timestamp: a.timestamp,
            probability: a.anomaly_probability * 100,
            isAnomaly: a.is_anomaly,
            id: a.sensorReadingId,
        }))

    const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <SectionTitle icon={<PiChartLineFill size={14} />}>Anomaly Probability Over Time</SectionTitle>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id={`anomalyGradient-${vehicleId}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatTime}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        interval="preserveStartEnd"
                        tickCount={8}
                        minTickGap={24}
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        tickLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis 
                        tick={{ fontSize: 12, fill: '#64748b' }} 
                        tickLine={false} 
                        unit="%" 
                        domain={[0, 100]}
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                    />
                    <Tooltip
                        labelFormatter={(value) => new Date(String(value)).toLocaleString()}
                        formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Anomaly Probability']}
                        contentStyle={{
                            borderRadius: 12,
                            border: '1px solid rgba(148,163,184,0.2)',
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                    />
                    <ReferenceLine y={70} stroke="#D97706" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'High', position: 'right', fontSize: 10, fill: '#D97706' }} />
                    <ReferenceLine y={30} stroke="#3B82F6" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Normal', position: 'right', fontSize: 10, fill: '#3B82F6' }} />
                    <Area type="monotone" dataKey="probability" stroke="none" fill={`url(#anomalyGradient-${vehicleId})`} />
                    <Line 
                        type="monotone" 
                        dataKey="probability" 
                        stroke="#DC2626" 
                        strokeWidth={2} 
                        dot={(props: any) => {
                            const { cx, cy, payload } = props
                            if (payload.isAnomaly) {
                                return <circle cx={cx} cy={cy} r={5} fill="#DC2626" stroke="#FFFFFF" strokeWidth={2} />
                            }
                            return <circle cx={cx} cy={cy} r={2.5} fill="#3B82F6" stroke="#FFFFFF" strokeWidth={1.5} />
                        }} 
                        activeDot={{ r: 6, strokeWidth: 2 }} 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// RECOMMENDATIONS SUB-COMPONENTS (styled)
// ─────────────────────────────────────────────────────────────

function CoherenceBar({ value }: { value: number }) {
    const p = Math.round(value * 100)
    const color = value >= 0.7 ? '#16A34A' : value >= 0.4 ? '#D97706' : '#DC2626'
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
            </div>
            <span className="text-xs font-semibold text-gray-500">{p}%</span>
        </div>
    )
}

function ScoreItem({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-2 text-center dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-[10px] font-bold uppercase text-gray-400">{label}</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">{(value * 100).toFixed(0)}%</div>
        </div>
    )
}

function ActionCard({ action, expanded, onToggle }: { action: RecommendationAction; expanded: boolean; onToggle: () => void }) {
    const urgency = parseUrgencyLabel(action.urgency)
    const cost = action.estimated_cost ?? action.cost_estimate

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <button 
                onClick={onToggle} 
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {action.rank}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {action.action ?? action.title}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {action.diagnosis && <span>{action.diagnosis}</span>}
                        
                        
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <UrgencyBadge urgency={action.urgency} />
                    {cost && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">💰 {cost}</span>}
                    <span className="text-gray-400 transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
                        <PiArrowDown size={12} />
                    </span>
                </div>
            </button>
            {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/40 p-4 dark:border-gray-800 dark:bg-gray-900/30">
                    <div className="mb-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        {action.problem_description && (
                            <div><span className="font-semibold text-gray-700 dark:text-gray-300">Problem:</span> {action.problem_description}</div>
                        )}
                        {action.diagnosis && (
                            <div><span className="font-semibold text-gray-700 dark:text-gray-300">Diagnosis:</span> {action.diagnosis}</div>
                        )}
                        {action.solution_used && (
                            <div className="sm:col-span-2"><span className="font-semibold text-gray-700 dark:text-gray-300">Solution:</span> {action.solution_used}</div>
                        )}
                    </div>
                    {action.final_score !== undefined && (
                        <div className="mb-3 grid grid-cols-5 gap-2">
                            <ScoreItem label="Final" value={action.final_score} />
                            <ScoreItem label="Similarity" value={action.similarity_score} />
                            
                            <ScoreItem label="ML risk" value={action.ml_risk_score} />
                            <ScoreItem label="Confidence" value={action.confidence} />
                        </div>
                    )}
                    
                </div>
            )}
        </div>
    )
}

function ComponentPanel({ item }: { item: RecommendationItem }) {
    const [expanded, setExpanded] = useState(false)
    const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set())

    const rec = item.recommendations
    const riskLevel = rec?.risk_label ?? 'low_risk'
    const actions: RecommendationAction[] = rec?.recommendations ?? (rec?.actions?.map((a, i) => ({
        rank: i + 1, final_score: 0, similarity_score: 0, fault_match_score: 0, ml_risk_score: 0,
        urgency: a.urgency, component: item.component, problem_description: '', diagnosis: '',
        action: a.title, title: a.title, description: a.description, solution_used: '', repair_status: '',
        results: '', car_name: '', confidence: 0, estimated_cost: a.cost_estimate ?? '', cost_estimate: a.cost_estimate,
        reasoning: '', coherence: 0,
    })) ?? [])

    const toggleAction = (rank: number) => {
        setExpandedActions(prev => { const next = new Set(prev); next.has(rank) ? next.delete(rank) : next.add(rank); return next })
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <button 
                onClick={() => setExpanded(v => !v)} 
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
                <span className="text-gray-600 dark:text-gray-400">
                    {COMPONENT_ICON[item.component] ?? <PiGearFill size={18} />}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold capitalize text-gray-900 dark:text-white">
                            {item.component.replace(/_/g, ' ')}
                        </span>
                        {rec && <RiskBadge level={riskLevel} />}
                        {rec?.fault_label && rec.fault_label !== 'normal' && (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">
                                🔧 {rec.fault_label.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>
                    {rec && (
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                            {rec.anomaly_prob !== undefined && <span>📊 Anomaly: {pct(rec.anomaly_prob)}</span>}
                            {rec.risk_proba !== undefined && <span><PiWarningCircle size={10} className="inline" /> Risk: {pct(rec.risk_proba)}</span>}
                            <span><PiLightbulbFill size={10} className="inline" /> {actions.length} action{actions.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>
                <span className="text-gray-400 transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
                    <PiArrowDown size={14} />
                </span>
            </button>
            {expanded && (
                <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                    {rec?.risk_probabilities && (
                        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/40 p-3 dark:border-gray-800 dark:bg-gray-900/30">
                            <SectionTitle icon={<PiChartBarFill size={12} />}>Risk distribution</SectionTitle>
                            <div className="space-y-2">
                                <ProgressBar label="High risk" value={(rec.risk_probabilities.high_risk ?? 0) * 100} color="#DC2626" />
                                <ProgressBar label="Medium risk" value={(rec.risk_probabilities.medium_risk ?? 0) * 100} color="#D97706" />
                                <ProgressBar label="Low risk" value={(rec.risk_probabilities.low_risk ?? 0) * 100} color="#059669" />
                            </div>
                        </div>
                    )}
                    {actions.length > 0 && (
                        <>
                            <SectionTitle icon={<PiLightbulbFill size={12} />}>Recommended actions</SectionTitle>
                            <div className="space-y-2">
                                {actions.map(a => <ActionCard key={a.rank} action={a} expanded={expandedActions.has(a.rank)} onToggle={() => toggleAction(a.rank)} />)}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN DASHBOARD (styled like Dashboard)
// ─────────────────────────────────────────────────────────────

import classNames from '@/utils/classNames'

export default function MLPredictionsDashboard() {
    const mounted = useRef(true)
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [vehiclesLoading, setVehiclesLoading] = useState(true)
    const [vehiclesError, setVehiclesError] = useState<string | null>(null)
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [failures, setFailures] = useState<Failure[]>([])
    const [recs, setRecs] = useState<RecommendationsResponse | null>(null)
    const [tab, setTab] = useState<'overview' | 'anomalies' | 'failures' | 'recommendations'>('overview')
    const [loading, setLoading] = useState({ anomalies: false, failures: false, recs: false })
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        mounted.current = true
        async function loadVehicles() {
            try {
                setVehiclesLoading(true)
                const res: any = await apiGetMyVehicles()
                const data = res?.data?.data ?? res?.data ?? res?.vehicles ?? res ?? []
                const list: Vehicle[] = Array.isArray(data) ? data : []
                const sorted = [...list].sort((a, b) => {
                    const da = new Date(a.createdAt ?? a.created_at ?? 0).getTime()
                    const db = new Date(b.createdAt ?? b.created_at ?? 0).getTime()
                    return db - da
                })
                if (!mounted.current) return
                setVehicles(sorted)
                if (sorted.length > 0) setSelectedVehicleId(sorted[0].id)
            } catch (e: any) {
                if (!mounted.current) return
                setVehiclesError(e?.message ?? 'Failed to load vehicles')
            } finally {
                if (mounted.current) setVehiclesLoading(false)
            }
        }
        loadVehicles()
        return () => { mounted.current = false }
    }, [])

    const loadPredictions = useCallback(async (vehicleId: string) => {
        if (!vehicleId) return
        setErrors({})
        setAnomalies([])
        setFailures([])
        setRecs(null)
        setLoading({ anomalies: true, failures: true, recs: true })
        const settle = async (promise: Promise<any>, key: string) => {
            try {
                const res = await promise
                const data = res?.data ?? res
                if (!mounted.current) return
                if (key === 'anomalies' && Array.isArray(data)) setAnomalies(data)
                if (key === 'failures' && Array.isArray(data)) setFailures(data)
                if (key === 'recs') setRecs(data)
            } catch (e: any) {
                if (!mounted.current) return
                setErrors(prev => ({ ...prev, [key]: e?.message ?? 'Request failed' }))
            } finally {
                if (!mounted.current) return
                setLoading(prev => ({ ...prev, [key]: false }))
            }
        }
        await Promise.all([
            settle(apiGetAnomalies(vehicleId), 'anomalies'),
            settle(apiGetFailureClassification(vehicleId), 'failures'),
            settle(apiGetAllRecommendations(vehicleId), 'recs'),
        ])
    }, [])

    useEffect(() => {
        if (selectedVehicleId) loadPredictions(selectedVehicleId)
    }, [selectedVehicleId, loadPredictions])

    const anomalyCount = useMemo(() => anomalies.filter(a => a.is_anomaly).length, [anomalies])
    const highRiskCount = useMemo(() => failures.filter(f => f.risk_level === 'high_risk').length, [failures])
    const actionCount = useMemo(() => {
        if (!recs) return 0
        return recs.recommendations.reduce((sum, r) => sum + (r.recommendations?.recommendations?.length ?? r.recommendations?.actions?.length ?? 0), 0)
    }, [recs])
    const sortedFailures = useMemo(() => [...failures].sort((a, b) => (b.risk_probabilities?.high_risk ?? 0) - (a.risk_probabilities?.high_risk ?? 0)), [failures])
    const urgentActions = useMemo(() => {
        if (!recs) return []
        return recs.recommendations.flatMap(r => {
            const newActions = (r.recommendations?.recommendations ?? []).filter(a => a.urgency.toUpperCase().includes('HIGH') || a.urgency === 'IMMEDIATE').map(a => ({ ...a, _component: r.component }))
            const legActions = (r.recommendations?.actions ?? []).filter(a => a.urgency === 'immediate').map((a, i) => ({ rank: i + 1, action: a.title, urgency: a.urgency, estimated_cost: a.cost_estimate, _component: r.component }))
            return [...newActions, ...legActions]
        }).slice(0, 3)
    }, [recs])

    const anyLoading = Object.values(loading).some(Boolean)
    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId)

    return (
        <Loading loading={vehiclesLoading}>
            <div className="flex flex-col gap-1 p-1">
                <Card className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-700/70 dark:bg-gray-900">
                    <div className="bg-white px-6 py-5 dark:bg-gray-900">
                        <div className="flex flex-col gap-5">
                            {/* Header */}
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                            ML Vehicle Diagnostics
                                        </h3>
                                    </div>
                                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        {vehiclesLoading ? 'Loading vehicles…' : vehicleLabel(selectedVehicle)}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {vehiclesError ? (
                                        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                                            <PiWarningCircleFill className="inline mr-1" size={12} /> {vehiclesError}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                Select Vehicle:
                                            </span>
                                            <div className="relative">
                                            <select 
                                                value={selectedVehicleId ?? ''} 
                                                disabled={vehiclesLoading} 
                                                onChange={e => setSelectedVehicleId(e.target.value)} 
                                                className="appearance-none cursor-pointer rounded-xl border border-gray-200 bg-white pl-4 pr-10 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            >
                                                {vehiclesLoading && <option>Loading…</option>}
                                                {!vehiclesLoading && vehicles.length === 0 && <option>No vehicles found</option>}
                                                {vehicles.map(v => <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}
                                            </select>
                                            <PiArrowDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                        </div>
                                        </div>
                                    )}
                                   
                                </div>
                            </div>

                            {/* Errors display */}
                            {Object.entries(errors).map(([k, v]) => (
                                <div key={k} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-950/30">
                                    <PiWarningCircleFill className="mr-2 inline" size={14} />
                                    <strong>{k}:</strong> {v}
                                </div>
                            ))}

                            {/* KPI Cards - styled like Dashboard stats row */}
                            <div className="rounded-2xl border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/40">
                                <div className="flex flex-wrap divide-x divide-gray-200 dark:divide-gray-700">
                                    <InlineStatSegment 
                                        title="Detected Anomalies" 
                                        value={anomalyCount} 
                                        icon={<PiWarningCircleFill size={14} />}
                                        iconClass="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                                        loading={loading.anomalies}
                                    />
                                    <InlineStatSegment 
                                        title="High Risk Components" 
                                        value={highRiskCount} 
                                        icon={<PiWarningCircle size={14} />}
                                        iconClass="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
                                        loading={loading.failures}
                                    />
                                    <InlineStatSegment 
                                        title="Recommended Actions" 
                                        value={actionCount} 
                                        icon={<PiLightbulbFill size={14} />}
                                        iconClass="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                                        loading={loading.recs}
                                    />
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 rounded-xl bg-gray-100/50 p-1 dark:bg-gray-800 w-fit">
                                {(['overview', 'anomalies', 'failures', 'recommendations'] as const).map(t => (
                                    <button 
                                        key={t} 
                                        onClick={() => setTab(t)} 
                                        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                                            tab === t 
                                                ? 'bg-white text-green-600 shadow-sm dark:bg-gray-900 dark:text-green-500' 
                                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                        }`}
                                    >
                                        {t === 'overview' && <PiChartBarFill size={14} />}
                                        {t === 'anomalies' && <PiWarningCircleFill size={14} />}
                                        {t === 'failures' && <PiWarningCircle size={14} />}
                                        {t === 'recommendations' && <PiLightbulbFill size={14} />}
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Overview Tab */}
                        {/* Overview Tab */}
{tab === 'overview' && (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Colonne gauche - Top Risk Components */}
        <div className="flex flex-col h-full">
            <SectionTitle icon={<PiChartBarFill size={12} />}>Top Risk Components</SectionTitle>
            {loading.failures ? 
                <Skeleton /> : 
                sortedFailures.length === 0 ? 
                    <Empty>No failure data</Empty> : 
                    <div className="flex-1 space-y-3">
                        {sortedFailures.slice(0, 3).map(f => {
                            const meta = RISK_META[f.risk_level] ?? RISK_META.low_risk
                            const hr = (f.risk_probabilities?.high_risk ?? 0) * 100
                            return (
                                <div key={f.component} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                            {COMPONENT_ICON[f.component] ?? <PiGearFill size={16} />} 
                                            {f.component.replace(/_/g, ' ')}
                                        </span>
                                        <RiskBadge level={f.risk_level} />
                                    </div>
                                    <ProgressBar value={hr} color={meta.color} label='High-risk probability' />
                                </div>
                            )
                        })}
                    </div>
            }
        </div>

        {/* Colonne droite - Urgent Actions */}
        <div className="flex flex-col h-full">
            <SectionTitle icon={<PiClockFill size={12} />}>Urgent Actions</SectionTitle>
            {loading.recs ? 
                <Skeleton /> : 
                urgentActions.length === 0 ? 
                    <Empty>No urgent actions</Empty> : 
                    <div className="flex-1 space-y-3">
                        {urgentActions.map((a: any, i: number) => (
                            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{a.action ?? a.title}</div>
                                {a.description && <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">{a.description}</div>}
                                <div className="flex flex-wrap items-center gap-2">
                                    <UrgencyBadge urgency={a.urgency} />
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        {COMPONENT_ICON[a._component] ?? <PiGearFill size={12} />} 
                                        {a._component.replace(/_/g, ' ')}
                                    </span>
                                    {a.estimated_cost && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">💰 {a.estimated_cost}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
            }
        </div>
    </div>
)}

                        {/* Anomalies Tab */}
                        {tab === 'anomalies' && selectedVehicleId && (
                            <div>
                                <AnomalyChart anomalies={anomalies} loading={loading.anomalies} vehicleId={selectedVehicleId} />
                              
                            </div>
                        )}

                        {/* Failures Tab */}
                        {tab === 'failures' && (
                            <div className="space-y-3">
                                {loading.failures ? (
                                    <Skeleton />
                                ) : sortedFailures.length === 0 ? (
                                    <Empty>No failure data available</Empty>
                                ) : (
                                    sortedFailures.map((f) => {
                                        const meta = RISK_META[f.risk_level as keyof typeof RISK_META] ?? RISK_META.low_risk
                                        const highProb = (f.risk_probabilities?.high_risk ?? 0) * 100
                                        const mediumProb = (f.risk_probabilities?.medium_risk ?? 0) * 100
                                        const lowProb = (f.risk_probabilities?.low_risk ?? 0) * 100
                                        const maxProb = Math.max(highProb, mediumProb, lowProb)
                                        const scoreColor = highProb > 50 ? '#DC2626' : mediumProb > 30 ? '#D97706' : '#059669'
                                        
                                        return (
                                            <div 
                                                key={f.component} 
                                                className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-900"
                                                style={{ borderColor: meta.border }}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ background: meta.bg, borderBottomColor: meta.color }}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-700 dark:text-gray-300">
                                                            {COMPONENT_ICON[f.component] ?? <PiGearFill size={16} />}
                                                        </span>
                                                        <span className="text-sm font-semibold capitalize text-gray-900 dark:text-white">
                                                            {f.component.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                                                        <RiskBadge level={f.risk_level} />
                                                    </div>
                                                </div>

                                                <div className="p-2">
                                                    <div className="mb-3">
                                                        <div className="mb-1 flex items-center justify-between">
                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Overall Risk Score</span>
                                                            <span className="text-sm font-bold" style={{ color: scoreColor }}>{maxProb.toFixed(0)}%</span>
                                                        </div>
                                                        <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                                            <div className="h-full" style={{ width: `${highProb}%`, background: '#DC2626' }} />
                                                            <div className="h-full" style={{ width: `${mediumProb}%`, background: '#D97706' }} />
                                                            <div className="h-full" style={{ width: `${lowProb}%`, background: '#059669' }} />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                                                        <div className="text-center">
                                                            <div className="text-[9px] font-semibold uppercase text-gray-400">🔴 High</div>
                                                            <div className="text-sm font-bold text-red-600">{highProb.toFixed(0)}%</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[9px] font-semibold uppercase text-gray-400">🟠 Medium</div>
                                                            <div className="text-sm font-bold text-amber-600">{mediumProb.toFixed(0)}%</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[9px] font-semibold uppercase text-gray-400">🟢 Low</div>
                                                            <div className="text-sm font-bold text-emerald-600">{lowProb.toFixed(0)}%</div>
                                                        </div>
                                                    </div>

                                                    {(f.confidence !== undefined && f.confidence !== null) && (
                                                        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                                                            <span className="text-[9px] font-semibold uppercase text-gray-400">Confidence</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                                                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (f.confidence ?? 0) * 100)}%` }} />
                                                                </div>
                                                                <span className="text-xs font-semibold text-blue-600">{((f.confidence ?? 0) * 100).toFixed(0)}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}

                        {/* Recommendations Tab */}
                        {tab === 'recommendations' && (
                            <div>
                                {loading.recs ? <Skeleton /> : !recs || recs.recommendations.length === 0 ? <Empty>No recommendations</Empty> : (
                                    <>
                                        {recs.highRiskComponents.length > 0 && (
                                            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800/30 dark:bg-red-950/30">
                                                <span className="flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400">
                                                    <PiWarningCircle size={12} /> High-risk:
                                                </span>
                                                {recs.highRiskComponents.map(c => (
                                                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-red-700 shadow-sm dark:bg-gray-900 dark:text-red-400">
                                                        {COMPONENT_ICON[c] ?? <PiGearFill size={10} />} {c.replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {recs.recommendations.map(item => <ComponentPanel key={item.component} item={item} />)}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </Loading>
    )
}