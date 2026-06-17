import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FailureNotification } from './entities/failure-notification.entity'
import { FailureNotificationService } from './failure-notification.service'
import { FailureNotificationController } from './failure-notification.controller'
import { User } from 'src/users/entities/user.entity'
import { UsersModule } from 'src/users/users.module'
import { Vehicle } from 'src/vehicle/entities/vehicle.entity'
@Module({
    imports: [TypeOrmModule.forFeature([FailureNotification,Vehicle]),UsersModule],
    controllers: [FailureNotificationController],
    providers: [FailureNotificationService],
    exports: [FailureNotificationService],
})
export class FailureNotificationModule {}