import { PartialType } from '@nestjs/swagger';
import { CreateFailureNotificationDto } from './create-failure-notification.dto';

export class UpdateFailureNotificationDto extends PartialType(CreateFailureNotificationDto) {}
