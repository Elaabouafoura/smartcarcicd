import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm'
import { Vehicle } from 'src/vehicle/entities/vehicle.entity'

@Entity('anomaly_notifications')
export class AnomalyNotification {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'vehicle_id' })
    vehicle!: Vehicle

    @Column({ name: 'vehicle_id' })
    vehicleId!: string

    @Column({ type: 'varchar', nullable: true })   // ← type explicite
    vehicleLabel!: string

    @Column({ name: 'sensor_reading_id', type: 'varchar', nullable: true })  // ← type explicite
    sensorReadingId!: string

    @Column({ type: 'timestamptz', nullable: true })
    timestamp!: Date

    @Column({ type: 'float', nullable: true })
    score!: number

    @Column({ name: 'anomaly_probability', type: 'float', nullable: true })
    anomalyProbability!: number

    @Column({ type: 'boolean', default: false })   // ← type explicite
    readed!: boolean

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}