import { Module } from '@nestjs/common';
import { FacultyGrowthController } from './faculty-growth.controller';
import { FacultyGrowthService } from './faculty-growth.service';

@Module({
  controllers: [FacultyGrowthController],
  providers: [FacultyGrowthService],
})
export class FacultyGrowthModule {}
