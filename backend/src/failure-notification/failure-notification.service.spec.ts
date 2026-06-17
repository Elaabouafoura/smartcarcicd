import { Test, TestingModule } from '@nestjs/testing';
import { FailureNotificationService } from './failure-notification.service';

describe('FailureNotificationService', () => {
  let service: FailureNotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FailureNotificationService],
    }).compile();

    service = module.get<FailureNotificationService>(FailureNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
