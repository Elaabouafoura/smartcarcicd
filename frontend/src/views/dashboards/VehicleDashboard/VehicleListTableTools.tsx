import DebouceInput from '@/components/shared/DebouceInput'
import { TbSearch } from 'react-icons/tb'
import cloneDeep from 'lodash/cloneDeep'
import type { ChangeEvent } from 'react'
import type { TableQueries } from '@/@types/common'

type Props = {
    tableData: TableQueries
    setTableData: React.Dispatch<React.SetStateAction<TableQueries>>
}

const VehicleListTableTools = ({ tableData, setTableData }: Props) => {
    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const val = event.target.value
        const newTableData = cloneDeep(tableData)
        newTableData.query = val
        newTableData.pageIndex = 1

        if (typeof val === 'string' && val.length > 1) {
            setTableData(newTableData)
        }

        if (typeof val === 'string' && val.length === 0) {
            setTableData(newTableData)
        }
    }

    return (
        <div className="flex items-center justify-between gap-3 mb-2">
            <h4 className="text-sm font-semibold">Vehicles</h4>

            <DebouceInput
                placeholder="Search"
                suffix={<TbSearch className="text-sm" />}
                onChange={handleInputChange}
                className="max-w-[200px]"
                size="sm"
            />
        </div>
    )
}

export default VehicleListTableTools