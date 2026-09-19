import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'Programming Fundamentals' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'CS101' })
  @IsString()
  code: string;

  @ApiProperty({ required: false, example: 'Introductory programming course.' })
  @IsOptional()
  @IsString()
  description?: string;

}
