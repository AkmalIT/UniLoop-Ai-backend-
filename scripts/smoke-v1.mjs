import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Mutating smoke test: run ONLY against a confirmed disposable seeded database.
assert.equal(
  process.env.SMOKE_DISPOSABLE,
  "true",
  "Explicit SMOKE_DISPOSABLE=true required",
);
const base = process.env.SMOKE_API_URL ?? "http://localhost:5001/api/v1";
const target = new URL(base);
assert.ok(
  ["localhost", "127.0.0.1"].includes(target.hostname) &&
    target.protocol === "http:" &&
    target.pathname === "/api/v1",
  "Smoke requires a local v1 test server",
);
assert.equal(
  new URL(process.env.DATABASE_URL).pathname,
  "/uniloop_phase8_smoke",
  "Use the isolated uniloop_phase8_smoke database",
);
const prisma = new PrismaClient();
let temporaryUserId;
let temporaryCourseId;
let checks = 0;
async function request(path, token, method = "GET", body, status = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, status, `${method} ${path} status`);
  const payload = await response.json();
  if (status < 400) {
    assert.deepEqual(Object.keys(payload), ["data"]);
    checks++;
    return payload.data;
  }
  assert.ok(payload.error && typeof payload.error.code === "string");
  assert.ok(Array.isArray(payload.error.details));
  assert.equal(payload.data, undefined);
  checks++;
  return payload.error;
}
async function login(email) {
  return (
    await request(
      "/auth/login",
      undefined,
      "POST",
      { email, password: "password123" },
      201,
    )
  ).accessToken;
}
try {
  await request("/ai/status");
  assert.equal((await fetch(base + "/docs")).status, 200);
  const preflight = await fetch(base + "/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
  const disallowed = await fetch(base + "/ai/status", {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(disallowed.headers.get("access-control-allow-origin"), null);
  const student = await login("STUDENT1@UNILOOP.LOCAL");
  const professor = await login("professor@uniloop.local");
  const otherProfessor = await login("other-professor@uniloop.local");
  const peer = await login("student2@uniloop.local");
  const studentIdentity = await request("/auth/me", student);
  assert.equal(studentIdentity.id, "user-student-1");
  assert.equal(studentIdentity.profileId, "student-1");
  assert.equal(
    (await request("/auth/me", professor)).profileId,
    "professor-azizbek",
  );
  assert.equal(
    (
      await request(
        "/auth/login",
        undefined,
        "POST",
        { email: "student1@uniloop.local", password: "incorrect" },
        401,
      )
    ).code,
    "UNAUTHORIZED",
  );
  await request(
    "/auth/register",
    undefined,
    "POST",
    {
      name: "Attempted admin",
      email: "invalid-admin@uniloop.local",
      password: "password123",
      role: "ADMIN",
    },
    400,
  );
  await request("/students/me/dashboard", undefined, "GET", undefined, 401);
  await request("/professors/me/dashboard", student, "GET", undefined, 403);
  await request("/students/me/dashboard", professor, "GET", undefined, 403);
  await request("/students/me/dashboard", student);
  await request("/professors/me/dashboard", professor);
  const courses = await request("/students/me/courses", student);
  const courseId = courses[0].id;
  const course = await request("/students/me/courses/" + courseId, student);
  assert.equal(
    course.students.length,
    1,
    "No other students in student course DTO",
  );
  await request(
    "/professors/me/courses/" + courseId,
    otherProfessor,
    "GET",
    undefined,
    403,
  );
  await request("/professors/me/courses/" + courseId, professor);
  await request(
    "/professors/me/courses/" + courseId + "/assessments",
    professor,
  );
  const assessment = await request(
    "/students/me/assessments/assessment-follow-up",
    student,
  );
  assert.doesNotMatch(
    JSON.stringify(assessment),
    /correctAnswer|"correct"|passwordHash|gradingKey/,
  );
  const answers = assessment.questions.map((question) => ({
    questionId: question.id,
    optionId: "option-right",
  }));
  const submissionPath =
    "/students/me/assessments/" + assessment.id + "/submissions";
  await request(submissionPath, professor, "POST", { answers }, 403);
  await request(
    submissionPath,
    student,
    "POST",
    { studentId: "student-2", answers },
    400,
  );
  await request(
    submissionPath,
    student,
    "POST",
    { answers: answers.map((answer) => ({ ...answer, score: 100 })) },
    400,
  );
  await request(
    submissionPath,
    student,
    "POST",
    {
      answers: answers.map((answer, index) =>
        index ? answer : { ...answer, questionId: "foreign-question" },
      ),
    },
    400,
  );
  await request(
    submissionPath,
    student,
    "POST",
    { answers: [...answers.slice(1), answers[1]] },
    400,
  );
  const before = await request(
    "/professors/me/courses/" + courseId + "/insights",
    professor,
  );
  const result = await request(
    submissionPath,
    student,
    "POST",
    { answers },
    201,
  );
  assert.equal(result.studentId, "student-1");
  assert.equal(result.scorePercentage, 100);
  const after = await request(
    "/professors/me/courses/" + courseId + "/insights",
    professor,
  );
  assert.ok(after.cohortMasteryPercentage >= before.cohortMasteryPercentage);
  const mastery = await request("/students/me/mastery/" + courseId, student);
  assert.equal(mastery.overallPercentage, 100);
  assert.ok(
    mastery.outcomes.every((outcome) => outcome.followUpPercentage === 100),
  );
  const resubmitted = await request(
    submissionPath,
    student,
    "POST",
    {
      answers: answers.map((answer) => ({
        ...answer,
        optionId: "option-wrong",
      })),
    },
    201,
  );
  assert.equal(
    resubmitted.id,
    result.id,
    "One current submission, atomically replaced",
  );
  assert.equal(resubmitted.scorePercentage, 0);
  assert.equal(
    (await request("/students/me/mastery/" + courseId, student))
      .overallPercentage,
    0,
  );
  assert.equal(
    await prisma.submission.count({
      where: { studentId: "student-1", assessmentId: assessment.id },
    }),
    1,
  );
  const concurrent = await Promise.all([
    request(submissionPath, student, "POST", { answers }, 201),
    request(submissionPath, student, "POST", { answers }, 201),
  ]);
  assert.equal(concurrent[0].id, concurrent[1].id);
  assert.equal(
    await prisma.submissionAnswer.count({ where: { submissionId: result.id } }),
    answers.length,
  );
  assert.equal(
    await prisma.masteryRecord.count({ where: { submissionId: result.id } }),
    4,
  );
  await request("/students/me/learning-plans/" + courseId, student);
  await request(
    "/students/me/learning-plans/" + courseId,
    student,
    "POST",
    {},
    201,
  );
  const interventions = await request(
    "/professors/me/courses/" + courseId + "/interventions",
    professor,
  );
  assert.ok(interventions.length);
  const decisionPath =
    "/professors/me/courses/" +
    courseId +
    "/interventions/" +
    interventions[0].id;
  await request(
    decisionPath,
    otherProfessor,
    "PATCH",
    { status: "APPROVED" },
    403,
  );
  assert.equal(
    (await request(decisionPath, professor, "PATCH", { status: "REJECTED" }))
      .status,
    "REJECTED",
  );
  assert.equal(
    (
      await prisma.intervention.findUnique({
        where: { id: interventions[0].id },
      })
    ).status,
    "REJECTED",
  );
  assert.equal(
    (await request(decisionPath, professor, "PATCH", { status: "APPROVED" }))
      .status,
    "APPROVED",
  );
  await request("/professors/me/growth-plans", professor);
  await request("/professors/me/growth-plans", professor, "POST", {}, 201);
  const opportunities = await request(
    "/students/me/opportunity-dashboard",
    student,
  );
  assert.equal(opportunities.availableProfessors[0].id, "professor-azizbek");
  assert.deepEqual(
    new Set(
      opportunities.recommendations.map((record) => record.opportunity.type),
    ),
    new Set(["PEER", "MENTOR", "CLUB", "PROJECT", "INTERNSHIP", "JOB"]),
  );
  for (const record of opportunities.recommendations)
    assert.ok(
      Object.values(record.matching).every(
        (value) => value >= 0 && value <= 100,
      ),
    );
  const recommendationId = opportunities.recommendations[0].id;
  await request(
    "/students/me/recommendations/" + recommendationId,
    peer,
    "PATCH",
    { status: "SAVED" },
    404,
  );
  assert.equal(
    (
      await request(
        "/students/me/recommendations/" + recommendationId,
        student,
        "PATCH",
        { status: "SAVED" },
      )
    ).status,
    "SAVED",
  );
  await request(
    "/students/me/endorsement-requests",
    student,
    "POST",
    {
      professorId: "professor-other",
      targetRole: opportunities.profile.targetRole,
      consentToReview: true,
    },
    403,
  );
  const endorsementBody = {
    professorId: "professor-azizbek",
    opportunityId: "opportunity-6",
    targetRole: opportunities.profile.targetRole,
    consentToReview: true,
  };
  const endorsement = await request(
    "/students/me/endorsement-requests",
    student,
    "POST",
    endorsementBody,
    201,
  );
  const duplicate = await request(
    "/students/me/endorsement-requests",
    student,
    "POST",
    endorsementBody,
    201,
  );
  assert.equal(endorsement.id, duplicate.id);
  const candidates = await request(
    "/professors/me/referral-candidates",
    professor,
  );
  assert.ok(
    candidates.some((candidate) => candidate.request.id === endorsement.id),
  );
  assert.deepEqual(
    await request("/professors/me/referral-candidates", otherProfessor),
    [],
  );
  await request(
    "/professors/me/students/student-1/evidence",
    otherProfessor,
    "GET",
    undefined,
    403,
  );
  await request("/professors/me/students/student-1/evidence", professor);
  await request("/students/me/career-profile", student, "PATCH", {
    consent: {
      discoverable: false,
      peerRecommendations: false,
      professorEvidenceReview: false,
    },
  });
  await request(
    "/professors/me/students/student-1/evidence",
    professor,
    "GET",
    undefined,
    403,
  );
  await request(
    "/professors/me/endorsements",
    professor,
    "POST",
    { requestId: endorsement.id, status: "APPROVED" },
    403,
  );
  assert.ok(
    !(await request("/professors/me/referral-candidates", professor)).some(
      (candidate) => candidate.student.id === "student-1",
    ),
  );
  assert.ok(
    !(await request("/students/me/recommendations", student)).some(
      (record) => record.opportunity.type === "PEER",
    ),
  );
  await request("/students/me/career-profile", student, "PATCH", {
    consent: {
      discoverable: true,
      peerRecommendations: true,
      professorEvidenceReview: true,
    },
  });
  if (endorsement.status === "REQUESTED") {
    await request(
      "/professors/me/endorsements",
      otherProfessor,
      "POST",
      { requestId: endorsement.id, status: "APPROVED" },
      403,
    );
    const decisions = await Promise.all(
      [0, 1].map(() =>
        fetch(base + "/professors/me/endorsements", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + professor,
          },
          body: JSON.stringify({
            requestId: endorsement.id,
            status: "APPROVED",
            feedback: "Dalillar ko‘rib chiqildi.",
          }),
        }),
      ),
    );
    assert.deepEqual(
      decisions.map((response) => response.status).sort(),
      [201, 400],
    );
    for (const response of decisions) {
      const payload = await response.json();
      if (response.status === 201)
        assert.equal(payload.data.status, "APPROVED");
      else assert.equal(payload.error.code, "VALIDATION_ERROR");
      checks++;
    }
    const verified = await prisma.skillEvidence.count({
      where: { studentId: "student-1", professorVerified: true },
    });
    assert.ok(verified > 0);
    await request(submissionPath, student, "POST", { answers }, 201);
    assert.equal(
      (
        await prisma.professorEndorsement.findUnique({
          where: { id: endorsement.id },
        })
      ).status,
      "NEEDS_DEVELOPMENT",
    );
  }
  for (const status of ["DECLINED", "NEEDS_DEVELOPMENT"]) {
    const pending = await request(
      "/students/me/endorsement-requests",
      student,
      "POST",
      endorsementBody,
      201,
    );
    const decided = await request(
      "/professors/me/endorsements",
      professor,
      "POST",
      { requestId: pending.id, status, feedback: "Mahalliy test qarori." },
      201,
    );
    assert.equal(decided.status, status);
    const refreshed = await request(
      "/students/me/opportunity-dashboard",
      student,
    );
    assert.equal(
      refreshed.endorsementRequests.find((item) => item.id === pending.id)
        .status,
      status,
    );
  }
  const studentSurvey = await request("/surveys?audience=STUDENT", student);
  assert.equal(studentSurvey[0].active, true);
  const professorSurvey = await request(
    "/surveys?audience=PROFESSOR",
    professor,
  );
  assert.equal(professorSurvey[0].active, false);
  assert.equal(professorSurvey[0].externalUrl, null);
  await request("/surveys?audience=PROFESSOR", student, "GET", undefined, 403);
  await request("/surveys?audience=ADMIN", student, "GET", undefined, 400);
  await request("/surveys?audience=STUDENT", undefined, "GET", undefined, 401);
  await request("/courses/" + courseId, student, "GET", undefined, 404); // unsafe legacy controllers no longer registered
  const email = "phase8-" + randomUUID() + "@uniloop.local";
  const registered = await request(
    "/auth/register",
    undefined,
    "POST",
    {
      name: "Temporary smoke student",
      email: email.toUpperCase(),
      password: "password123",
      role: "STUDENT",
    },
    201,
  );
  temporaryUserId = registered.user.id;
  await request(
    "/auth/register",
    undefined,
    "POST",
    { name: "Duplicate", email, password: "password123", role: "STUDENT" },
    409,
  );
  await request(
    "/students/me/courses/" + courseId,
    registered.accessToken,
    "GET",
    undefined,
    403,
  );
  await request(
    "/students/me/assessments/" + assessment.id,
    registered.accessToken,
    "GET",
    undefined,
    403,
  );
  const emptyMastery = await prisma.course.create({
    data: {
      title: "Temporary unassessed course",
      code: "TMP-" + randomUUID(),
      professorId: "professor-azizbek",
    },
  });
  temporaryCourseId = emptyMastery.id;
  await prisma.learningOutcome.create({
    data: { courseId: emptyMastery.id, title: "Unassessed outcome" },
  });
  await prisma.enrollment.create({
    data: { courseId: emptyMastery.id, studentId: registered.user.profileId },
  });
  const unassessed = await request(
    "/students/me/mastery/" + emptyMastery.id,
    registered.accessToken,
  );
  assert.equal(unassessed.outcomes[0].diagnosticPercentage, null);
  assert.equal(unassessed.outcomes[0].followUpPercentage, null);
  assert.deepEqual(unassessed.outcomes[0].evidence, []);
  await prisma.user.delete({ where: { id: temporaryUserId } });
  temporaryUserId = undefined;
  await request("/auth/me", registered.accessToken, "GET", undefined, 401);
  console.log(
    `PASS: ${checks} real HTTP checks plus Swagger, allowlisted/blocked CORS, database persistence, concurrent replacement, live consent withdrawal, verification invalidation and deleted-user JWT rejection.`,
  );
} finally {
  if (temporaryCourseId)
    await prisma.course.delete({ where: { id: temporaryCourseId } });
  if (temporaryUserId)
    await prisma.user.delete({ where: { id: temporaryUserId } });
  await prisma.$disconnect();
}
