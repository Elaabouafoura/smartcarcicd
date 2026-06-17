import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MechanicService } from './mechanic.service'
import { MechanicController } from './mechanic.controller'
import { Mechanic } from './entities/mechanic.entity'
import { MaintenanceRecord } from '../maintenance/entities/maintenance.entity'
import { User } from '../users/entities/user.entity' 

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Mechanic,
      MaintenanceRecord,
      User, 
    ]),
  ],
  controllers: [MechanicController],
  providers: [MechanicService],
  exports: [MechanicService],
})
export class MechanicModule {}