import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export class CourseNotFoundException extends NotFoundException {
  constructor(courseId: string) {
    super(`Course ${courseId} was not found.`);
  }
}

export class AssessmentNotFoundException extends NotFoundException {
  constructor(assessmentId: string) {
    super(`Assessment ${assessmentId} was not found.`);
  }
}

export class StudentNotEnrolledException extends ForbiddenException {
  constructor(studentId: string, courseId: string) {
    super(`Student ${studentId} is not enrolled in course ${courseId}.`);
  }
}

export class DuplicateSubmissionException extends ConflictException {
  constructor() {
    super('This student has already submitted this assessment.');
  }
}

export class InvalidSubmissionException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
