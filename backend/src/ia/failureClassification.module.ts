import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity';
import { DtcEntry } from 'src/dtc/entities/dtc.entity';
import { MaintenanceRecord } from 'src/maintenance/entities/maintenance.entity';
import { Vehicle } from 'src/vehicle/entities/vehicle.entity';

import { FailureClassificationService } from './failureClassification.service';
import { FailureClassificationController } from './failureClassification.controller'
import { FailureNotificationModule } from 'src/failure-notification/failure-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SensorReading,
      DtcEntry,
      MaintenanceRecord,
      Vehicle,
    ]),
    FailureNotificationModule
  ],
  controllers: [FailureClassificationController],
  providers: [FailureClassificationService],
  exports: [FailureClassificationService],
})
export class FailureClassificationModule {}