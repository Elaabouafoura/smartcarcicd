import { useMemo, useState } from 'react'
import useSWR from 'swr'
import cloneDeep from 'lodash/cloneDeep'
import Avatar from '@/components/ui/Avatar'
import Card from '@/components/ui/Card'
import DataTable from '@/components/shared/DataTable'
import Loading from '@/components/shared/Loading'
import StickyFooter from '@/components/shared/StickyFooter'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { TbChecks, TbTrash, TbX, TbUsers, TbShield, TbUser } from 'react-icons/tb'
import {
    apiGetUsers,
    type UserListItem,
    apiDeleteUsers,
} from '@/services/DashboardService'
import ApiService from '@/services/ApiService'
import classNames from '@/utils/classNames'
import type {
    ColumnDef,
    OnSortParam,
    Row,
} from '@/components/shared/DataTable'
import type { TableQueries } from '@/@types/common'
import UsersTableTools from './UsersTableTools'

type GetUsersResponse = UserListItem[]
type RoleType = 'admin' | 'user'

type RoleOption = {
    value: RoleType
    label: string
}

const roleOptions: RoleOption[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
]

const apiUpdateUserRole = async (userId: string, role: RoleType) => {
    return ApiService.fetchDataWithAxios({
        url: `/users/${userId}/role`,
        method: 'patch',
        data: { role },
    })
}

// Composant InlineStatSegment comme dans le Dashboard
const InlineStatSegment = ({ title, value, icon, iconClass }: { 
    title: string; 
    value: string | number; 
    icon: React.ReactNode; 
    iconClass: string;
}) => (
    <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-[140px]">
        <div className={classNames('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg', iconClass)}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{title}</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {value}
            </div>
        </div>
    </div>
)

const UsersDashboard = () => {
    const [tableData, setTableData] = useState<TableQueries>({
        pageIndex: 1,
        pageSize: 10,
        sort: {
            order: '',
            key: '',
        },
        query: '',
    })

    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [selectedUsers, setSelectedUsers] = useState<UserListItem[]>([])
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
    const [localUsers, setLocalUsers] = useState<UserListItem[] | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<string | null>(
        null,
    )

    const { data, isLoading } = useSWR(
        ['/users'],
        () => apiGetUsers<GetUsersResponse>(),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        },
    )

    const users =
    (localUsers ?? data ?? []).filter(
        (u) => u.role === 'admin' || u.role === 'user',
    )

    const stats = useMemo(() => {
        const total = users.length
        const admins = users.filter((user) => user.role === 'admin').length
        const normalUsers = users.filter((user) => user.role === 'user').length

        return {
            total,
            admins,
            normalUsers,
        }
    }, [users])

    const filteredUsers = useMemo(() => {
        const query = tableData.query?.toLowerCase().trim() || ''

        return users.filter((user) => {
            const matchesRole =
                roleFilter === 'all' ? true : user.role === roleFilter

            const matchesQuery =
                !query ||
                user.name?.toLowerCase().includes(query) ||
                user.email?.toLowerCase().includes(query) ||
                user.role?.toLowerCase().includes(query)

            return matchesRole && matchesQuery
        })
    }, [users, tableData.query, roleFilter])

    const sortedUsers = useMemo(() => {
        const copied = [...filteredUsers]
        const sort = tableData.sort

        if (!sort?.key || !sort?.order) {
            return copied
        }

        return copied.sort((a, b) => {
            const key = sort.key as keyof UserListItem
            const aValue = a[key]
            const bValue = b[key]

            if (key === 'createdAt') {
                const aDate = new Date(a.createdAt).getTime()
                const bDate = new Date(b.createdAt).getTime()
                return sort.order === 'asc' ? aDate - bDate : bDate - aDate
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sort.order === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue)
            }

            return 0
        })
    }, [filteredUsers, tableData.sort])

    const paginatedUsers = useMemo(() => {
        const pageIndex = tableData.pageIndex as number
        const pageSize = tableData.pageSize as number
        const start = (pageIndex - 1) * pageSize
        const end = start + pageSize

        return sortedUsers.slice(start, end)
    }, [sortedUsers, tableData.pageIndex, tableData.pageSize])

    const csvData = useMemo(() => {
        return filteredUsers.map((user) => ({
            ID: user.id,
            Name: user.name,
            Email: user.email,
            Role: user.role,
            CreatedAt: new Date(user.createdAt).toLocaleString(),
        }))
    }, [filteredUsers])

    const handleSetTableData = (data: TableQueries) => {
        setTableData(data)
        if (selectedUsers.length > 0) {
            setSelectedUsers([])
        }
    }

    const handlePaginationChange = (page: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = page
        handleSetTableData(newTableData)
    }

    const handleSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        handleSetTableData(newTableData)
    }

    const handleSort = (sort: OnSortParam) => {
        const newTableData = cloneDeep(tableData)
        newTableData.sort = sort
        handleSetTableData(newTableData)
    }

    const handleRowSelect = (checked: boolean, row: UserListItem) => {
        if (checked) {
            setSelectedUsers((prev) => {
                const exists = prev.some((user) => user.id === row.id)
                if (exists) return prev
                return [...prev, row]
            })
        } else {
            setSelectedUsers((prev) =>
                prev.filter((user) => user.id !== row.id),
            )
        }
    }

    const handleAllRowSelect = (
        checked: boolean,
        rows: Row<UserListItem>[],
    ) => {
        if (checked) {
            const originalRows = rows.map((row) => row.original)
            setSelectedUsers(originalRows)
        } else {
            setSelectedUsers([])
        }
    }

    const handleClearSelection = () => {
        setSelectedUsers([])
    }

    const handleDelete = () => {
        setDeleteConfirmationOpen(true)
    }

    const handleCancelDelete = () => {
        if (deleteLoading) return
        setDeleteConfirmationOpen(false)
    }

    const handleConfirmDelete = async () => {
        try {
            setDeleteLoading(true)

            const ids = selectedUsers.map((user) => user.id)

            await apiDeleteUsers(ids)

            const newUsers = users.filter((user) => !ids.includes(user.id))

            setLocalUsers(newUsers)
            setSelectedUsers([])
            setDeleteConfirmationOpen(false)

            const filteredAfterDelete = newUsers.filter((user) => {
                const query = tableData.query?.toLowerCase().trim() || ''

                const matchesRole =
                    roleFilter === 'all' ? true : user.role === roleFilter

                const matchesQuery =
                    !query ||
                    user.name?.toLowerCase().includes(query) ||
                    user.email?.toLowerCase().includes(query) ||
                    user.role?.toLowerCase().includes(query)

                return matchesRole && matchesQuery
            })

            const totalPages = Math.ceil(
                filteredAfterDelete.length / (tableData.pageSize as number),
            )

            setTableData((prev) => ({
                ...prev,
                pageIndex:
                    totalPages > 0 && (prev.pageIndex as number) > totalPages
                        ? totalPages
                        : 1,
            }))

            toast.push(
                <Notification type="success">
                    Users deleted successfully
                </Notification>,
                { placement: 'top-center' },
            )
        } catch (error) {
            console.error('Delete users error:', error)

            toast.push(
                <Notification type="danger">
                    Failed to delete selected users
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setDeleteLoading(false)
        }
    }

    const handleRoleChange = async (
        userId: string,
        nextRole: RoleType,
        currentRole: string,
    ) => {
        if (nextRole === currentRole) return

        try {
            setRoleUpdatingUserId(userId)

            await apiUpdateUserRole(userId, nextRole)

            const newUsers = users.map((user) =>
                user.id === userId ? { ...user, role: nextRole } : user,
            )

            setLocalUsers(newUsers)

            setSelectedUsers((prev) =>
                prev.map((user) =>
                    user.id === userId ? { ...user, role: nextRole } : user,
                ),
            )

            toast.push(
                <Notification type="success">
                    User role updated successfully
                </Notification>,
                { placement: 'top-center' },
            )
        } catch (error) {
            console.error('Update role error:', error)
            toast.push(
                <Notification type="danger">
                    Failed to update user role
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setRoleUpdatingUserId(null)
        }
    }

    const columns: ColumnDef<UserListItem>[] = useMemo(
        () => [
            {
                header: 'User',
                accessorKey: 'name',
                cell: (props) => {
                    const user = props.row.original

                    return (
                        <div className="flex items-center gap-2">
                            <Avatar 
                                size={32} 
                                className="bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-md"
                            >
                                {(user.name ?? 'U').charAt(0).toUpperCase()}
                            </Avatar>
                            <div>
                                <div className="heading-text font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                    {user.name}
                                </div>
                            </div>
                        </div>
                    )
                },
            },
            {
                header: 'Email',
                accessorKey: 'email',
                cell: (props) => (
                    <div className="text-gray-600 dark:text-gray-400 text-sm">
                        {props.row.original.email}
                    </div>
                ),
            },
            {
                header: 'Role',
                accessorKey: 'role',
                cell: (props) => {
                    const user = props.row.original

                    return (
                        <div className="w-28">
                            <Select<RoleOption>
                                size="sm"
                                isDisabled={roleUpdatingUserId === user.id}
                                value={roleOptions.find(
                                    (option) => option.value === user.role,
                                )}
                                options={roleOptions}
                                onChange={(option) => {
                                    if (!option) return
                                    handleRoleChange(
                                        user.id,
                                        option.value,
                                        user.role,
                                    )
                                }}
                                className="role-select-custom"
                                styles={{
                                    control: (base, { isDisabled }) => ({
                                        ...base,
                                        backgroundColor: 'transparent',
                                        borderColor: '#e2e8f0',
                                        borderRadius: '8px',
                                        minHeight: '32px',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            backgroundColor: 'transparent',
                                            borderColor: '#cbd5e1',
                                        },
                                        ...(isDisabled && {
                                            backgroundColor: '#f3f4f6',
                                            opacity: 0.6,
                                        }),
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        backgroundColor: 'white',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        marginTop: '4px',
                                    }),
                                    option: (base, { isFocused, isSelected }) => ({
                                        ...base,
                                        backgroundColor: isSelected 
                                            ? '#3b82f6' 
                                            : isFocused 
                                            ? '#f3f4f6' 
                                            : 'white',
                                        color: isSelected ? 'white' : '#374151',
                                        cursor: 'pointer',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        '&:active': {
                                            backgroundColor: isSelected ? '#3b82f6' : '#e5e7eb',
                                        },
                                    }),
                                    singleValue: (base) => ({
                                        ...base,
                                        color: '#1f2937',
                                        fontWeight: 500,
                                        fontSize: '13px',
                                    }),
                                    indicatorSeparator: (base) => ({
                                        ...base,
                                        backgroundColor: '#e2e8f0',
                                    }),
                                    dropdownIndicator: (base) => ({
                                        ...base,
                                        color: '#9ca3af',
                                        padding: '4px',
                                        '&:hover': {
                                            color: '#6b7280',
                                        },
                                    }),
                                }}
                            />
                        </div>
                    )
                },
            },
            {
                header: 'Created',
                accessorKey: 'createdAt',
                cell: (props) => {
                    const date = new Date(props.row.original.createdAt)
                    return (
                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                            {date.toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            })}
                        </div>
                    )
                },
            },
        ],
        [roleUpdatingUserId, users],
    )

    return (
        <Loading loading={isLoading}>
            <div className="flex flex-col gap-3">
                <Card className="shadow-lg border-0 p-4">
                    <UsersTableTools
                        tableData={tableData}
                        setTableData={setTableData}
                        roleFilter={roleFilter}
                        setRoleFilter={setRoleFilter}
                        csvData={csvData}
                        setSelectedUsers={setSelectedUsers}
                    />

                    {/* Stats Card unique - style Dashboard */}
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/40 mt-4">
                        <div className="flex flex-wrap divide-x divide-gray-200 dark:divide-gray-700">
                            <InlineStatSegment
                                title="Total Users"
                                value={stats.total}
                                icon={<TbUsers size={14} />}
                                iconClass="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                            />
                            <InlineStatSegment
                                title="Admins"
                                value={stats.admins}
                                icon={<TbShield size={14} />}
                                iconClass="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                            />
                            <InlineStatSegment
                                title="Users"
                                value={stats.normalUsers}
                                icon={<TbUser size={14} />}
                                iconClass="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <DataTable
                            selectable
                            columns={columns}
                            data={paginatedUsers}
                            loading={isLoading}
                            noData={!isLoading && filteredUsers.length === 0}
                            skeletonAvatarColumns={[0]}
                            skeletonAvatarProps={{ width: 28, height: 28 }}
                            pagingData={{
                                total: filteredUsers.length,
                                pageIndex: tableData.pageIndex as number,
                                pageSize: tableData.pageSize as number,
                            }}
                            checkboxChecked={(row) =>
                                selectedUsers.some(
                                    (selected) => selected.id === row.id,
                                )
                            }
                            onPaginationChange={handlePaginationChange}
                            onSelectChange={handleSelectChange}
                            onSort={handleSort}
                            onCheckBoxChange={handleRowSelect}
                            onIndeterminateCheckBoxChange={handleAllRowSelect}
                        />
                    </div>
                </Card>

                {selectedUsers.length > 0 && (
                    <StickyFooter
                        className="flex items-center justify-between py-3 bg-white dark:bg-gray-800 shadow-lg"
                        stickyClass="-mx-4 sm:-mx-8 border-t border-gray-200 dark:border-gray-700 px-8"
                        defaultClass="container mx-auto px-8 rounded-xl border border-gray-200 dark:border-gray-600 mt-3"
                    >
                        <div className="container mx-auto">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span className="text-primary">
                                        <TbChecks className="text-base" />
                                    </span>
                                    <span className="font-semibold flex items-center gap-1 text-sm">
                                        <span className="heading-text">
                                            {selectedUsers.length}
                                        </span>
                                        <span>selected</span>
                                    </span>
                                </span>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="xs"
                                        icon={<TbX className="text-sm" />}
                                        onClick={handleClearSelection}
                                        className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        Clear
                                    </Button>

                                    <Button
                                        size="xs"
                                        type="button"
                                        icon={<TbTrash className="text-sm" />}
                                        customColorClass={() =>
                                            'border-error ring-1 ring-error text-error hover:border-error hover:ring-error hover:text-error hover:bg-error/10'
                                        }
                                        onClick={handleDelete}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </StickyFooter>
                )}

                <ConfirmDialog
                    isOpen={deleteConfirmationOpen}
                    type="danger"
                    title="Delete users"
                    onClose={handleCancelDelete}
                    onRequestClose={handleCancelDelete}
                    onCancel={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    confirmButtonProps={{ loading: deleteLoading }}
                >
                    <p className="text-sm">
                        Are you sure you want to delete these users? This action
                        can&apos;t be undone.
                    </p>
                </ConfirmDialog>
            </div>
        </Loading>
    )
}

export default UsersDashboard