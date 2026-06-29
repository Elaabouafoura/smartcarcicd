import { IsString, IsUUID, IsOptional } from 'class-validator'

export class CreateAiMaintenanceDto {
    @IsUUID()
    vehicleId!: string

    @IsString()
    service_type!: string

    @IsOptional()
    @IsString()
    source?: string
}