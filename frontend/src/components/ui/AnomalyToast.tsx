import { useEffect, useRef } from 'react'
import { HiExclamationCircle, HiX } from 'react-icons/hi'

type Props = {
    count: number
    vehicleLabel?: string
    onClose: () => void
}

export default function AnomalyToast({ count, vehicleLabel, onClose }: Props) {
    const timerRef = useRef<number | null>(null)

    useEffect(() => {
        timerRef.current = window.setTimeout(onClose, 6000)
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current)
        }
    }, [onClose])

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: 'var(--color-background-primary)',
                border: '1px solid #fca5a5',
                borderLeft: '4px solid #ef4444',
                borderRadius: 10,
                padding: '14px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                maxWidth: 340,
                minWidth: 280,
                animation: 'slideInToast 0.25s ease',
            }}
        >
            <style>{`
                @keyframes slideInToast {
                    from { transform: translateY(16px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>

            <HiExclamationCircle
                style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }}
                size={20}
            />

            <div style={{ flex: 1 }}>
                <div style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: 'var(--color-text-primary)',
                }}>
                    {count} anomalies{count > 1 ? 'ies' : 'y'} detected
                </div>

                {vehicleLabel && (
                    <div style={{
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        marginTop: 3,
                    }}>
                        {vehicleLabel}
                    </div>
                )}

                <div style={{
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    marginTop: 3,
                }}>
                    Check your notifications for details.
                </div>

                <div style={{
                    marginTop: 8,
                    height: 3,
                    borderRadius: 2,
                    background: '#fecaca',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        background: '#ef4444',
                        borderRadius: 2,
                        animation: 'drainBar 6s linear forwards',
                    }} />
                    <style>{`
                        @keyframes drainBar {
                            from { width: 100%; }
                            to   { width: 0%; }
                        }
                    `}</style>
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