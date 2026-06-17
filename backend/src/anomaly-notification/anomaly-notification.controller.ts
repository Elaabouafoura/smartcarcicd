import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common'
import { AnomalyNotificationService } from './anomaly-notification.service'
import { AuthGuard } from '@nestjs/passport';
@UseGuards(AuthGuard('jwt'))
@Controller('anomaly-notifications')
export class AnomalyNotificationController {
    constructor(
        private readonly service: AnomalyNotificationService,
    ) {}

    @Get()
    findAll(@Req() req: any) {
        return this.service.findByUser(req.user.id)
    }

    @Patch('mark-all-read')
    markAllRead(@Req() req: any) {
        return this.service.markAllRead(req.user.id)
    }

    @Patch(':id/read')
    markOneRead(@Param('id') id: string, @Req() req: any) {
        return this.service.markOneRead(id, req.user.id)
    }

    @Delete(':id')
    deleteOne(@Param('id') id: string, @Req() req: any) {
        return this.service.deleteOne(id, req.user.id)
    }
}