import { useEffect, useState, useCallback } from 'react'
import Card from '@/components/ui/Card'
import CalendarView from '@/components/shared/CalendarView'
import { apiGetMyMechanicProfile, apiGetMyMechanicBookings } from '@/services/DashboardService'
import dayjs from 'dayjs'
import type { DatesSetArg } from '@fullcalendar/core'

type MechanicProfile = {
    id: string
    name: string
    specialty?: string
    phone?: string
    location?: string
    isActive: boolean
}

type Booking = {
    id: string
    appointmentStart: string
    appointmentEnd: string
    serviceType?: string
    vehicle?: {
        make?: string
        model?: string
        plateNumber?: string
    }
}

// ─── Booking Detail Drawer ────────────────────────────────────────────────────

const BookingDrawer = ({
    booking,
    onClose,
}: {
    booking: Booking | null
    onClose: () => void
}) => {
    if (!booking) return null

    const start = dayjs(booking.appointmentStart)
    const end = dayjs(booking.appointmentEnd)
    const duration = end.diff(start, 'minute')
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60

    const vehicle = booking.vehicle
    const vehicleLabel = vehicle
        ? [vehicle.make, vehicle.model].filter(Boolean).join(' ')
        : null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(15,23,42,0.25)', backdropFilter: 'blur(2px)' }}
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div
                className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
                style={{
                    width: 380,
                    background: '#ffffff',
                    boxShadow: '-8px 0 40px rgba(15,23,42,0.10)',
                    borderLeft: '1px solid #F1F5F9',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-start justify-between"
                    style={{
                        padding: '28px 28px 20px',
                        borderBottom: '1px solid #F1F5F9',
                    }}
                >
                    <div>
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#EFF6FF',
                                color: '#1D4ED8',
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                padding: '4px 10px',
                                borderRadius: 6,
                                marginBottom: 10,
                            }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: '#3B82F6',
                                    display: 'inline-block',
                                }}
                            />
                            Appointment
                        </div>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: 17,
                                fontWeight: 700,
                                color: '#0F172A',
                                letterSpacing: '-0.02em',
                                lineHeight: 1.3,
                            }}
                        >
                            {booking.serviceType ?? 'Maintenance'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748B',
                            fontSize: 18,
                            lineHeight: 1,
                            flexShrink: 0,
                            marginTop: 2,
                        }}
                        aria-label="Fermer"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                    {/* Time block */}
                    <div
                        style={{
                            background: '#F8FAFC',
                            border: '1px solid #F1F5F9',
                            borderRadius: 12,
                            padding: '16px 20px',
                            marginBottom: 20,
                        }}
                    >
                        <p
                            style={{
                                margin: '0 0 12px',
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: '#94A3B8',
                            }}
                        >
                            Time
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Row
                                icon="📅"
                                label="Date"
                                value={start.format('dddd DD MMMM YYYY')}
                            />
                            <Row
                                icon="🕐"
                                label="Start"
                                value={start.format('HH:mm')}
                            />
                            <Row
                                icon="🕓"
                                label="End"
                                value={end.format('HH:mm')}
                            />
                            <Row
                                icon="⏱"
                                label="Duration"
                                value={
                                    hours > 0
                                        ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`
                                        : `${minutes} min`
                                }
                            />
                        </div>
                    </div>

                    {/* Vehicle block */}
                    {vehicle && (
                        <div
                            style={{
                                background: '#F8FAFC',
                                border: '1px solid #F1F5F9',
                                borderRadius: 12,
                                padding: '16px 20px',
                                marginBottom: 20,
                            }}
                        >
                            <p
                                style={{
                                    margin: '0 0 12px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    color: '#94A3B8',
                                }}
                            >
                                Vehicle
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {vehicleLabel && (
                                    <Row icon="" label="Model" value={vehicleLabel} />
                                )}
                                {vehicle.plateNumber && (
                                    <Row
                                        icon=""
                                        label="Plate number"
                                        value={
                                            <span
                                                style={{
                                                    fontFamily: 'monospace',
                                                    background: '#0F172A',
                                                    color: '#ffffff',
                                                    padding: '2px 8px',
                                                    borderRadius: 4,
                                                    fontSize: 13,
                                                    letterSpacing: '0.08em',
                                                }}
                                            >
                                                {vehicle.plateNumber}
                                            </span>
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Booking ID */}
                   
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 28px',
                        borderTop: '1px solid #F1F5F9',
                        display: 'flex',
                        gap: 10,
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            borderRadius: 10,
                            border: '1px solid #E2E8F0',
                            background: 'transparent',
                            color: '#475569',
                            fontWeight: 500,
                            fontSize: 14,
                            cursor: 'pointer',
                        }}
                    >
                                        Close
                    </button>
                </div>
            </div>
        </>
    )
}

// Shared row component
const Row = ({
    icon,
    label,
    value,
}: {
    icon: string
    label: string
    value: React.ReactNode
}) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>{label}</span>
        </div>
        <span
            style={{
                fontSize: 13,
                color: '#0F172A',
                fontWeight: 600,
                textAlign: 'right',
                maxWidth: 200,
            }}
        >
            {value}
        </span>
    </div>
)

// ─── Main Page ────────────────────────────────────────────────────────────────

const MechanicSpace = () => {
    const [profile, setProfile] = useState<MechanicProfile | null>(null)
    const [bookingEvents, setBookingEvents] = useState<any[]>([])
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [loadingCalendar, setLoadingCalendar] = useState(false)
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await apiGetMyMechanicProfile<MechanicProfile>()
                setProfile(data)
            } catch (err) {
                console.error('Erreur profil mécanicien:', err)
            } finally {
                setLoadingProfile(false)
            }
        }
        fetchProfile()
    }, [])

    const loadBookings = useCallback(async (startDate: string, endDate: string) => {
        setLoadingCalendar(true)
        try {
            const start = dayjs(startDate)
            const end = dayjs(endDate)

            const days: string[] = []
            let current = start
            while (current.isBefore(end, 'day')) {
                days.push(current.format('YYYY-MM-DD'))
                current = current.add(1, 'day')
            }

            const results = await Promise.all(
                days.map((date) =>
                    apiGetMyMechanicBookings<Booking[] | { data: Booking[] }>(date)
                )
            )

            const allBookings = results.flatMap((res) =>
                Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : []
            )

            setBookingEvents(
                allBookings.map((booking) => ({
                    id: booking.id,
                    title: booking.vehicle
                        ? `${booking.vehicle.make ?? ''} ${booking.vehicle.model ?? ''} — ${booking.serviceType ?? 'Maintenance'}`
                        : booking.serviceType ?? 'Rendez-vous',
                    start: booking.appointmentStart,
                    end: booking.appointmentEnd,
                    eventColor: 'blue',
                    extendedProps: { booking },
                }))
            )
        } catch (err) {
            console.error('Erreur bookings:', err)
            setBookingEvents([])
        } finally {
            setLoadingCalendar(false)
        }
    }, [])

    const handleDatesSet = (arg: DatesSetArg) => {
        const start = dayjs(arg.start).format('YYYY-MM-DD')
        const end = dayjs(arg.end).format('YYYY-MM-DD')
        loadBookings(start, end)
    }

    if (loadingProfile) {
        return (
            <div className="py-16 text-center" style={{ color: '#94A3B8', fontSize: 14 }}>
                Chargement de votre espace...
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="py-16 text-center" style={{ color: '#EF4444', fontSize: 14 }}>
                Profil mécanicien introuvable.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <Card>
                {/* Card header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 20,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h5 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
                            My appointments

                        </h5>
                        {loadingCalendar && (
                            <span
                                style={{
                                    fontSize: 12,
                                    color: '#94A3B8',
                                    background: '#F8FAFC',
                                    border: '1px solid #F1F5F9',
                                    borderRadius: 6,
                                    padding: '2px 10px',
                                    fontWeight: 500,
                                }}
                            >
                                Chargement…
                            </span>
                        )}
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            color: '#64748B',
                            fontWeight: 500,
                        }}
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#22C55E',
                                display: 'inline-block',
                            }}
                        />
                        {bookingEvents.length}  appointments this week 
 
                    </div>
                </div>

                <CalendarView
                    events={bookingEvents}
                    datesSet={handleDatesSet}
                    initialView="timeGridWeek"
                    slotMinTime="08:00:00"
                    slotMaxTime="17:00:00"
                    allDaySlot={false}
                    slotDuration="01:00:00"
                    calendarHeight={480}
                    businessHours={{
                        daysOfWeek: [1, 2, 3, 4, 5, 6],
                        startTime: '08:00',
                        endTime: '17:00',
                    }}
                    eventClick={(info) => {
                        const booking = info.event.extendedProps.booking as Booking
                        setSelectedBooking(booking)
                    }}
                />
            </Card>

            {/* Booking detail drawer */}
            <BookingDrawer
                booking={selectedBooking}
                onClose={() => setSelectedBooking(null)}
            />
        </div>
    )
}

export default MechanicSpace