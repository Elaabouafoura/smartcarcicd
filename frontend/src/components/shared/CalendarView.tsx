import classNames from '@/utils/classNames'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { CalendarOptions } from '@fullcalendar/core'

type EventColors = Record<
    string,
    {
        bg: string
        text: string
        dot: string
        border: string
    }
>

interface CalendarViewProps extends CalendarOptions {
    wrapperClass?: string
    calendarHeight?: number
    eventColors?: (colors: EventColors) => EventColors
}

const defaultColorList: EventColors = {
    red: {
        bg: 'bg-[#FEF0F0]',
        text: 'text-[#B91C1C]',
        dot: '#EF4444',
        border: 'border-l-[3px] border-[#EF4444]',
    },
    orange: {
        bg: 'bg-[#FFF4ED]',
        text: 'text-[#9A3412]',
        dot: '#F97316',
        border: 'border-l-[3px] border-[#F97316]',
    },
    yellow: {
        bg: 'bg-[#FEFCE8]',
        text: 'text-[#854D0E]',
        dot: '#EAB308',
        border: 'border-l-[3px] border-[#EAB308]',
    },
    green: {
        bg: 'bg-[#F0FDF4]',
        text: 'text-[#166534]',
        dot: '#22C55E',
        border: 'border-l-[3px] border-[#22C55E]',
    },
    blue: {
        bg: 'bg-[#EFF6FF]',
        text: 'text-[#1D4ED8]',
        dot: '#3B82F6',
        border: 'border-l-[3px] border-[#3B82F6]',
    },
    purple: {
        bg: 'bg-[#F5F3FF]',
        text: 'text-[#6D28D9]',
        dot: '#8B5CF6',
        border: 'border-l-[3px] border-[#8B5CF6]',
    },
}

const CalendarView = (props: CalendarViewProps) => {
    const {
        wrapperClass,
        calendarHeight = 480,
        eventColors = () => defaultColorList,
        ...rest
    } = props

    const colors = eventColors(defaultColorList) || defaultColorList

    return (
        <div className={classNames('calendar-wrapper', wrapperClass)}>
            <style>{`
                .calendar-wrapper {
                    --fc-border-color: #F1F5F9;
                    --fc-today-bg-color: #F8FAFF;
                    --fc-page-bg-color: #ffffff;
                    --fc-neutral-bg-color: #F8FAFC;
                    --fc-event-bg-color: transparent;
                    --fc-event-border-color: transparent;
                    --fc-event-text-color: inherit;
                    --fc-now-indicator-color: #6366F1;
                    font-family: 'Inter', -apple-system, sans-serif;
                }

                /* Header toolbar */
                .calendar-wrapper .fc-toolbar {
                    padding: 1.25rem 1.5rem 1rem;
                    background: #ffffff;
                    border-bottom: 1px solid #F1F5F9;
                    border-radius: 16px 16px 0 0;
                    margin-bottom: 0 !important;
                    align-items: center;
                }

                .calendar-wrapper .fc-toolbar-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #0F172A;
                    letter-spacing: -0.02em;
                }

                /* Navigation buttons */
                .calendar-wrapper .fc-button {
                    background: transparent !important;
                    border: 1px solid #E2E8F0 !important;
                    border-radius: 8px !important;
                    color: #475569 !important;
                    font-size: 0.8rem !important;
                    font-weight: 500 !important;
                    padding: 6px 14px !important;
                    transition: all 0.15s ease !important;
                    box-shadow: none !important;
                    text-transform: capitalize !important;
                }

                .calendar-wrapper .fc-button:hover {
                    background: #F8FAFC !important;
                    border-color: #CBD5E1 !important;
                    color: #0F172A !important;
                }

                .calendar-wrapper .fc-button-active,
                .calendar-wrapper .fc-button-primary:not(:disabled).fc-button-active {
                    background: #0F172A !important;
                    border-color: #0F172A !important;
                    color: #ffffff !important;
                }

                .calendar-wrapper .fc-button-group {
                    gap: 4px;
                    display: flex;
                }

                .calendar-wrapper .fc-button-group .fc-button {
                    border-radius: 8px !important;
                }

                /* Column headers */
                .calendar-wrapper .fc-col-header-cell {
                    background: #FAFAFA;
                    border-color: #F1F5F9 !important;
                    padding: 10px 0 !important;
                }

                .calendar-wrapper .fc-col-header-cell-cushion {
                    font-size: 0.72rem;
                    font-weight: 600;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: #94A3B8;
                    text-decoration: none !important;
                }

                .calendar-wrapper .fc-day-today .fc-col-header-cell-cushion {
                    color: #6366F1;
                }

                /* Time slots */
                .calendar-wrapper .fc-timegrid-slot {
                    border-color: #F1F5F9 !important;
                }

                .calendar-wrapper .fc-timegrid-slot-minor {
                    border-color: #F8FAFC !important;
                }

                .calendar-wrapper .fc-timegrid-axis {
                    border-color: #F1F5F9 !important;
                }

                .calendar-wrapper .fc-timegrid-slot-label {
                    font-size: 0.7rem;
                    color: #CBD5E1;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                }

                .calendar-wrapper .fc-day-today {
                    background: var(--fc-today-bg-color) !important;
                }

                /* Now indicator */
                .calendar-wrapper .fc-timegrid-now-indicator-line {
                    border-color: #6366F1;
                    border-width: 1.5px;
                }

                .calendar-wrapper .fc-timegrid-now-indicator-arrow {
                    border-top-color: #6366F1;
                    border-bottom-color: #6366F1;
                }

                /* Events */
                .calendar-wrapper .fc-timegrid-event {
                    border-radius: 8px !important;
                    border: none !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;
                }

                .calendar-wrapper .fc-event-main {
                    padding: 0 !important;
                }

                .calendar-wrapper .reserved-event {
                    opacity: 0.85 !important;
                }

                /* Scrollbar */
                .calendar-wrapper .fc-scroller::-webkit-scrollbar {
                    width: 4px;
                }

                .calendar-wrapper .fc-scroller::-webkit-scrollbar-track {
                    background: transparent;
                }

                .calendar-wrapper .fc-scroller::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 99px;
                }

                /* Outer container */
                .calendar-wrapper .fc {
                    border: 1px solid #F1F5F9;
                    border-radius: 16px;
                    overflow: hidden;
                    background: #ffffff;
                }

                .calendar-wrapper .fc-view-harness {
                    background: #ffffff;
                }
            `}</style>

            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                    left: 'title',
                    center: '',
                    right: 'timeGridWeek,timeGridDay prev,next',
                }}
                slotMinTime="07:00:00"
                slotMaxTime="20:00:00"
                expandRows={true}
                height={calendarHeight}
                stickyHeaderDates={true}
                nowIndicator={true}
                eventClassNames={(arg) => {
                    const eventColor = arg.event.extendedProps.eventColor as string
                    if (eventColor === 'red') return ['reserved-event']
                    return []
                }}
                eventContent={(arg) => {
                    const { extendedProps } = arg.event
                    const { isEnd, isStart } = arg
                    const eventColor = extendedProps.eventColor as string
                    const color = eventColor ? colors[eventColor] : undefined
                    const isReserved = eventColor === 'red'

                    const baseStyle: React.CSSProperties = {
                        width: '100%',
                        height: '100%',
                        padding: '6px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        borderRadius: '8px',
                        borderLeft: color?.dot ? `3px solid ${color.dot}` : undefined,
                        backgroundColor: isReserved ? '#FEF2F2' : !color?.bg ? '#F8FAFC' : undefined,
                        cursor: isReserved ? 'not-allowed' : 'pointer',
                    }

                    return (
                        <div
                            className={classNames(
                                'custom-calendar-event',
                                color?.bg,
                                color?.text,
                            )}
                            style={baseStyle}
                        >
                            {!(isEnd && !isStart) && (
                                <span
                                    style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 500,
                                        opacity: 0.7,
                                        letterSpacing: '0.01em',
                                        lineHeight: 1,
                                    }}
                                >
                                    {arg.timeText}
                                </span>
                            )}
                            <span
                                style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    lineHeight: 1.3,
                                    letterSpacing: '-0.01em',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {arg.event.title}
                            </span>
                        </div>
                    )
                }}
                {...rest}
            />
        </div>
    )
}

export default CalendarView