import { Controller, Get, Param } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';

@Controller('anomaly')
export class AnomalyController {
  constructor(
    private readonly anomalyService: AnomalyService,
  ) {}

  @Get(':vehicleId')
async detect(
  @Param('vehicleId') vehicleId: string,
) {
  return this.anomalyService.detectVehicleAnomalies(vehicleId);
}
}