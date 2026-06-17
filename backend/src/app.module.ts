import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import{ ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { AuthModule } from './auth/auth.module';
import { SensorReadingModule } from './sensor-reading/sensor-reading.module';
import { DtcModule } from './dtc/dtc.module';
import { UploadModule } from './upload/upload.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MechanicModule } from './mechanic/mechanic.module';
import { AnomalyModule } from './ia/anomaly.module';
import { FailureClassificationModule } from './ia/failureClassification.module';
import { ForecastModule } from './ia/forecast.module';
import { RecommendationModule } from './ia/recommendation.module';
import { AnomalyNotificationModule } from './anomaly-notification/anomaly-notification.module';
import { FailureNotificationModule } from './failure-notification/failure-notification.module';
 @Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(
      config.get<string>('DB_PORT') || '5432'
    ), 
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
  }),

  UsersModule,

  VehicleModule,

  AuthModule,


  SensorReadingModule,

  DtcModule,

  UploadModule,

  MaintenanceModule,

  MechanicModule,
  AnomalyModule,
  FailureClassificationModule,
  ForecastModule,
  RecommendationModule,
  AnomalyNotificationModule,
 
  FailureNotificationModule,
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
