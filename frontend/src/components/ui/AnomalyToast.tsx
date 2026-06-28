import { useEffect, useRef } from 'react'
import { TbActivityHeartbeat, TbX, TbBell } from 'react-icons/tb'

type Props = {
    count: number
    vehicleLabel?: string
    onClose: () => void
}

const DURATION = 10000

export default function AnomalyToast({ count, vehicleLabel, onClose }: Props) {
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
            border: '1px solid #fca5a5',
            borderLeft: '5px solid #ef4444',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            animation: 'slideInToast 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
            <style>{`
                @keyframes slideInToast {
                    from { transform: translateX(60px); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                @keyframes drainBar {
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
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <TbActivityHeartbeat size={22} color="#ef4444" />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#ef4444',
                            backgroundColor: '#fee2e2',
                            padding: '2px 8px',
                            borderRadius: 20,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            Anomaly Alert
                        </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginTop: 4 }}>
                        {count} {count > 1 ? 'anomalies' : 'anomaly'} detected
                    </div>
                    {vehicleLabel && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            🚗 {vehicleLabel}
                        </div>
                    )}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
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
            <div style={{ height: 4, backgroundColor: '#fecaca' }}>
                <div style={{
                    height: '100%',
                    backgroundColor: '#ef4444',
                    animation: `drainBar ${DURATION}ms linear forwards`,
                }} />
            </div>
        </div>
    )
}