import { Controller, Get, Patch, Param, UseGuards, Req } from '@nestjs/common'
import { FailureNotificationService } from './failure-notification.service'
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('failure-notifications')
export class FailureNotificationController {
    constructor(private readonly service: FailureNotificationService) {}

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
}