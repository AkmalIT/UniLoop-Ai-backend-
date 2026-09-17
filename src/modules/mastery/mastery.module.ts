import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { MasteryController } from './mastery.controller';
import { MasteryService } from './mastery.service';

@Module({
  imports: [CoursesModule],
  controllers: [MasteryController],
  providers: [MasteryService],
  exports: [MasteryService],
})
export class MasteryModule {}
