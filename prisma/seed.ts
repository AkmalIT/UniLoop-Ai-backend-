import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { CoursesService } from '../src/modules/courses/courses.service';
import { InsightsService } from '../src/modules/insights/insights.service';
import { MasteryService } from '../src/modules/mastery/mastery.service';

const prisma = new PrismaClient();

function hashPassword(password: string) {
  const salt = 'demo-seed-salt';
  const digest = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `${salt}:${digest}`;
}

async function main() {
  await prisma.agentRun.deleteMany();
  await prisma.growthTask.deleteMany();
  await prisma.growthGoal.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.learningTask.deleteMany();
  await prisma.learningPlan.deleteMany();
  await prisma.cohortInsight.deleteMany();
  await prisma.masteryRecord.deleteMany();
  await prisma.submissionAnswer.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.questionOutcome.deleteMany();
  await prisma.question.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.material.deleteMany();
  await prisma.learningOutcome.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.professorProfile.deleteMany();
  await prisma.user.deleteMany();

  const professorUser = await prisma.user.create({
    data: {
      email: 'professor@uniloop.local',
      name: 'Dr. Amina Karimova',
      role: UserRole.PROFESSOR,
      passwordHash: hashPassword('password123'),
      professorProfile: { create: { department: 'Computer Science' } },
    },
    include: { professorProfile: true },
  });

  if (!professorUser.professorProfile) {
    throw new Error('Professor profile was not created.');
  }

  const students = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      prisma.user.create({
        data: {
          email: `student${index + 1}@uniloop.local`,
          name: `Student ${index + 1}`,
          role: UserRole.STUDENT,
          passwordHash: hashPassword('password123'),
          studentProfile: {
            create: { universityId: `UNI-${String(index + 1).padStart(4, '0')}` },
          },
        },
        include: { studentProfile: true },
      }),
    ),
  );

  const course = await prisma.course.create({
    data: {
      title: 'Programming Fundamentals',
      code: 'CS101',
      description: 'First programming course focused on computational thinking.',
      professorId: professorUser.professorProfile.id,
    },
  });

  const outcomes = await Promise.all(
    [
      'Explain recursive functions',
      'Identify the base case',
      'Trace the recursive call stack',
      'Implement recursive solutions',
    ].map((title, index) =>
      prisma.learningOutcome.create({
        data: {
          courseId: course.id,
          title,
          sortOrder: index + 1,
        },
      }),
    ),
  );

  await prisma.enrollment.createMany({
    data: students.map((student) => ({
      courseId: course.id,
      studentId: student.studentProfile!.id,
    })),
  });

  const assessment = await prisma.assessment.create({
    data: {
      courseId: course.id,
      title: 'Recursive Functions Diagnostic',
      type: 'DIAGNOSTIC',
    },
  });

  const questionSpecs = [
    {
      prompt: 'Explain what makes a function recursive.',
      weight: 20,
      sortOrder: 1,
      outcomes: [{ learningOutcomeId: outcomes[0].id, weight: 1 }],
    },
    {
      prompt: 'Identify the base case in a recursive factorial implementation.',
      weight: 20,
      sortOrder: 2,
      outcomes: [{ learningOutcomeId: outcomes[1].id, weight: 1 }],
    },
    {
      prompt: 'Trace the call stack for factorial(4).',
      weight: 25,
      sortOrder: 3,
      outcomes: [{ learningOutcomeId: outcomes[2].id, weight: 1 }],
    },
    {
      prompt: 'Implement a recursive sum for an array of integers.',
      weight: 25,
      sortOrder: 4,
      outcomes: [{ learningOutcomeId: outcomes[3].id, weight: 1 }],
    },
    {
      prompt: 'Debug a recursive function that never reaches its base case.',
      weight: 10,
      sortOrder: 5,
      outcomes: [
        { learningOutcomeId: outcomes[1].id, weight: 0.5 },
        { learningOutcomeId: outcomes[3].id, weight: 0.5 },
      ],
    },
  ];

  const questions = [];
  for (const spec of questionSpecs) {
    questions.push(
      await prisma.question.create({
        data: {
          assessmentId: assessment.id,
          prompt: spec.prompt,
          weight: new Prisma.Decimal(spec.weight),
          maxScore: new Prisma.Decimal(1),
          sortOrder: spec.sortOrder,
          outcomeLinks: {
            create: spec.outcomes.map((outcome) => ({
              learningOutcomeId: outcome.learningOutcomeId,
              weight: new Prisma.Decimal(outcome.weight),
            })),
          },
        },
        include: { outcomeLinks: true },
      }),
    );
  }

  const scorePatterns = [
    [1, 1, 0.9, 0.8, 1],
    [0.9, 0.95, 0.35, 0.85, 0.8],
    [0.85, 0.4, 0.75, 0.9, 0.45],
    [0.6, 0.55, 0.25, 0.7, 0.4],
    [0.95, 0.9, 0.2, 0.4, 0.7],
    [0.35, 0.8, 0.3, 0.25, 0.45],
    [0.75, 0.3, 0.65, 0.8, 0.25],
    [0.5, 0.45, 0.2, 0.35, 0.35],
    [1, 0.8, 0.55, 0.95, 0.75],
    [0.4, 0.25, 0.1, 0.2, 0.15],
  ];

  const masteryService = new MasteryService(
    prisma as never,
    new CoursesService(prisma as never),
  );

  for (const [studentIndex, student] of students.entries()) {
    const studentProfile = student.studentProfile;
    if (!studentProfile) {
      continue;
    }

    const submission = await prisma.submission.create({
      data: {
        assessmentId: assessment.id,
        studentId: studentProfile.id,
        answers: {
          create: questions.map((question, questionIndex) => ({
            questionId: question.id,
            answer: `Demo answer ${studentIndex + 1}.${questionIndex + 1}`,
            score: new Prisma.Decimal(scorePatterns[studentIndex][questionIndex]),
          })),
        },
      },
      include: { answers: true },
    });

    const mastery = masteryService.calculateSubmissionMastery({
      outcomes: outcomes.map((outcome) => ({ id: outcome.id, title: outcome.title })),
      questions: questions.map((question) => ({
        id: question.id,
        weight: Number(question.weight),
        maxScore: Number(question.maxScore),
        outcomeLinks: question.outcomeLinks.map((link) => ({
          learningOutcomeId: link.learningOutcomeId,
          weight: Number(link.weight),
        })),
      })),
      answers: submission.answers.map((answer) => ({
        questionId: answer.questionId,
        score: Number(answer.score),
      })),
    });

    await masteryService.storeSubmissionMastery({
      studentId: studentProfile.id,
      courseId: course.id,
      assessmentId: assessment.id,
      submissionId: submission.id,
      mastery,
    });
  }

  await prisma.learningPlan.create({
    data: {
      studentId: students[4].studentProfile!.id,
      courseId: course.id,
      title: 'Recursive call-stack strengthening plan',
      rationale: 'Diagnostic shows strong concept recall but weak stack tracing.',
      tasks: {
        create: [
          {
            learningOutcomeId: outcomes[2].id,
            title: 'Trace factorial and Fibonacci by hand',
            description: 'Complete three call-stack diagrams before the follow-up.',
          },
          {
            learningOutcomeId: outcomes[3].id,
            title: 'Implement one recursive list problem',
            description: 'Write and explain a recursive sum implementation.',
          },
        ],
      },
    },
  });

  await prisma.intervention.create({
    data: {
      courseId: course.id,
      professorId: professorUser.professorProfile.id,
      title: 'Call-stack tracing mini-workshop',
      description:
        'Run a 20-minute guided stack trace and compare it with iterative execution.',
      targetOutcomeIds: [outcomes[2].id],
      status: 'PLANNED',
      plannedAt: new Date(),
    },
  });

  await prisma.growthGoal.create({
    data: {
      professorId: professorUser.professorProfile.id,
      title: 'Improve recursion remediation strategy',
      description: 'Use cohort mastery evidence to refine teaching interventions.',
      tasks: {
        create: [
          {
            title: 'Review difficult question data',
            description: 'Inspect which prompts had the lowest score ratios.',
          },
          {
            title: 'Compare diagnostic with follow-up results',
            description: 'Measure whether the intervention improved stack tracing.',
          },
        ],
      },
    },
  });

  const insightsService = new InsightsService(
    prisma as never,
    new CoursesService(prisma as never),
  );
  await insightsService.calculateAndStoreCourseInsights(course.id);

  console.log('Seeded UniLoop AI demo data.');
  console.log(`Professor login: ${professorUser.email} / password123`);
  console.log(`Course ID: ${course.id}`);
  console.log(`Assessment ID: ${assessment.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
