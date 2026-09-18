# UniLoop Phase 8 canonical API

## Phase 9 final QA

Run `npm run build && node scripts/check-environment.mjs` for secret-safe configuration, migration and target readiness checks. `node scripts/verify-real-reads.mjs` verifies canonical startup/CORS and read-only access on the configured target; internally signed test tokens are explicitly NOT proof of password login. Never run disposable mutating smoke scripts on that populated target.

Configuration accepts `LLM_PROVIDER=` (disabled) or `gemini`, case-insensitive and trimmed. Other names fail without disclosing values. CORS uses comma-delimited exact HTTP(S) origins; keep production origins explicit. Restart both servers after environment changes and rebuild frontend public variables.

Focused process-local, per-IP, 60-second limits: login 30, registration 10, assessment submission 60, endorsement creation 30. Returns `429 RATE_LIMITED` and `Retry-After`. Forwarded headers are not trusted. Production reverse proxies/multiple instances need gateway limits and a reviewed trust-proxy policy. Limits never replace JWT, DTO, ownership or consent checks.

Gemini credentials travel in `x-goog-api-key`, not query URLs, following [official API authentication](https://ai.google.dev/api). Requests time out after 10 seconds; runtime-validated advisory output cannot control deterministic values. Automated assessment authoring remains unavailable.

See [the sibling demo runbook](../../uniloop-frontend/docs/demo-runbook.md) for presentation setup, safe database rules and fallback order.

Frontend: `http://localhost:3000`. Backend: `http://localhost:5001`.
API: `http://localhost:5001/api/v1`. Swagger: `/api/v1/docs`.
Health/boundary description: `GET /api/v1/ai/status`.

## Bootstrap and transport

- `PORT` defaults to 5001 and must be an integer 1–65535.
- `CORS_ORIGINS` is a comma-separated exact HTTP(S) origin allowlist; default `http://localhost:3000`. Wildcards, credentials and URL paths are rejected. Deployment must supply the real frontend origin.
- Methods: GET, POST, PATCH, OPTIONS. Headers: Authorization, Content-Type, Accept. CORS credentials are disabled. CORS is a browser boundary, not an API authorization mechanism.
- Success: `{ "data": ... }`, including arrays. Controllers return unwrapped DTOs; one global interceptor wraps once. No pagination in v1.
- Error: `{ "error": { "code": "...", "message": "...", "details": [] } }`. Codes: VALIDATION_ERROR (400/422), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409), INTERNAL_ERROR (500), UNAVAILABLE (503). Validation details are `{message:string}[]`; server internals are never returned. Frontend chooses localized text, not backend messages.
- Public fields are camelCase; dates are ISO-8601 UTC strings. No raw Prisma response entities. API responses use `Cache-Control: no-store`.
- All academic/career routes require a live JWT database identity, role, and enrollment/course ownership as appropriate. Legacy public academic and unsafe scoring controllers are deliberately not registered. Old unprefixed routes are not compatibility APIs.

## Identity and authentication

`POST /auth/login`: `{email,password}` → `{accessToken,user}`.
`GET /auth/me`: Bearer token → `{id,profileId,fullName,role,university,faculty,avatarLabel}`.
`POST /auth/register`: `{name,email,password,role,universityId?,department?}`. Public roles are STUDENT/PROFESSOR only; ADMIN is rejected. Emails are normalized, duplicate email is 409.

`user.id` is a User ID. `user.profileId` is the StudentProfile/ProfessorProfile ID. Course `professorId`, submission `studentId`, endorsement IDs and frontend resource cache identities refer to profile IDs. Dashboard `userId` retains the frontend legacy field name but means profile ID. No client-supplied student identity is accepted for grading.

No University/Faculty models exist in this schema. Unknown organization names are empty strings and summary organization IDs are null, not invented records. StudentProfile.universityId is an enrollment identifier, not a University foreign key; it is not published as an organization ID.

Passwords use Node scrypt with random 16-byte salt, 64-byte derived key and timing-safe comparison. Legacy SHA-256 hashes intentionally require reset or disposable reseed. Deleted users fail JWT authentication; current database role overrides stale JWT role. Access tokens expire after eight hours. No refresh token or server logout revocation in this MVP.

## Student API

All paths below are relative to `/api/v1`.

- GET `/students/me/dashboard`: `{userId,courseIds,nextAction|null,feedback|null}`.
- GET `/students/me/courses`: `{id,title,code,professorId,studentCount,outcomeCount}[]`.
- GET `/students/me/courses/:courseId`: summary + `{description,professor,students,enrollments,outcomes,materials,assessments,latestFeedback}`. Students/enrollments contain only the current student. `assessments[].submissionCount` is 0 or 1 for this student.
- GET `/students/me/assessments/:assessmentId`: `{id,courseId,type,title,estimatedMinutes,questions:[{id,outcomeId,type,prompt,options:[{id,text}]}]}`. No correct flags, expected answers, grading weights, or other submissions.
- POST `/students/me/assessments/:assessmentId/submissions`: `{answers:[{questionId,optionId}|{questionId,answer}]}`. No student ID, score, correctness, verification or percentage. Every question exactly once; unknown fields, foreign/duplicate questions and invalid choices are rejected. Only configured MULTIPLE_CHOICE and SHORT_ANSWER questions are graded; CODE/PRACTICE authoring is unavailable.
- GET `/students/me/mastery/:courseId`: `{studentId,courseId,overallPercentage,outcomes:[{outcomeId,percentage,level,diagnosticPercentage,followUpPercentage,change,evidence,misconceptionIds,misconceptionDescriptions,nextAction}]}`.
- GET/POST `/students/me/learning-plans/:courseId`: current plan / generate a new advisory current plan. `{id,studentId,courseId,createdAt,tasks:[{id,outcomeId,order,title,type,status,estimatedMinutes,reason,actionTarget}]}`. Generation preserves historical plans. Tasks map to PRACTICE and NOT_STARTED/COMPLETED; 20 minutes is a planning estimate, not a measured duration. No task mutation UI/endpoint exists in this phase.

### Attempts, grading and dependent state

One current submission per student/assessment. A resubmission replaces answers/mastery atomically while retaining submission and skill-evidence identities. PostgreSQL advisory transaction locks serialize concurrent attempts. Short answers compare Unicode NFKC, trimmed lowercase whitespace-normalized text exactly. Multiple choice compares option IDs. No LLM participates in grading.

Existing weighted MasteryService calculates outcome percentages. Overall assessment score uses weighted question score ratios. One source skill score averages mapped assessed outcomes. No evidence is professor-verified until a professor decides. Replacement clears source verification and changes endorsements depending on replaced evidence to NEEDS_DEVELOPMENT, with history. A new learning plan is generated in the same transaction; cohort snapshots are invalidated and AI recommendation text is cleared. Cohort reads and career matches recalculate from actual evidence.

This is an open-book hackathon practice policy: submitted feedback includes correct answers, and resubmission is allowed. It is not a high-stakes examination policy. Prior answers are replaced rather than maintained as immutable attempt history.

Current mastery is the latest record per outcome. Diagnostic/follow-up are null when absent. A follow-up comparison requires follow-up evidence newer than the latest diagnostic. Change is 0 without a paired baseline; cohort improvement is null without pairs. Unassessed outcomes have no evidence, diagnostic null and percentage 0 only as a numeric compatibility placeholder; the UI displays them as unassessed. Misconceptions are empty when no supported evidence exists.

## Professor API

- GET `/professors/me/dashboard`, `/professors/me/courses`, `/professors/me/courses/:courseId`: same stable academic vocabulary; course detail includes the owned cohort. `assessments[].submissionCount` is actual current cohort submissions.
- GET `/professors/me/assessments/:assessmentId`: safe configured assessment DTO.
- GET `/professors/me/courses/:courseId/assessments`: assessment summaries.
- POST `/professors/me/courses/:courseId/materials`: `{title,content}` → stored text material. S3 is not required for text.
- POST `/professors/me/courses/:courseId/outcomes/extract` and `/assessments/generate`: ownership checked, then controlled UNAVAILABLE. UI explicitly labels automated authoring unavailable in HTTP mode; no fabricated AI-generated questions.
- GET `/professors/me/courses/:courseId/insights`: cohort mastery, real paired outcome improvement, question difficulty from current answers, deterministic support groups, evidence assessment IDs. Unsupported misconception groups are empty. Unassessed learners are not assigned fabricated mastery. Weakest/strongest evidence is derived from outcome values in presentation rather than persisted invention.
- GET/POST `/professors/me/courses/:courseId/interventions`: list / suggest grounded weak-outcome interventions.
- PATCH `/professors/me/courses/:courseId/interventions/:interventionId`: `{status:"APPROVED"|"REJECTED"}`. Owner alone decides; both states persist.
- GET/POST `/professors/me/growth-plans`: current stored goals / grounded deterministic advisory generation. New goals carry factual course IDs. UI reloads persisted plans.

## Career, consent and referrals

- GET `/students/me/opportunity-dashboard`: `{profile,gaps,projects,recommendations,endorsementRequests,availableProfessors}`. Available professors are the student's actual enrolled course teachers. Missing career profile is an explicit NOT_FOUND, not a demo fallback.
- PATCH `/students/me/career-profile`: `{targetRole?,targetRoleId?,interests?,consent?}`. Role label and ID must be supplied together; IDs are validated against the five supported roles. Display role is server-controlled. Consent is `{discoverable,peerRecommendations,professorEvidenceReview}`.
- GET `/students/me/recommendations`; PATCH `/students/me/recommendations/:id`: `{status:"NEW"|"SAVED"|"ACCEPTED"|"DISMISSED"}`. Own visible recommendation only.
- POST `/students/me/endorsement-requests`: `{professorId,opportunityId?,targetRole,consentToReview}`. Current global review consent, explicit request consent and teaching relationship required. Target role must match the current server profile; opportunity must be visible. Unique pending key makes equivalent concurrent requests idempotent, including approved requests until changed evidence requires re-review.
- GET `/professors/me/referral-candidates`; GET `/professors/me/students/:studentId/evidence`: live consent + actual teaching relationship + a consented request to this professor. Academic detail is limited to this professor's courses. No global candidate exposure. Withdrawal denies future evidence reads/decisions immediately, and removes visibility from candidate reads.
- POST `/professors/me/endorsements`: `{requestId,status:"APPROVED"|"DECLINED"|"NEEDS_DEVELOPMENT",feedback?}`. Owned pending request, current consent and relationship required. Decision + verification writes are transactional. Consent is locked during a decision; only linked student evidence is verified.
- No public/manual self-selected score endpoint is registered. Project artifact metadata is not modeled by the existing schema; `projects:[]` is explicit rather than fabricated. Existing trusted seeded/project skill references can inform readiness, not invented project descriptions.

Five role IDs: role-frontend-developer, role-backend-developer, role-data-analyst, role-fullstack-developer, role-devops-engineer.

Matching factors are bounded 0–100: target role alignment (30%), average required-skill evidence (25%), relevant gap coverage (20%), collaboration plus peer consent (15%), verified-skill proportion (10%). Score is backend deterministic. PERSON opportunities require peer recommendation consent; related student visibility requires that peer's discoverability. Recommendations are recalculated; hidden matches are never returned merely because a saved row exists.

Public enum mappings are centralized in `src/modules/integration/public-mappers.ts`:

| Database                                               | Public                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| PERSON                                                 | PEER                                                                       |
| VIEWED / INTERESTED                                    | SAVED / ACCEPTED                                                           |
| LEARNING_FOUNDATIONS                                   | FOUNDATION                                                                 |
| PENDING / ENDORSED                                     | REQUESTED / APPROVED                                                       |
| PLANNED / ACTIVE or COMPLETED / REJECTED               | SUGGESTED / APPROVED / REJECTED                                            |
| MASTERED / DEVELOPING / NEEDS_ATTENTION / NOT_ASSESSED | MASTERED / DEVELOPING / NEEDS_SUPPORT / NEEDS_SUPPORT with absent evidence |

MENTOR, INTERNSHIP, DECLINED and REJECTED are added by the new additive migration. PROFICIENT remains an accepted frontend presentation state, not a fabricated backend mastery distinction.

## Advisory AI

POST `/students/me/next-step`, `/students/me/recommendations/:id/explanation`, `/students/me/skill-gaps/:id/explanation`, `/professors/me/students/:id/recommendation-draft` use scoped backend evidence. Gemini is optional (`LLM_PROVIDER=gemini`, configured LLM_API_KEY). Provider timeout: 10 seconds. Output required text fields are runtime-validated, bounded and projected into defined DTO fields; extra AI fields never determine permissions, grades, scores, readiness or verification.

AgentRun logs SUCCEEDED with fallback:false, VALIDATION_FAILED for malformed text output with fallback:true, FAILED for unavailable provider/timeout with fallback:true. Logging errors do not break deterministic fallback. Provider diagnostics/keys are not logged. Current UI uses deterministic descriptions; optional advisory generation is available through these explicit endpoints, not automatic dashboard provider calls.

## Surveys

GET `/surveys?audience=STUDENT|PROFESSOR` requires the matching role. Configuration uses SURVEY_STUDENT_URL/SURVEY_PROFESSOR_URL. Valid HTTP(S) links without embedded credentials are returned normalized. Missing/invalid links return an inactive DTO with externalUrl:null. Unsupported schemes never reach the UI. Existing Phase 7 loading/error/empty/inactive/missing/invalid/active states remain preserved in mocks; links use noopener noreferrer.

## Migration, seed and validation

Additive migration: `20260918120000_v1_integration`. Adds safe answer options/text material content, growth course ID, consent flag, opportunity metadata/types, endorsement request context/history/idempotency, and rejection states. Old migrations are unchanged. Existing assessments require grading/options configuration; nullable fields are not silently guessed during migration.

Use `prisma migrate deploy` against a known target; do not reset a valuable database. Seed requires explicit SEED_DISPOSABLE=true and an empty database; it refuses populated targets and deletes nothing. It creates Dilnoza Karimova (student1@uniloop.local) and Azizbek Rahmonov (professor@uniloop.local), ten students, two professors, CS101, diagnostic/follow-up submissions through real deterministic grading, plans, interventions, opportunities and consent. Development-only password: password123. Never use these accounts/credentials in production.

Backend serial validation: prisma:validate, prisma:generate, typecheck, lint, `npm test -- --runInBand`, build, `git diff --check`.
Mutating isolated smoke: `SMOKE_DISPOSABLE=true node scripts/smoke-v1.mjs` with a confirmed local server/database named uniloop_phase8_smoke. Covers real JWT/login, ownership, safe reads, grading, concurrent replacement, persistence, consent, verification invalidation, role restrictions, URLs, Swagger and CORS. Do not run on shared databases.

Frontend live validation: `SMOKE_DISPOSABLE=true node scripts/validate-backend.mjs` from the sibling frontend against the same disposable server. Exercises actual feature APIs, central transport, Zod and adapters, not direct component fetches. Offline `npm run validate:data` continues validating mock workflows.

Production follow-ups: HttpOnly/BFF session storage, rate limiting and account provisioning policy, password reset migration for old hashes, token revocation/refresh, immutable attempts, signed project artifacts, scoped verification provenance, bounded pagination/query optimization, stronger multi-tenant modeling, deployment CORS configuration, and provider/browser/container runtime verification. These are not claimed as completed.
