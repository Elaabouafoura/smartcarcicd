import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import Input from '@/components/ui/Input'
import Switcher from '@/components/ui/Switcher'
import Tag from '@/components/ui/Tag'
import Avatar from '@/components/ui/Avatar'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import DebouceInput from '@/components/shared/DebouceInput'
import CalendarView from '@/components/shared/CalendarView'
import classNames from '@/utils/classNames'
import { Form, FormItem } from '@/components/ui/Form'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import dayjs from 'dayjs'
import {
    TbTool,
    TbMapPin,
    TbPhone,
    TbSearch,
    TbEdit,
    TbTrash,
} from 'react-icons/tb'
import {
    apiGetMechanics,
    apiGetAdminMechanics,
    apiCreateMechanic,
    apiUpdateMechanic,
    apiDeleteMechanic,
    apiGetMechanicAllBookings,
    apiGetMyVehicles,
    apiGetVehicleMaintenances,
    apiUpdateMaintenanceAppointment,
} from '@/services/DashboardService'
import type { DateSelectArg, DatesSetArg } from '@fullcalendar/core'

type Mechanic = {
    id: string
    name: string
    specialty?: string
    phone?: string
    location?: string
    isActive: boolean
    createdAt?: string
}

type MechanicForm = {
    name: string
    specialty?: string
    phone?: string
    location?: string
    isActive?: boolean
}

type Vehicle = {
    id: string
    make?: string
    model?: string
    plateNumber?: string
}

type Maintenance = {
    id: string
    service_type?: string
    next_due_date?: string
}

type Booking = {
    id: string
    appointmentStart: string
    appointmentEnd: string
}

type Option = {
    value: string
    label: string
}

const mechanicSchema = z.object({
    name: z.string().min(1, 'Nom obligatoire'),
    specialty: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    isActive: z.boolean().optional(),
})

const { Tr, Td, TBody, THead, Th } = Table

const isUuid = (value?: string) =>
    Boolean(
        value &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                value,
            ),
    )

const getIsAdmin = () => {
    try {
        const token =
            localStorage.getItem('token') ||
            localStorage.getItem('accessToken') ||
            localStorage.getItem('access_token')

        if (!token) return false

        const payload = JSON.parse(atob(token.split('.')[1]))
        const role = payload?.role || payload?.user?.role || payload?.userRole

        return role?.toLowerCase() === 'admin'
    } catch {
        return false
    }
}

const MechanicsDashboard = () => {
    const isAdmin = useMemo(() => getIsAdmin(), [])

    const [mechanics, setMechanics] = useState<Mechanic[]>([])
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [maintenances, setMaintenances] = useState<Maintenance[]>([])

    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [calendarLoading, setCalendarLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const [calendarOpen, setCalendarOpen] = useState(false)
    const [appointmentOpen, setAppointmentOpen] = useState(false)
    const [manageDialogOpen, setManageDialogOpen] = useState(false)
    const [editingMechanic, setEditingMechanic] = useState<Mechanic | null>(
        null,
    )

    const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(
        null,
    )

    const [selectedSlot, setSelectedSlot] = useState<{
        start: string
        end: string
    } | null>(null)

    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedHour, setSelectedHour] = useState('')

    const [selectedVehicleId, setSelectedVehicleId] = useState('')
    const [selectedMaintenanceId, setSelectedMaintenanceId] = useState('')

    const [bookingEvents, setBookingEvents] = useState<any[]>([])
    const [visibleStartDate, setVisibleStartDate] = useState('')
    const [visibleEndDate, setVisibleEndDate] = useState('')

    const {
        handleSubmit,
        reset,
        control,
        formState: { errors, isSubmitting },
    } = useForm<MechanicForm>({
        resolver: zodResolver(mechanicSchema),
        defaultValues: {
            name: '',
            specialty: '',
            phone: '',
            location: '',
            isActive: true,
        },
    })

    const loadMechanics = async () => {
        setLoading(true)

        try {
            const data = isAdmin
                ? await apiGetAdminMechanics<Mechanic[]>()
                : await apiGetMechanics<Mechanic[]>()

            setMechanics(Array.isArray(data) ? data : [])
        } catch (error: any) {
            console.error(
                'Erreur chargement mécaniciens:',
                error?.response?.data || error,
            )
            setMechanics([])
        } finally {
            setLoading(false)
        }
    }

    const loadVehicles = async () => {
        try {
            const response = await apiGetMyVehicles<
                Vehicle[] | { data: Vehicle[] }
            >({
                page: 1,
                limit: 100,
            })

            const list = Array.isArray(response)
                ? response
                : Array.isArray(response?.data)
                  ? response.data
                  : []

            setVehicles(list)
        } catch (error: any) {
            console.error(
                'Erreur chargement véhicules:',
                error?.response?.data || error,
            )
            setVehicles([])
        }
    }

    useEffect(() => {
        loadMechanics()
        loadVehicles()
    }, [])

    const openAddMechanic = () => {
        setEditingMechanic(null)
        reset({
            name: '',
            specialty: '',
            phone: '',
            location: '',
            isActive: true,
        })
        setManageDialogOpen(true)
    }

    const openEditMechanic = (mechanic: Mechanic) => {
        setEditingMechanic(mechanic)
        reset({
            name: mechanic.name,
            specialty: mechanic.specialty || '',
            phone: mechanic.phone || '',
            location: mechanic.location || '',
            isActive: mechanic.isActive,
        })
        setManageDialogOpen(true)
    }

    const closeManageDialog = () => {
        setManageDialogOpen(false)
        setEditingMechanic(null)
    }

    const submitMechanic = async (data: MechanicForm) => {
        if (!isAdmin) return

        if (editingMechanic) {
            await apiUpdateMechanic(editingMechanic.id, data)
        } else {
            await apiCreateMechanic(data)
        }

        await loadMechanics()
        closeManageDialog()
    }

    const removeMechanic = async (mechanicId: string) => {
        if (!isAdmin) return

        const confirmed = window.confirm(
            'Voulez-vous vraiment supprimer ce mécanicien ?',
        )

        if (!confirmed) return

        await apiDeleteMechanic(mechanicId)
        await loadMechanics()
    }

    const toggleMechanicStatus = async (
        isActive: boolean,
        mechanic: Mechanic,
    ) => {
        if (!isAdmin) return

        await apiUpdateMechanic(mechanic.id, {
            isActive,
        })

        await loadMechanics()
    }

    const normalizeBookingList = (
        response: Booking[] | { data: Booking[] },
    ): Booking[] => {
        if (Array.isArray(response)) return response
        if (Array.isArray(response?.data)) return response.data
        return []
    }

    const loadMechanicBookings = async (
        mechanicId: string,
        startDate: string,
        endDate?: string,
    ) => {
        if (!isUuid(mechanicId)) return

        setCalendarLoading(true)

        try {
            const start = dayjs(startDate)
            const end = endDate ? dayjs(endDate) : start.add(1, 'day')

            const days: string[] = []
            let current = start

            while (current.isBefore(end, 'day')) {
                days.push(current.format('YYYY-MM-DD'))
                current = current.add(1, 'day')
            }

            if (days.length === 0) {
                days.push(start.format('YYYY-MM-DD'))
            }

            const results = await Promise.all(
                days.map((date) =>
                    apiGetMechanicAllBookings<
                        Booking[] | { data: Booking[] }
                    >(mechanicId, date),
                ),
            )

            const bookingList = results.flatMap((result) =>
                normalizeBookingList(result),
            )

            setBookingEvents(
                bookingList.map((booking) => ({
                    id: booking.id,
                    title: 'Booked',
                    start: booking.appointmentStart,
                    end: booking.appointmentEnd,
                    eventColor: 'red',
                    backgroundColor: '#ef4444',
                    borderColor: '#ef4444',
                    textColor: '#ffffff',
                    editable: false,
                    startEditable: false,
                    durationEditable: false,
                    overlap: false,
                    display: 'block',
                })),
            )
        } catch (error: any) {
            console.error(
                'Erreur chargement réservations:',
                error?.response?.data || error,
            )
            setBookingEvents([])
        } finally {
            setCalendarLoading(false)
        }
    }

    const openCalendar = (mechanic: Mechanic) => {
        setSelectedMechanic(mechanic)
        setCalendarOpen(true)
        setBookingEvents([])
    }

    const closeCalendar = () => {
        setCalendarOpen(false)
        setAppointmentOpen(false)
        setSelectedMechanic(null)
        setSelectedSlot(null)
        setSelectedDate(null)
        setSelectedHour('')
        setSelectedVehicleId('')
        setSelectedMaintenanceId('')
        setMaintenances([])
        setBookingEvents([])
    }

    const handleDatesSet = async (arg: DatesSetArg) => {
        if (!selectedMechanic) return

        const start = dayjs(arg.start).format('YYYY-MM-DD')
        const end = dayjs(arg.end).format('YYYY-MM-DD')

        setVisibleStartDate(start)
        setVisibleEndDate(end)

        await loadMechanicBookings(selectedMechanic.id, start, end)
    }

    const isSlotOverlapping = (start: string, end: string) => {
        const slotStart = dayjs(start)
        const slotEnd = dayjs(end)

        return bookingEvents.some((event) => {
            const eventStart = dayjs(event.start)
            const eventEnd = dayjs(event.end)

            return slotStart.isBefore(eventEnd) && slotEnd.isAfter(eventStart)
        })
    }

    const buildSlot = (date: Date, hourValue: string) => {
        const [hour, minute] = hourValue.split(':').map(Number)

        const start = dayjs(date)
            .hour(hour)
            .minute(minute || 0)
            .second(0)
            .millisecond(0)

        const end = start.add(1, 'hour')

        return {
            start: start.format(),
            end: end.format(),
        }
    }

    const getHourOptions = (date: Date | null): Option[] => {
        if (!date) return []

        const options: Option[] = []

        for (let hour = 8; hour < 17; hour++) {
            const start = dayjs(date)
                .hour(hour)
                .minute(0)
                .second(0)
                .millisecond(0)

            const end = start.add(1, 'hour')
            const isReserved = isSlotOverlapping(start.format(), end.format())

            if (!isReserved) {
                options.push({
                    value: start.format('HH:mm'),
                    label: `${start.format('HH:mm')} - ${end.format('HH:mm')}`,
                })
            }
        }

        return options
    }

    const handleSelectSlot = (event: DateSelectArg) => {
        const start = dayjs(event.start)
        const end = start.add(1, 'hour')

        if (isSlotOverlapping(start.format(), end.format())) {
            alert('Ce créneau est déjà réservé.')
            return
        }

        const slot = {
            start: start.format(),
            end: end.format(),
        }

        setSelectedSlot(slot)
        setSelectedDate(start.toDate())
        setSelectedHour(start.format('HH:mm'))
        setSelectedVehicleId('')
        setSelectedMaintenanceId('')
        setMaintenances([])
        setAppointmentOpen(true)
    }

    const handleDateChange = async (date: Date | null) => {
        setSelectedDate(date)
        setSelectedHour('')
        setSelectedSlot(null)

        if (!date || !selectedMechanic) return

        const selectedDay = dayjs(date).format('YYYY-MM-DD')

        await loadMechanicBookings(
            selectedMechanic.id,
            selectedDay,
            dayjs(selectedDay).add(1, 'day').format('YYYY-MM-DD'),
        )
    }

    const handleHourChange = (option: Option | null) => {
        const hour = option?.value || ''

        setSelectedHour(hour)

        if (!selectedDate || !hour) {
            setSelectedSlot(null)
            return
        }

        const slot = buildSlot(selectedDate, hour)

        if (isSlotOverlapping(slot.start, slot.end)) {
            alert('Ce créneau est déjà réservé.')
            setSelectedHour('')
            setSelectedSlot(null)
            return
        }

        setSelectedSlot(slot)
    }

    const handleVehicleChange = async (option: Option | null) => {
        const vehicleId = option?.value || ''

        setSelectedVehicleId(vehicleId)
        setSelectedMaintenanceId('')
        setMaintenances([])

        if (!vehicleId) return

        try {
            const response = await apiGetVehicleMaintenances<
                Maintenance[] | { data: Maintenance[] }
            >(vehicleId)

            const list = Array.isArray(response)
                ? response
                : Array.isArray(response?.data)
                  ? response.data
                  : []

            setMaintenances(list)
        } catch (error: any) {
            console.error(
                'Erreur chargement maintenances:',
                error?.response?.data || error,
            )
            setMaintenances([])
        }
    }

    const confirmAppointment = async () => {
        if (!selectedMechanic || !selectedSlot) return

        if (isSlotOverlapping(selectedSlot.start, selectedSlot.end)) {
            alert('Ce créneau est déjà réservé.')
            return
        }

        if (
            !isUuid(selectedMechanic.id) ||
            !isUuid(selectedVehicleId) ||
            !isUuid(selectedMaintenanceId)
        ) {
            alert('Veuillez choisir un véhicule et une maintenance.')
            return
        }

        setSaving(true)

        try {
            await apiUpdateMaintenanceAppointment(
                selectedVehicleId,
                selectedMaintenanceId,
                {
                    mechanicId: selectedMechanic.id,
                    appointmentStart: selectedSlot.start,
                    appointmentEnd: selectedSlot.end,
                },
            )

            setAppointmentOpen(false)
            setSelectedSlot(null)
            setSelectedDate(null)
            setSelectedHour('')
            setSelectedVehicleId('')
            setSelectedMaintenanceId('')
            setMaintenances([])

            if (visibleStartDate && visibleEndDate) {
                await loadMechanicBookings(
                    selectedMechanic.id,
                    visibleStartDate,
                    visibleEndDate,
                )
            }
        } catch (error: any) {
            alert(
                error?.response?.data?.message ||
                    'Erreur lors de la confirmation du rendez-vous',
            )
        } finally {
            setSaving(false)
        }
    }

    const filteredMechanics = useMemo(() => {
        const search = query.trim().toLowerCase()

        if (!search) return mechanics

        return mechanics.filter((mechanic) => {
            return (
                mechanic.name.toLowerCase().includes(search) ||
                mechanic.specialty?.toLowerCase().includes(search) ||
                mechanic.phone?.toLowerCase().includes(search) ||
                mechanic.location?.toLowerCase().includes(search)
            )
        })
    }, [mechanics, query])

    const vehicleOptions: Option[] = vehicles.map((vehicle) => ({
        value: vehicle.id,
        label:
            [vehicle.make, vehicle.model, vehicle.plateNumber]
                .filter(Boolean)
                .join(' - ') || `Véhicule ${vehicle.id}`,
    }))

    const maintenanceOptions: Option[] = maintenances.map((maintenance) => ({
        value: maintenance.id,
        label: maintenance.service_type || 'Maintenance',
    }))

    const hourOptions = getHourOptions(selectedDate)

    return (
        <Card>
            <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h4 className="mb-1">Mechanics</h4>
                        <p className="text-sm text-gray-500">
                            {isAdmin
                                ? 'Manage the mechanics and check their schedules.'
                                : 'Click on the icon to view the calendar.'}
                        </p>
                    </div>

                  
                </div>

                <DebouceInput
                    placeholder="Search"
                    suffix={<TbSearch className="text-lg" />}
                    onChange={(event) => {
                        const value = event.target.value

                        if (value.length > 1 || value.length === 0) {
                            setQuery(value)
                        }
                    }}
                />
            </div>

            {loading ? (
                <div className="py-8 text-center text-gray-500">
                    Loading...
                </div>
            ) : (
                <Table hoverable={false}>
                    <THead>
                        <Tr>
                            <Th>Mechanic</Th>
                            <Th>Specialty</Th>
                            <Th>Phone</Th>
                            <Th>Location</Th>
                            <Th>Status</Th>
                            {isAdmin && <Th>Actions</Th>}
                        </Tr>
                    </THead>

                    <TBody>
                        {filteredMechanics.map((mechanic) => (
                            <Tr key={mechanic.id}>
                                <Td>
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            className="bg-transparent dark:bg-transparent p-2 border-2 border-gray-200 dark:border-gray-600 cursor-pointer hover:border-red-400"
                                            size={50}
                                            shape="round"
                                            icon={
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openCalendar(mechanic)
                                                    }
                                                    className="text-2xl heading-text"
                                                >
                                                    <TbTool />
                                                </button>
                                            }
                                        />

                                        <div>
                                            <div className="heading-text font-bold">
                                                {mechanic.name}
                                            </div>

                                            {mechanic.createdAt && (
                                                <div className="text-xs text-gray-500">
                                                    {dayjs(
                                                        mechanic.createdAt,
                                                    ).format('DD MMM YYYY')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Td>

                                <Td>
                                    {mechanic.specialty || (
                                        <span className="text-gray-400">
                                            N/A
                                        </span>
                                    )}
                                </Td>

                                <Td>
                                    <div className="flex items-center gap-2">
                                        <TbPhone />
                                        {mechanic.phone || (
                                            <span className="text-gray-400">
                                                N/A
                                            </span>
                                        )}
                                    </div>
                                </Td>

                                <Td>
                                    <div className="flex items-center gap-2">
                                        <TbMapPin />
                                        {mechanic.location || (
                                            <span className="text-gray-400">
                                                N/A
                                            </span>
                                        )}
                                    </div>
                                </Td>

                                <Td>
                                    {isAdmin ? (
                                        <Switcher
                                            checked={mechanic.isActive}
                                            onChange={(value) =>
                                                toggleMechanicStatus(
                                                    value,
                                                    mechanic,
                                                )
                                            }
                                        />
                                    ) : (
                                        <Tag
                                            className={classNames(
                                                mechanic.isActive
                                                    ? 'bg-emerald-200'
                                                    : 'bg-gray-200',
                                            )}
                                        >
                                            {mechanic.isActive
                                                ? 'Disponible'
                                                : 'Désactivé'}
                                        </Tag>
                                    )}
                                </Td>

                                {isAdmin && (
                                    <Td>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="xs"
                                                icon={<TbEdit />}
                                                onClick={() =>
                                                    openEditMechanic(mechanic)
                                                }
                                            />

                                            <Button
                                                size="xs"
                                                icon={<TbTrash />}
                                                onClick={() =>
                                                    removeMechanic(mechanic.id)
                                                }
                                            />
                                        </div>
                                    </Td>
                                )}
                            </Tr>
                        ))}

                        {filteredMechanics.length === 0 && (
                            <Tr>
                                <Td colSpan={isAdmin ? 6 : 5}>
                                    <div className="py-8 text-center text-gray-500">
                                        Aucun mécanicien trouvé.
                                    </div>
                                </Td>
                            </Tr>
                        )}
                    </TBody>
                </Table>
            )}

            {isAdmin && (
                <Dialog
                    isOpen={manageDialogOpen}
                    width={600}
                    onClose={closeManageDialog}
                    onRequestClose={closeManageDialog}
                >
                    <h4>
                        {editingMechanic
                            ? 'Update mechanic'
                            : 'Ajouter mécanicien'}
                    </h4>

                    <Form
                        className="mt-6"
                        onSubmit={handleSubmit(submitMechanic)}
                    >
                        <FormItem
                            label="Name"
                            invalid={Boolean(errors.name)}
                            errorMessage={errors.name?.message}
                        >
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Nom mécanicien"
                                        {...field}
                                    />
                                )}
                            />
                        </FormItem>

                        <FormItem label="Speciality">
                            <Controller
                                name="specialty"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Ex: Moteur"
                                        {...field}
                                    />
                                )}
                            />
                        </FormItem>

                        <FormItem label="Phone">
                            <Controller
                                name="phone"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Ex: 22111222"
                                        {...field}
                                    />
                                )}
                            />
                        </FormItem>

                        <FormItem label="Localisation">
                            <Controller
                                name="location"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Ex: Tunis centre"
                                        {...field}
                                    />
                                )}
                            />
                        </FormItem>

                        <FormItem label="Actif">
                            <Controller
                                name="isActive"
                                control={control}
                                render={({ field }) => (
                                    <Switcher
                                        checked={Boolean(field.value)}
                                        onChange={(value) =>
                                            field.onChange(value)
                                        }
                                    />
                                )}
                            />
                        </FormItem>

                        <div className="flex justify-end gap-2">
                            <Button type="button" onClick={closeManageDialog}>
                                Annuler
                            </Button>

                            <Button
                                type="submit"
                                variant="solid"
                                loading={isSubmitting}
                            >
                                {editingMechanic ? 'Update' : 'Ajouter'}
                            </Button>
                        </div>
                    </Form>
                </Dialog>
            )}

            <Dialog
                isOpen={calendarOpen}
                width={1000}
                onClose={closeCalendar}
                onRequestClose={closeCalendar}
            >
                <div className="mb-4">
                    <h4>{selectedMechanic?.name} Calendar</h4>

                   
                </div>

                {calendarLoading && (
                    <div className="py-3 text-center text-gray-500">
                        Chargement des réservations...
                    </div>
                )}

                <CalendarView
                    selectable
                    events={bookingEvents}
                    select={handleSelectSlot}
                    datesSet={handleDatesSet}
                    selectOverlap={false}
                    eventOverlap={false}
                    initialView="timeGridWeek"
                    slotMinTime="08:00:00"
                    slotMaxTime="17:00:00"
                    businessHours={{
                        daysOfWeek: [1, 2, 3, 4, 5, 6],
                        startTime: '08:00',
                        endTime: '17:00',
                    }}
                    allDaySlot={false}
                    slotDuration="01:00:00"
                    slotLabelInterval="01:00:00"
                    selectAllow={(selectInfo) => {
                        const start = dayjs(selectInfo.start)
                        const end = start.add(1, 'hour')

                        return !isSlotOverlapping(start.format(), end.format())
                    }}
                />
            </Dialog>

            <Dialog
                isOpen={appointmentOpen}
                width={520}
                onClose={() => setAppointmentOpen(false)}
                onRequestClose={() => setAppointmentOpen(false)}
            >
                <h4 className="mb-4">Schedule an appointment</h4>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block mb-2 text-sm font-medium">
                            Date
                        </label>

                        <DatePicker
                            value={selectedDate}
                            onChange={handleDateChange}
                        />
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-medium">
                            
                            Hour
                        </label>

                        <Select<Option>
                            options={hourOptions}
                            placeholder={
                                selectedDate
                                    ? 'Choose an hour'
                                    : 'Choose a date first'
                            }
                            isDisabled={!selectedDate}
                            value={
                                hourOptions.find(
                                    (item) => item.value === selectedHour,
                                ) || null
                            }
                            onChange={handleHourChange}
                        />
                    </div>

                    {selectedSlot && (
                        <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                            Selected slot:{' '}
                            <strong>
                                {dayjs(selectedSlot.start).format(
                                    'DD/MM/YYYY HH:mm',
                                )}
                            </strong>{' '}
                            -{' '}
                            <strong>
                                {dayjs(selectedSlot.end).format('HH:mm')}
                            </strong>
                        </div>
                    )}

                    <div>
                        <label className="block mb-2 text-sm font-medium">
                            Vehicle
                        </label>

                        <Select<Option>
                            options={vehicleOptions}
                            placeholder="Choose vehicle"
                            value={
                                vehicleOptions.find(
                                    (item) =>
                                        item.value === selectedVehicleId,
                                ) || null
                            }
                            onChange={handleVehicleChange}
                        />
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-medium">
                            Maintenance
                        </label>

                        <Select<Option>
                            options={maintenanceOptions}
                            placeholder="Choose maintenance"
                            isDisabled={!selectedVehicleId}
                            value={
                                maintenanceOptions.find(
                                    (item) =>
                                        item.value === selectedMaintenanceId,
                                ) || null
                            }
                            onChange={(option) =>
                                setSelectedMaintenanceId(option?.value || '')
                            }
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            onClick={() => setAppointmentOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="solid"
                            loading={saving}
                            disabled={
                                !selectedDate ||
                                !selectedHour ||
                                !selectedVehicleId ||
                                !selectedMaintenanceId ||
                                !selectedSlot
                            }
                            onClick={confirmAppointment}
                        >
                            Confirmer
                        </Button>
                    </div>
                </div>
            </Dialog>
        </Card>
    )
}

export default MechanicsDashboard
