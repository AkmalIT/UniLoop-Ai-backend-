import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ example: 'question-id' })
  @IsString()
  questionId: string;

  @ApiProperty({ example: 'The base case stops the recursive calls.' })
  @IsString()
  answer: string;

  @ApiProperty({ example: 0.8, minimum: 0 })
  @IsNumber()
  @Min(0)
  score: number;
}

export class CreateSubmissionDto {
  @ApiProperty({ example: 'student-profile-id' })
  @IsString()
  studentId: string;

  @ApiProperty({ type: [SubmitAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}
