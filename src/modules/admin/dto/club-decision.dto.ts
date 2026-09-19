import { IsIn } from 'class-validator';

export class ClubDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}
