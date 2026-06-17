import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm'
import { Vehicle } from 'src/vehicle/entities/vehicle.entity'

@Entity('failure_notifications')
export class FailureNotification {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'vehicle_id' })
    vehicle!: Vehicle

    @Column({ name: 'vehicle_id', type: 'varchar' })
    vehicleId!: string

    @Column({ type: 'varchar', nullable: true })
    vehicleLabel!: string

    @Column({ type: 'varchar' })
    component!: string

    @Column({ type: 'float', nullable: true })
    riskScore!: number

    @Column({ type: 'varchar', nullable: true })
    riskLevel!: string

    @Column({ type: 'boolean', default: false })
    readed!: boolean

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @Column({ name: 'email_sent', default: false })
    emailSent!: boolean
}