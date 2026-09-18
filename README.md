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

---

## Deployment

### Local development

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL and JWT_SECRET
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run start:dev
```

### Docker (local)

```bash
docker build -t uniloop-ai-backend .
docker run --env-file .env -p 3000:3000 uniloop-ai-backend
```

The container runs `prisma migrate deploy` then starts the server.
The server listens on `$PORT` (defaults to 3000 if unset).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `PORT` | injected by Render | Port the server listens on |
| `LLM_PROVIDER` | optional | LLM provider name (e.g. `gemini`) |
| `LLM_API_KEY` | optional | API key for the LLM provider |
| `AWS_ENDPOINT_URL_S3` | optional | S3-compatible storage endpoint |
| `AWS_ACCESS_KEY_ID` | optional | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | optional | S3 secret key |
| `AWS_REGION` | optional | AWS/S3 region |

Never commit `.env`. Use `.env.example` as the template.

### Render deployment

1. Push the repository to GitHub.
2. In the Render dashboard, click **New → Blueprint** and connect the repository — `render.yaml` will configure the web service and PostgreSQL database automatically.

   Or manually:
   1. **New → Web Service** → connect the GitHub repository.
   2. Set **Runtime** to **Docker**.
   3. Set **Dockerfile path** to `./Dockerfile`.
   4. Add environment variables: `JWT_SECRET` (generate a strong random value), and any optional LLM/S3 variables.
   5. Under **Add-ons**, create a **PostgreSQL** database and copy its **Internal Connection String** into `DATABASE_URL`.
   6. Set **Health Check Path** to `/ai/status`.
   7. Click **Deploy**.

Render injects `PORT` automatically; the application reads it at startup.

### CI/CD

GitHub Actions runs on every push to `main` and on pull requests:

1. `npm ci` — install dependencies from lockfile
2. `prisma validate` + `prisma generate` — validate schema and generate client
3. `tsc --noEmit` — TypeScript type check
4. `eslint` — lint
5. `jest` — unit tests (with a PostgreSQL service container)
6. `nest build` — compile the application
7. `docker build` — verify the production image builds successfully

The pipeline must pass before merging. Render deploys automatically after a successful push to `main`.
