import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { InterventionsController } from './interventions.controller';
import { InterventionsService } from './interventions.service';

@Module({
  imports: [CoursesModule],
  controllers: [InterventionsController],
  providers: [InterventionsService],
})
export class InterventionsModule {}
