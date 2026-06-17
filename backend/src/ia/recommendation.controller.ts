import { Controller, Get, Param, Query } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

@Controller('recommendation')
export class RecommendationController {
    constructor(private readonly service: RecommendationService) {}

    @Get(':vehicleId')
    async getOne(
        @Param('vehicleId') vehicleId: string,
        @Query('component') component?: string,
    ) {
        return this.service.getRecommendations(vehicleId, component)
    }

    @Get(':vehicleId/all')
    async getAll(@Param('vehicleId') vehicleId: string) {
        return this.service.getAllRecommendations(vehicleId)
    }
}