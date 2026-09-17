import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { MasteryModule } from '../mastery/mastery.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [MasteryModule, InsightsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
