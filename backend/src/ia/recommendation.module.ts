import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DtcEntry } from 'src/dtc/entities/dtc.entity';
import { MaintenanceRecord } from 'src/maintenance/entities/maintenance.entity';
import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { FailureClassificationService } from './failureClassification.service';
import { Vehicle } from 'src/vehicle/entities/vehicle.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SensorReading,
      DtcEntry,
      MaintenanceRecord,
      Vehicle
    ]),
  ],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    FailureClassificationService,
  ],
})
export class RecommendationModule {}