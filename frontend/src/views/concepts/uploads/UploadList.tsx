import { useMemo, useState } from 'react'
import useSWR from 'swr'
import cloneDeep from 'lodash/cloneDeep'
import Card from '@/components/ui/Card'
import Tag from '@/components/ui/Tag'
import Tooltip from '@/components/ui/Tooltip'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import FileIcon from '@/components/view/FileIcon'
import {
    TbTrash,
    TbDownload,
    TbLayoutGrid,
    TbList,
    TbDots,
    TbChevronLeft,
    TbChevronRight,
} from 'react-icons/tb'
import type { TableQueries } from '@/@types/common'
import {
    apiDeleteUpload,
    apiGetUploads,
    type UploadItem,
    type UploadPaginatedResponse,
} from '@/services/DashboardService'

type Layout = 'grid' | 'list'

const statusColor: Record<string, string> = {
    processing:
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
    success:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
}

// Version compacte de la carte Grid
const UploadCard = ({
    item,
    onDownload,
    onDelete,
}: {
    item: UploadItem
    onDownload: () => void
    onDelete: () => void
}) => {
    const vehicleLabel = item.vehicle
        ? `${item.vehicle.make ?? ''} ${item.vehicle.model ?? ''} ${item.vehicle.plateNumber ?? ''}`.trim()
        : 'No vehicle'

    return (
        <div className="border rounded-xl px-4 py-3 bg-white dark:bg-gray-800 hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="text-3xl shrink-0">
                        <FileIcon type="csv" />
                    </div>

                    <div className="min-w-0">
                        <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {item.filename}
                        </div>

                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {vehicleLabel}
                        </div>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Tag className={`${statusColor[item.status] || ''} text-xs px-2 py-0.5`}>
                                <span className="capitalize text-xs">{item.status}</span>
                            </Tag>

                            <span className="text-xs text-gray-500">
                                {item.row_count ?? '-'} rows
                            </span>

                            <span className="text-xs text-gray-500">
                                {new Date(item.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                    <Tooltip title="Download">
                        <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={onDownload}
                        >
                            <TbDownload className="text-base" />
                        </button>
                    </Tooltip>

                    <Tooltip title="Delete">
                        <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            onClick={onDelete}
                        >
                            <TbTrash className="text-base" />
                        </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    )
}

// Version compacte de la ligne List
const UploadRow = ({
    item,
    onDownload,
    onDelete,
}: {
    item: UploadItem
    onDownload: () => void
    onDelete: () => void
}) => {
    return (
        <div className="border rounded-xl px-4 py-3 bg-white dark:bg-gray-800 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="text-3xl shrink-0">
                        <FileIcon type="csv" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {item.filename}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {item.vehicle?.make && `${item.vehicle.make}`}
                            {item.vehicle?.model && ` ${item.vehicle.model}`}
                            {item.vehicle?.plateNumber && ` (${item.vehicle.plateNumber})`}
                            {!item.vehicle?.make && !item.vehicle?.model && 'No vehicle'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <Tag className={`${statusColor[item.status] || ''} text-xs px-2 py-0.5`}>
                        <span className="capitalize text-xs">{item.status}</span>
                    </Tag>

                    <span className="text-xs text-gray-500 hidden sm:block">
                        {new Date(item.created_at).toLocaleDateString()}
                    </span>

                    <Tooltip title="Download">
                        <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={onDownload}
                        >
                            <TbDownload className="text-base" />
                        </button>
                    </Tooltip>

                    <Tooltip title="Delete">
                        <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            onClick={onDelete}
                        >
                            <TbTrash className="text-base" />
                        </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    )
}

const UploadList = () => {
    const [layout, setLayout] = useState<Layout>('grid')

    const [tableData, setTableData] = useState<TableQueries>({
        pageIndex: 1,
        pageSize: 10,
        sort: {
            order: '',
            key: '',
        },
        query: '',
    })

    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
    const [selectedUploadId, setSelectedUploadId] = useState('')
    const [pageSizeMenuOpen, setPageSizeMenuOpen] = useState(false)

    const { data, isLoading, mutate } = useSWR(
        ['/uploads', tableData.pageIndex, tableData.pageSize],
        () =>
            apiGetUploads<UploadPaginatedResponse>({
                page: tableData.pageIndex as number,
                limit: tableData.pageSize as number,
            }),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        },
    )

    const uploadList = useMemo(() => data?.data ?? [], [data])
    const total = data?.total ?? 0
    const currentPage = tableData.pageIndex as number
    const pageSize = tableData.pageSize as number
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const handleSetTableData = (newData: TableQueries) => {
        setTableData(newData)
    }

    const handlePaginationChange = (page: number) => {
        const nextPage = Math.min(Math.max(page, 1), totalPages)
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = nextPage
        handleSetTableData(newTableData)
    }

    const handleSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        handleSetTableData(newTableData)
        setPageSizeMenuOpen(false)
    }

    const handleDelete = (id: string) => {
        setSelectedUploadId(id)
        setDeleteConfirmationOpen(true)
    }

    const handleCloseDeleteDialog = () => {
        setDeleteConfirmationOpen(false)
        setSelectedUploadId('')
    }

    const handleConfirmDelete = async () => {
        if (!selectedUploadId) return

        try {
            await apiDeleteUpload(selectedUploadId)
            await mutate()

            toast.push(
                <Notification type="success">
                    Upload deleted successfully
                </Notification>,
                { placement: 'top-center' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification type="danger">
                    Failed to delete upload
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            handleCloseDeleteDialog()
        }
    }

    const handleDownload = async (id: string, filename: string) => {
        try {
            const token = localStorage.getItem('token')

            const response = await fetch(
                `http://localhost:3000/api/v1/uploads/${id}/download`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error('download error body =', errorText)
                throw new Error(`Failed to download file (${response.status})`)
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()

            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('handleDownload error:', error)
            toast.push(
                <Notification type="danger">
                    Failed to download upload
                </Notification>,
                { placement: 'top-center' },
            )
        }
    }

    const getPageNumbers = () => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, i) => i + 1)
        }

        if (currentPage <= 3) {
            return [1, 2, 3, 4, totalPages]
        }

        if (currentPage >= totalPages - 2) {
            return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        }

        return [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
    }

    return (
        <>
            <Card className="rounded-2xl p-5">
                {/* Header compact */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-xl font-bold">File Manager</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {total} file(s) total
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-0.5">
                            <button
                                type="button"
                                className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition ${
                                    layout === 'grid'
                                        ? 'bg-white shadow text-primary'
                                        : 'text-gray-500'
                                }`}
                                onClick={() => setLayout('grid')}
                            >
                                <TbLayoutGrid className="text-base" />
                            </button>

                            <button
                                type="button"
                                className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition ${
                                    layout === 'list'
                                        ? 'bg-white shadow text-primary'
                                        : 'text-gray-500'
                                }`}
                                onClick={() => setLayout('list')}
                            >
                                <TbList className="text-base" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Files section compact */}
                <div>
                    <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                        Files
                    </h4>

                    {isLoading && (
                        <div className="text-sm text-gray-500 py-4">Loading...</div>
                    )}

                    {!isLoading && uploadList.length === 0 && (
                        <div className="text-sm text-gray-500 py-8 text-center">
                            No uploads found
                        </div>
                    )}

                    {!isLoading && uploadList.length > 0 && layout === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                            {uploadList.map((item) => (
                                <UploadCard
                                    key={item.id}
                                    item={item}
                                    onDownload={() =>
                                        handleDownload(item.id, item.filename)
                                    }
                                    onDelete={() => handleDelete(item.id)}
                                />
                            ))}
                        </div>
                    )}

                    {!isLoading && uploadList.length > 0 && layout === 'list' && (
                        <div className="flex flex-col gap-2">
                            {uploadList.map((item) => (
                                <UploadRow
                                    key={item.id}
                                    item={item}
                                    onDownload={() =>
                                        handleDownload(item.id, item.filename)
                                    }
                                    onDelete={() => handleDelete(item.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination compact */}
                {totalPages > 0 && (
                    <div className="mt-5 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() =>
                                    handlePaginationChange(currentPage - 1)
                                }
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-gray-700"
                            >
                                <TbChevronLeft className="text-base" />
                            </button>

                            {getPageNumbers().map((page, index, arr) => {
                                const showDots =
                                    index > 0 && page - arr[index - 1] > 1

                                return (
                                    <div
                                        key={page}
                                        className="flex items-center gap-1"
                                    >
                                        {showDots && (
                                            <span className="px-1 text-gray-400 text-xs">
                                                ...
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handlePaginationChange(page)
                                            }
                                            className={`h-8 min-w-[32px] px-2 rounded-lg text-sm font-semibold transition ${
                                                currentPage === page
                                                    ? 'text-orange-500'
                                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    </div>
                                )
                            })}

                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() =>
                                    handlePaginationChange(currentPage + 1)
                                }
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-gray-700"
                            >
                                <TbChevronRight className="text-base" />
                            </button>
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() =>
                                    setPageSizeMenuOpen((prev) => !prev)
                                }
                                className="h-9 rounded-xl border border-orange-500 bg-white px-3 text-sm font-semibold text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white min-w-[100px] inline-flex items-center justify-between gap-2"
                            >
                                <span>{pageSize} / page</span>
                                <TbDots className="text-sm text-gray-500" />
                            </button>

                            {pageSizeMenuOpen && (
                                <div className="absolute bottom-12 right-0 w-[140px] rounded-xl border border-gray-100 bg-white shadow-xl dark:bg-gray-800 dark:border-gray-700 overflow-hidden z-20">
                                    {[10, 25, 50, 100].map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() =>
                                                handleSelectChange(size)
                                            }
                                            className={`w-full px-4 py-3 text-left text-sm font-semibold transition ${
                                                pageSize === size
                                                    ? 'text-orange-500 bg-orange-50 dark:bg-orange-500/10'
                                                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {size} / page
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            <ConfirmDialog
                isOpen={deleteConfirmationOpen}
                type="danger"
                title="Delete upload"
                onClose={handleCloseDeleteDialog}
                onRequestClose={handleCloseDeleteDialog}
                onCancel={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
            >
                <p>Are you sure you want to delete this upload?</p>
            </ConfirmDialog>
        </>
    )
}

export default UploadList