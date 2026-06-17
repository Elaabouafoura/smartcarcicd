import { Test, TestingModule } from '@nestjs/testing';
import { AnomalyNotificationService } from './anomaly-notification.service';

describe('AnomalyNotificationService', () => {
  let service: AnomalyNotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnomalyNotificationService],
    }).compile();

    service = module.get<AnomalyNotificationService>(AnomalyNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
