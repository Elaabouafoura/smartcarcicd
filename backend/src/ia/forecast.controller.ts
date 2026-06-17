import { Controller, Get, Param } from '@nestjs/common';
import { ForecastService, ForecastResult } from './forecast.service';

@Controller('vehicles/:vehicleId/forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get()
  async getForecast(@Param('vehicleId') vehicleId: string): Promise<ForecastResult> {
    return this.forecastService.getForecast(vehicleId);
  }
}