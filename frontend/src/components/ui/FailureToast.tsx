import { useEffect, useRef } from 'react'
import { TbAlertTriangle, TbX } from 'react-icons/tb'

type Props = {
    count: number
    components: string[]
    vehicleLabel?: string
    onClose: () => void
}

const DURATION = 10000

const COMPONENT_LABELS: Record<string, string> = {
    engine: 'Engine',
    electrical: 'Electrical',
    transmission: 'Transmission',
    battery: 'Battery',
    brakes: 'Brakes',
    fuel_system: 'Fuel System',
    cooling_system: 'Cooling System',
}

export default function FailureToast({ count, components, vehicleLabel, onClose }: Props) {
    const timerRef = useRef<number | null>(null)

    useEffect(() => {
        timerRef.current = window.setTimeout(onClose, DURATION)
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current)
        }
    }, [onClose])

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 380,
            backgroundColor: '#ffffff',
            border: '1px solid #fcd34d',
            borderLeft: '5px solid #f59e0b',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            animation: 'slideInToastF 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
            <style>{`
                @keyframes slideInToastF {
                    from { transform: translateX(60px); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                @keyframes drainBarF {
                    from { width: 100%; }
                    to   { width: 0%; }
                }
            `}</style>

            <div style={{ padding: '16px 16px 14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Icon */}
                <div style={{
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <TbAlertTriangle size={22} color="#f59e0b" />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 2 }}>
                        <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#f59e0b',
                            backgroundColor: '#fef3c7',
                            padding: '2px 8px',
                            borderRadius: 20,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            High Risk
                        </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginTop: 4 }}>
                        {count} high risk{count > 1 ? 's' : ''} detected
                    </div>
                    {vehicleLabel && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                            🚗 {vehicleLabel}
                        </div>
                    )}

                    {/* Component pills */}
                    {components.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                            {components.map((c) => (
                                <span key={c} style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    border: '1px solid #fcd34d',
                                    borderRadius: 6,
                                    padding: '3px 8px',
                                }}>
                                    {COMPONENT_LABELS[c] ?? c}
                                </span>
                            ))}
                        </div>
                    )}

                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                        Check your notifications for details.
                    </div>
                </div>

                {/* Close */}
                <button onClick={onClose} style={{
                    flexShrink: 0,
                    background: '#f3f4f6',
                    border: 'none',
                    cursor: 'pointer',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280',
                }} aria-label="Close">
                    <TbX size={14} />
                </button>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, backgroundColor: '#fde68a' }}>
                <div style={{
                    height: '100%',
                    backgroundColor: '#f59e0b',
                    animation: `drainBarF ${DURATION}ms linear forwards`,
                }} />
            </div>
        </div>
    )
}