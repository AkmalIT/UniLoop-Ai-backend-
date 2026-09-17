# UniLoop AI Backend

NestJS backend foundation for the UniLoop AI academic improvement loop.

## Repository Assessment

This workspace started empty: there was no existing backend, frontend, Prisma setup, PostgreSQL configuration, authentication code, or reusable EduPath implementation. The implementation therefore scaffolds a fresh backend-only modular monolith.

## Requirements

- Node.js 22+
- npm 11+
- PostgreSQL 14+

## Setup

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` and `JWT_SECRET` in `.env`.

## Database

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

If you prefer applying the generated SQL directly, the initial migration is in:

```text
prisma/migrations/20260917173000_init/migration.sql
```

## Development

```bash
npm run start:dev
```

Swagger is available at:

```text
http://localhost:3000/docs
```

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Demo Accounts

After seeding:

```text
professor@uniloop.local / password123
student1@uniloop.local / password123
student2@uniloop.local / password123
...
student10@uniloop.local / password123
```

## Core API Flow

1. Create or seed a course.
2. Add learning outcomes with `POST /courses/:id/outcomes`.
3. Create an assessment with `POST /courses/:id/assessments`.
4. Add weighted questions with `POST /assessments/:id/questions`.
5. Enroll students with `POST /courses/:courseId/enrollments`.
6. Submit an assessment with `POST /assessments/:id/submissions`.
7. Read student mastery with `GET /students/:studentId/mastery/:courseId`.
8. Read professor insights with `GET /professor/courses/:courseId/insights`.

## Implemented Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /courses`
- `GET /courses/:id`
- `GET /courses/:id/students`
- `POST /courses/:courseId/enrollments`
- `GET /courses/:id/outcomes`
- `POST /courses/:id/outcomes`
- `GET /courses/:id/assessments`
- `POST /courses/:id/assessments`
- `GET /assessments/:id`
- `POST /assessments/:id/questions`
- `POST /assessments/:id/submissions`
- `GET /submissions/:id`
- `GET /students/:studentId/mastery/:courseId`
- `GET /professor/courses/:courseId/insights`
- `GET /students/:studentId/learning-plan/:courseId`
- `POST /students/:studentId/learning-plan/:courseId`
- `GET /professor/courses/:courseId/interventions`
- `POST /professor/courses/:courseId/interventions`
- `GET /professors/:professorId/growth-plan`
- `POST /professors/:professorId/growth-plan`
- `GET /ai/status`

## Mastery Calculation

Mastery is deterministic and does not use an LLM.

For each learning outcome, the service considers answered questions linked to that outcome:

```text
score ratio = answer score / question max score
weighted contribution = score ratio * question weight * question-outcome weight
mastery = sum(weighted contributions) / sum(question weight * question-outcome weight)
```

Statuses:

- `MASTERED`: 80-100
- `DEVELOPING`: 50-79.99
- `NEEDS_ATTENTION`: below 50
- `NOT_ASSESSED`: no linked answered question

## Seed Data

The seed creates:

- 1 professor
- 10 students
- 1 Programming Fundamentals course
- 4 recursive-functions learning outcomes
- 1 diagnostic assessment
- 5 weighted questions
- 10 varied submissions
- mastery records
- one cohort insight snapshot
- one learning plan
- one intervention
- one faculty growth plan

## AI Boundary

The `src/modules/ai` module is intentionally a placeholder. LLM providers can later support misconception analysis, learning-plan generation, teaching recommendations, outcome extraction, and assessment generation, but the LLM must not own grades, mastery percentages, authorization, persistence, or progress calculations.
