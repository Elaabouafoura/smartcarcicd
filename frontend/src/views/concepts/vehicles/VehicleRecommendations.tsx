import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import useSWR from 'swr'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import {
    TbArrowLeft,
    TbAlertTriangle,
    TbTool,
    TbChevronDown,
    TbChevronUp,
    TbBrain,
    TbShieldCheck,
    TbClock,
    TbCalendar,
    TbCalendarMonth,
    TbCurrencyDollar,
} from 'react-icons/tb'
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
    // enriched from parent component during flatten
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

const COMPONENT_ICONS: Record<string, string> = {
    engine: '🔧',
    electrical: '⚡',
    transmission: '⚙️',
    battery: '🔋',
    brakes: '🛑',
    fuel_system: '⛽',
    cooling_system: '❄️',
}

// ── Timeline bucket config ─────────────────────────────────────
type Bucket = {
    key: string
    label: string
    sublabel: string
    icon: React.ReactNode
    accentBg: string
    accentText: string
    accentBorder: string
    lineBg: string
    dotBg: string
    filter: (r: Recommendation) => boolean
}

const TIMELINE_BUCKETS: Bucket[] = [
    {
        key: 'now',
        label: 'Immediate action',
        sublabel: 'Safety or imminent breakdown risk',
        icon: <TbClock size={16} />,
        accentBg: 'bg-red-50 dark:bg-red-900/10',
        accentText: 'text-red-700 dark:text-red-400',
        accentBorder: 'border-red-200 dark:border-red-800',
        lineBg: 'bg-red-200 dark:bg-red-800',
        dotBg: 'bg-red-500',
        filter: (r) => r.urgency.includes('HIGH'),
    },
    {
        key: 'week',
        label: 'This week',
        sublabel: 'Schedule within the next 7 days',
        icon: <TbCalendar size={16} />,
        accentBg: 'bg-amber-50 dark:bg-amber-900/10',
        accentText: 'text-amber-700 dark:text-amber-400',
        accentBorder: 'border-amber-200 dark:border-amber-800',
        lineBg: 'bg-amber-200 dark:bg-amber-800',
        dotBg: 'bg-amber-500',
        filter: (r) => r.urgency.includes('MEDIUM'),
    },
    {
        key: 'month',
        label: 'This month',
        sublabel: 'Preventive maintenance to schedule',
        icon: <TbCalendarMonth size={16} />,
        accentBg: 'bg-blue-50 dark:bg-blue-900/10',
        accentText: 'text-blue-700 dark:text-blue-400',
        accentBorder: 'border-blue-200 dark:border-blue-800',
        lineBg: 'bg-blue-200 dark:bg-blue-800',
        dotBg: 'bg-blue-400',
        filter: (r) => !r.urgency.includes('HIGH') && !r.urgency.includes('MEDIUM'),
    },
]

// ── Helpers ────────────────────────────────────────────────────

// urgency arrives as "🟠 HIGH" or "🟡 MEDIUM" — strip emoji, normalize to plain text
const normalizeUrgency = (urgency: string): string =>
    urgency.replace(/[^\w\s]/g, '').trim().toUpperCase()

// Composite danger score = weighted combination of:
//   - ml_risk_score (component-level ML prediction)  — weight 0.40
//   - risk_proba    (probability of high risk label)  — weight 0.35
//   - final_score   (rec-level similarity + ML score) — weight 0.25
const compositeScore = (
    mlRisk: number,
    riskProba: number,
    finalScore: number,
): number => mlRisk * 0.4 + riskProba * 0.35 + finalScore * 0.25

// Flatten all recs across components, enrich each with its parent component's
// ml_risk_score + risk_proba, deduplicate by action (keep highest composite),
// then sort descending by composite score so the most dangerous actions come first.
const flattenAndSort = (data: RecommendationResponse): Recommendation[] => {
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

    // Deduplicate by action — keep the occurrence with the highest composite score
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

const fetchRecommendations = (vehicleId: string) =>
    ApiService.fetchDataWithAxios<RecommendationResponse>({
        url: `/recommendation/${vehicleId}/all`,
        method: 'get',
    })

// ── Recommendation row ─────────────────────────────────────────
const RecRow = ({
    rec,
    bucket,
    isFirst,
}: {
    rec: Recommendation
    bucket: Bucket
    isFirst: boolean
}) => {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center flex-shrink-0 w-4">
                <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${bucket.dotBg}`}
                />
                <div className={`w-0.5 flex-1 mt-1 ${bucket.lineBg}`} />
            </div>

            {/* Card */}
            <div
                className={`flex-1 rounded-xl border mb-3 overflow-hidden ${
                    isFirst
                        ? `${bucket.accentBorder} ${bucket.accentBg}`
                        : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
            >
                <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            {/* Component badge */}
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <span>{COMPONENT_ICONS[rec.component] ?? '🔩'}</span>
                                    {COMPONENT_LABELS[rec.component] ?? rec.component}
                                </span>
                                <span className="text-gray-300 dark:text-gray-600">·</span>
                                <span className={`text-xs font-semibold ${bucket.accentText}`}>
                                    {((rec._composite_score ?? rec.final_score) * 100).toFixed(0)}% risk
                                </span>
                            </div>

                            {/* Action */}
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">
                                {rec.action}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{rec.diagnosis}</p>
                        </div>

                        {/* Cost */}
                        <div className="flex-shrink-0 text-right">
                            <div className="flex items-center gap-0.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                               
                                {rec.estimated_cost}
                            </div>
                        </div>
                    </div>

                    {/* Expand toggle */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        {expanded ? <TbChevronUp size={13} /> : <TbChevronDown size={13} />}
                        {expanded ? 'Less details' : 'More details'}
                    </button>
                </div>

                {/* Expanded details */}
                {expanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2.5">
                                <div className="text-xs text-gray-500 mb-0.5">Problem</div>
                                <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                                    {rec.problem_description}
                                </div>
                            </div>
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2.5">
                                <div className="text-xs text-gray-500 mb-0.5">Status</div>
                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    {rec.repair_status} — {rec.results}
                                </div>
                            </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2.5">
                            <div className="text-xs text-gray-500 mb-1">AI reasoning</div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                {rec.reasoning}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Timeline bucket section ────────────────────────────────────
const TimelineBucket = ({
    bucket,
    recs,
}: {
    bucket: Bucket
    recs: Recommendation[]
}) => {
    if (recs.length === 0) return null

    // Estimate total cost range from recs that have a cost
    const totalCost = recs
        .map((r) => r.estimated_cost)
        .filter((c) => c && c !== '—')
        .join(', ')

    return (
        <div className="flex flex-col gap-0">
            {/* Bucket header */}
            <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-4 ${bucket.accentBg} ${bucket.accentBorder}`}
            >
                <span className={`${bucket.accentText}`}>{bucket.icon}</span>
                <div className="flex-1">
                    <div className={`font-semibold text-sm ${bucket.accentText}`}>
                        {bucket.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{bucket.sublabel}</div>
                </div>
                <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${bucket.accentBg} ${bucket.accentText} ${bucket.accentBorder}`}
                >
                    {recs.length} action{recs.length > 1 ? 's' : ''}
                </span>
            </div>

            {/* Recs */}
            <div className="pl-2">
                {recs.map((rec, i) => (
                    <RecRow
                        key={i}
                        rec={rec}
                        bucket={bucket}
                        isFirst={i === 0}
                    />
                ))}
            </div>
        </div>
    )
}

// ── Summary banner ─────────────────────────────────────────────
const StatCard = ({
    label,
    value,
    icon,
    bg,
}: {
    label: string
    value: number
    icon: React.ReactNode
    bg: string
}) => (
    <div className={`rounded-2xl p-4 flex items-start justify-between ${bg}`}>
        <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                {label}
            </p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">
                {value}
            </p>
        </div>
        <div className="w-11 h-11 rounded-full bg-gray-900 dark:bg-gray-950 flex items-center justify-center text-white flex-shrink-0">
            {icon}
        </div>
    </div>
)

const SummaryBanner = ({
    data,
    allRecs,
    onBack,
}: {
    data: RecommendationResponse
    allRecs: Recommendation[]
    onBack: () => void
}) => {
    const highUrgency = allRecs.filter((r) => r.urgency.includes('HIGH')).length
    const mediumUrgency = allRecs.filter((r) => r.urgency.includes('MEDIUM')).length

    return (
        <Card>
            <div className="flex items-center justify-between mb-5">
                <h4 className="flex items-center gap-2 !mb-0">
                    <TbBrain className="text-primary" size={22} />
                    Action plan — AI recommendations
                </h4>
                <Button icon={<TbArrowLeft />} onClick={onBack}>
                    Back
                </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    label="Components at risk"
                    value={data.highRiskComponents.length}
                    icon={<TbAlertTriangle size={20} />}
                    bg="bg-red-50 dark:bg-red-900/20"
                />
                <StatCard
                    label="Immediate actions"
                    value={highUrgency}
                    icon={<TbClock size={20} />}
                    bg="bg-orange-50 dark:bg-orange-900/20"
                />
                <StatCard
                    label="This week"
                    value={mediumUrgency}
                    icon={<TbCalendar size={20} />}
                    bg="bg-green-50 dark:bg-green-900/20"
                />
                <StatCard
                    label="Total recommendations"
                    value={allRecs.length}
                    icon={<TbTool size={20} />}
                    bg="bg-purple-50 dark:bg-purple-900/20"
                />
            </div>
        </Card>
    )
}

// ── Main ───────────────────────────────────────────────────────
const VehicleRecommendations = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const { data, isLoading, error } = useSWR(
        id ? [`/recommendation/${id}/all`] : null,
        () => fetchRecommendations(id!),
        { revalidateOnFocus: false },
    )

    const recommendations: RecommendationResponse | null = data
        ? Array.isArray(data)
            ? { vehicleId: id!, highRiskComponents: [], recommendations: data as ComponentResult[] }
            : (data as RecommendationResponse)
        : null

    const allRecs = recommendations ? flattenAndSort(recommendations) : []

    // Split into timeline buckets
    const bucketedRecs = TIMELINE_BUCKETS.map((bucket) => ({
        bucket,
        recs: allRecs.filter(bucket.filter),
    }))

    const hasAny = allRecs.length > 0

    return (
        <div className="flex flex-col gap-4">
            {/* Loading */}
            {isLoading && (
                <Card>
                    <div className="flex items-center justify-between mb-5">
                        <h4 className="flex items-center gap-2 !mb-0">
                            <TbBrain className="text-primary" size={22} />
                            Action plan — AI recommendations
                        </h4>
                        <Button icon={<TbArrowLeft />} onClick={() => navigate(-1)}>
                            Back
                        </Button>
                    </div>
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <Spinner size={40} />
                        <div className="text-center">
                            <p className="font-medium text-gray-700 dark:text-gray-300">
                                Analysis in progress…
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                Evaluating 7 components via the ML model
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Error */}
            {error && !isLoading && (
                <Card>
                    <div className="flex items-center justify-between mb-5">
                        <h4 className="flex items-center gap-2 !mb-0">
                            <TbBrain className="text-primary" size={22} />
                            Action plan — AI recommendations
                        </h4>
                        <Button icon={<TbArrowLeft />} onClick={() => navigate(-1)}>
                            Back
                        </Button>
                    </div>
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <TbAlertTriangle size={40} className="text-red-400" />
                        <p className="font-medium text-gray-700 dark:text-gray-300">
                            Analysis error
                        </p>
                        <p className="text-sm text-gray-500">
                            Make sure sensor, DTC and maintenance data have been uploaded.
                        </p>
                    </div>
                </Card>
            )}

            {/* Results */}
            {recommendations && !isLoading && (
                <>
                    <SummaryBanner data={recommendations} allRecs={allRecs} onBack={() => navigate(-1)} />

                    {/* High-risk component chips */}
                    {recommendations.highRiskComponents?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            
                        </div>
                    )}

                    {/* Timeline */}
                    {hasAny ? (
                        <Card>
                            <div className="flex flex-col gap-6">
                                {bucketedRecs.map(({ bucket, recs }) => (
                                    <TimelineBucket
                                        key={bucket.key}
                                        bucket={bucket}
                                        recs={recs}
                                    />
                                ))}
                            </div>
                        </Card>
                    ) : (
                        <Card>
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <TbShieldCheck size={40} className="text-emerald-400" />
                                <p className="font-medium text-gray-700 dark:text-gray-300">
                                    No high risk detected
                                </p>
                                <p className="text-sm text-gray-500">
                                    All components are in an acceptable state.
                                </p>
                            </div>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}

export default VehicleRecommendations