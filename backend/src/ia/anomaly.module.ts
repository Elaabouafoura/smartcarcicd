import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnomalyService } from './anomaly.service'
import { AnomalyController } from './anomaly.controller'
import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity'
import { Vehicle } from 'src/vehicle/entities/vehicle.entity'                          // ← déjà là
import { AnomalyNotificationModule } from 'src/anomaly-notification/anomaly-notification.module'

@Module({
    imports: [
        TypeOrmModule.forFeature([SensorReading, Vehicle]),   
        AnomalyNotificationModule,
    ],
    controllers: [AnomalyController],
    providers: [AnomalyService],
})
export class AnomalyModule {}