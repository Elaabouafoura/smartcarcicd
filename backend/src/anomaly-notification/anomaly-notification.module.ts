import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnomalyNotification } from './entities/anomaly-notification.entity'
import { AnomalyNotificationService } from './anomaly-notification.service'
import { AnomalyNotificationController } from './anomaly-notification.controller'

@Module({
    imports: [TypeOrmModule.forFeature([AnomalyNotification])],
    controllers: [AnomalyNotificationController],
    providers: [AnomalyNotificationService],
    exports: [AnomalyNotificationService],
})
export class AnomalyNotificationModule {}