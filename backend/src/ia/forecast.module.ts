import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { ForecastAggregationService } from './forecast-aggregation.service';

import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity';
import { DtcEntry } from 'src/dtc/entities/dtc.entity';
import { MaintenanceRecord } from 'src/maintenance/entities/maintenance.entity';
import { Vehicle } from 'src/vehicle/entities/vehicle.entity';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 3,
    }),
    TypeOrmModule.forFeature([
      SensorReading,
      DtcEntry,
      MaintenanceRecord,
      Vehicle,
    ]),
  ],
  controllers: [ForecastController],
  providers: [ForecastService, ForecastAggregationService],
  exports: [ForecastService],
})
export class ForecastModule {}