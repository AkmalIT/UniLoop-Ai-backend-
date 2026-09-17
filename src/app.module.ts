import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { LearningOutcomesModule } from './modules/learning-outcomes/learning-outcomes.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { MasteryModule } from './modules/mastery/mastery.module';
import { InsightsModule } from './modules/insights/insights.module';
import { LearningPlansModule } from './modules/learning-plans/learning-plans.module';
import { InterventionsModule } from './modules/interventions/interventions.module';
import { FacultyGrowthModule } from './modules/faculty-growth/faculty-growth.module';
import { AiModule } from './modules/ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    EnrollmentsModule,
    MaterialsModule,
    LearningOutcomesModule,
    AssessmentsModule,
    SubmissionsModule,
    MasteryModule,
    InsightsModule,
    LearningPlansModule,
    InterventionsModule,
    FacultyGrowthModule,
    AiModule,
  ],
})
export class AppModule {}
