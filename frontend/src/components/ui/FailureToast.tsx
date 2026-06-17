import { useEffect, useRef } from 'react'
import { HiX } from 'react-icons/hi'
import { TbAlertTriangle } from 'react-icons/tb'

type Props = {
    count: number
    components: string[]
    vehicleLabel?: string
    onClose: () => void
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

export default function FailureToast({
    count,
    components,
    vehicleLabel,
    onClose,
}: Props) {
    const timerRef = useRef<number | null>(null)

    useEffect(() => {
        timerRef.current = window.setTimeout(onClose, 8000)
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current)
        }
    }, [onClose])

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 84,
                right: 24,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: 'var(--color-background-primary)',
                border: '1px solid #fcd34d',
                borderLeft: '4px solid #f59e0b',
                borderRadius: 10,
                padding: '14px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                maxWidth: 360,
                minWidth: 300,
                animation: 'slideInToastF 0.25s ease',
            }}
        >
            <style>{`
                @keyframes slideInToastF {
                    from { transform: translateY(16px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                @keyframes drainBarF {
                    from { width: 100%; }
                    to   { width: 0%; }
                }
            `}</style>

            <TbAlertTriangle
                style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }}
                size={20}
            />

            <div style={{ flex: 1 }}>
                <div
                    style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: 'var(--color-text-primary)',
                    }}
                >
                    {count} high risk{count > 1 ? 's' : ''} detected
                </div>

                {vehicleLabel && (
                    <div
                        style={{
                            fontSize: 12,
                            color: 'var(--color-text-secondary)',
                            marginTop: 3,
                        }}
                    >
                        {vehicleLabel}
                    </div>
                )}

                <div
                    style={{
                        marginTop: 6,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 4,
                    }}
                >
                    {components.map((c) => (
                        <span
                            key={c}
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: '#fef3c7',
                                color: '#92400e',
                                borderRadius: 4,
                                padding: '2px 7px',
                            }}
                        >
                            {COMPONENT_LABELS[c] ?? c}
                        </span>
                    ))}
                </div>

                <div
                    style={{
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        marginTop: 6,
                    }}
                >
                    Check your notifications for details.
                </div>

                <div
                    style={{
                        marginTop: 8,
                        height: 3,
                        borderRadius: 2,
                        background: '#fde68a',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            background: '#f59e0b',
                            borderRadius: 2,
                            animation: 'drainBarF 8s linear forwards',
                        }}
                    />
                </div>
            </div>

            <button
                onClick={onClose}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    color: 'var(--color-text-tertiary)',
                    flexShrink: 0,
                    lineHeight: 1,
                }}
                aria-label="Close"
            >
                <HiX size={16} />
            </button>
        </div>
    )
}