import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 'student-profile-id' })
  @IsString()
  studentId: string;
}
