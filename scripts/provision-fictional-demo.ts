import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";

const prisma = new PrismaClient();
const namespace = "fictional-demo-2026";
const student = {
  id: `${namespace}-student`,
  profileId: `${namespace}-student-profile`,
  name: "Firdavs Qodirov",
  email: "firdavs.qodirov@demo.uniloop.test",
  universityId: "FD-2026-001",
};
const professor = {
  id: `${namespace}-professor`,
  profileId: `${namespace}-professor-profile`,
  name: "Kamola Oripova",
  email: "kamola.oripova@demo.uniloop.test",
};
const course = {
  id: `${namespace}-course`,
  code: "DEMO26-PF",
  title: "Dasturlash asoslari",
};

function requireProvisioningPermission() {
  if (process.env.DEMO_ADDITIVE_PROVISIONING !== "true")
    throw new Error("Set DEMO_ADDITIVE_PROVISIONING=true to create fictional demo records.");
  if (process.env.ALLOW_MANAGED_DEMO_PROVISIONING !== "true")
    throw new Error("Set ALLOW_MANAGED_DEMO_PROVISIONING=true only after confirming additive demo records are intended for this target.");
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("DEMO_ACCOUNT_PASSWORD must be at least 12 characters and is never stored in source.");
  return password;
}

async function ensureUser(input: { id: string; name: string; email: string; role: UserRole }, passwordHash: string) {
  const current = await prisma.user.findUnique({ where: { email: input.email } });
  if (current && (current.id !== input.id || current.name !== input.name || current.role !== input.role))
    throw new Error(`Refusing to modify an unrelated account in the ${namespace} namespace.`);
  if (!current)
    return prisma.user.create({ data: { ...input, passwordHash } });
  return prisma.user.update({ where: { id: current.id }, data: { passwordHash } });
}

async function main() {
  const passwordHash = hashPassword(requireProvisioningPermission());
  let careerAvailable = false;
  // Account creation is deliberately completed before the related-data transaction.
  // A retry recognizes only this dedicated namespace and never duplicates it.
  await ensureUser({ id: professor.id, name: professor.name, email: professor.email, role: UserRole.PROFESSOR }, passwordHash);
  await ensureUser({ id: student.id, name: student.name, email: student.email, role: UserRole.STUDENT }, passwordHash);
  await prisma.$transaction(async (tx) => {
    await tx.professorProfile.upsert({ where: { userId: professor.id }, create: { id: professor.profileId, userId: professor.id, department: "Dasturiy injiniring kafedrasi" }, update: { department: "Dasturiy injiniring kafedrasi" } });
    await tx.studentProfile.upsert({ where: { userId: student.id }, create: { id: student.profileId, userId: student.id, universityId: student.universityId }, update: { universityId: student.universityId } });

    const existingCourse = await tx.course.findUnique({ where: { code: course.code } });
    if (existingCourse && existingCourse.id !== course.id)
      throw new Error("Refusing to modify a course outside the fictional demo namespace.");
    await tx.course.upsert({ where: { id: course.id }, create: { ...course, description: "Yakuniy nazoratga ikki hafta qolganda rekursiya, massivlar va funksiyalarni mustahkamlash kursi.", professorId: professor.profileId }, update: { title: course.title, description: "Yakuniy nazoratga ikki hafta qolganda rekursiya, massivlar va funksiyalarni mustahkamlash kursi." } });
    await tx.enrollment.upsert({ where: { courseId_studentId: { courseId: course.id, studentId: student.profileId } }, create: { courseId: course.id, studentId: student.profileId }, update: {} });

    const outcomes = [
      ["recursion", "Rekursiyaning tayanch holatini tushuntirish", "Tayanch holatning vazifasini misollar bilan izohlash."],
      ["trace", "Rekursiv chaqiruvlarni kuzatish", "Chaqiruvlar ketma-ketligi va qaytish qiymatini aniqlash."],
      ["implementation", "Rekursiv yechim yozish", "Oddiy masala uchun to‘g‘ri rekursiv funksiya tuzish."],
    ] as const;
    for (const [suffix, title, description] of outcomes)
      await tx.learningOutcome.upsert({ where: { courseId_title: { courseId: course.id, title } }, create: { id: `${namespace}-outcome-${suffix}`, courseId: course.id, title, description, sortOrder: outcomes.findIndex((item) => item[0] === suffix) }, update: { description } });

    await tx.material.upsert({ where: { id: `${namespace}-material-revision` }, create: { id: `${namespace}-material-revision`, courseId: course.id, title: "Yakuniy nazorat oldi: rekursiya chek-listi", content: "1. Tayanch holatni yozing. 2. Kichik masalaga kamayishni tekshiring. 3. Chaqiruvlar qaytishini kuzating. 4. Cheksiz rekursiyani sinang.", contentType: "text/plain" }, update: { content: "1. Tayanch holatni yozing. 2. Kichik masalaga kamayishni tekshiring. 3. Chaqiruvlar qaytishini kuzating. 4. Cheksiz rekursiyani sinang." } });

    const assessmentId = `${namespace}-assessment-follow-up`;
    await tx.assessment.upsert({ where: { id: assessmentId }, create: { id: assessmentId, courseId: course.id, title: "Rekursiya bo‘yicha yakuniy tayyorgarlik", type: "FOLLOW_UP", startsAt: new Date("2026-09-18T09:00:00.000Z"), dueAt: new Date("2026-10-02T18:00:00.000Z") }, update: {} });
    const questions = [
      ["base", "Tayanch holatning asosiy vazifasi nima?", "To‘xtash shartini belgilash", "Chaqiruvlar sonini oshirish", `${namespace}-outcome-recursion`],
      ["trace", "factorial(3) natijasi nechaga teng?", "6", "3", `${namespace}-outcome-trace`],
      ["code", "Rekursiv funksiya har chaqiruvda nimani ta’minlashi kerak?", "Kichikroq masalaga o‘tishni", "Bir xil masalani takrorlashni", `${namespace}-outcome-implementation`],
    ] as const;
    for (const [suffix, prompt, correct, incorrect, outcomeId] of questions) {
      const id = `${namespace}-question-${suffix}`;
      await tx.question.upsert({ where: { id }, create: { id, assessmentId, prompt, type: "MULTIPLE_CHOICE", weight: 1, maxScore: 1, correctAnswer: "correct", options: [{ id: "correct", text: correct }, { id: "incorrect", text: incorrect }], sortOrder: questions.findIndex((question) => question[0] === suffix), outcomeLinks: { create: { learningOutcomeId: outcomeId, weight: 1 } } }, update: {} });
    }

    const submissionId = `${namespace}-submission`;
    await tx.submission.upsert({ where: { assessmentId_studentId: { assessmentId, studentId: student.profileId } }, create: { id: submissionId, assessmentId, studentId: student.profileId, status: "SCORED", answers: { create: questions.map(([suffix], index) => ({ questionId: `${namespace}-question-${suffix}`, answer: "correct", score: index === 1 ? 0 : 1 })) } }, update: {} });
    for (const [suffix, title] of outcomes) {
      const percentage = suffix === "trace" ? 0 : 100;
      await tx.masteryRecord.upsert({ where: { submissionId_learningOutcomeId: { submissionId, learningOutcomeId: `${namespace}-outcome-${suffix}` } }, create: { id: `${namespace}-mastery-${suffix}`, studentId: student.profileId, courseId: course.id, assessmentId, submissionId, learningOutcomeId: `${namespace}-outcome-${suffix}`, percentage, status: percentage >= 80 ? "MASTERED" : "DEVELOPING" }, update: { percentage, status: percentage >= 80 ? "MASTERED" : "DEVELOPING" } });
    }
    await tx.learningPlan.upsert({ where: { id: `${namespace}-learning-plan` }, create: { id: `${namespace}-learning-plan`, studentId: student.profileId, courseId: course.id, title: "Rekursiya bo‘yicha qisqa rivojlanish rejasi", rationale: "Chaqiruvlar ketma-ketligini mustahkamlash kerak." }, update: {} });
    await tx.learningTask.upsert({ where: { id: `${namespace}-learning-task` }, create: { id: `${namespace}-learning-task`, learningPlanId: `${namespace}-learning-plan`, learningOutcomeId: `${namespace}-outcome-trace`, title: "Chaqiruvlar daraxtini chizing", description: "factorial(4) uchun chaqiruvlar va qaytish qiymatlarini yozing.", dueAt: new Date("2026-09-25T18:00:00.000Z") }, update: {} });

    const capabilities = await tx.$queryRaw<{ available: boolean }[]>`SELECT to_regtype('public."TargetRole"') IS NOT NULL AS available`;
    careerAvailable = capabilities[0]?.available === true;
    if (careerAvailable) {
      await tx.careerProfile.upsert({ where: { studentId: student.profileId }, create: { studentId: student.profileId, targetRole: "BACKEND_DEVELOPER", interests: ["API yaratish", "Ma’lumotlar bazasi", "Algoritmlar"], availability: "Haftasiga 8 soat" }, update: { interests: ["API yaratish", "Ma’lumotlar bazasi", "Algoritmlar"] } });
      await tx.consent.upsert({ where: { studentId: student.profileId }, create: { studentId: student.profileId, networkingVisible: true, peerRecommendations: true, professorReferralAllowed: true }, update: {} });
      await tx.skillEvidence.upsert({ where: { studentId_skill_sourceType_sourceId: { studentId: student.profileId, skill: "Recursion", sourceType: "ASSESSMENT_MASTERY", sourceId: assessmentId } }, create: { studentId: student.profileId, skill: "Recursion", sourceType: "ASSESSMENT_MASTERY", sourceId: assessmentId, score: 100, professorVerified: false }, update: { score: 100 } });
      await tx.opportunity.upsert({ where: { id: `${namespace}-opportunity` }, create: { id: `${namespace}-opportunity`, type: "PROJECT", title: "Kichik REST API amaliy loyihasi", description: "Ikki haftalik yakuniy tayyorgarlik uchun sintetik loyiha taklifi.", requiredSkills: ["Recursion", "REST APIs"], targetRoleIds: ["role-backend-developer"], gapSkills: ["REST APIs"], collaborative: true }, update: {} });
      await tx.matchRecommendation.upsert({ where: { studentId_opportunityId: { studentId: student.profileId, opportunityId: `${namespace}-opportunity` } }, create: { studentId: student.profileId, opportunityId: `${namespace}-opportunity`, matchScore: 72, matchedSkills: ["Recursion"], missingSkills: ["REST APIs"], explanationUz: "Mavjud rekursiya dalili backend maqsadiga mos; REST API amaliyoti keyingi qadam.", nextActionUz: "Loyihani saqlab, endpointlar rejasini yozing." }, update: {} });
    }
    const existingIntervention = await tx.intervention.findUnique({ where: { id: `${namespace}-intervention` } });
    if (!existingIntervention) await tx.intervention.create({ data: { id: `${namespace}-intervention`, courseId: course.id, professorId: professor.profileId, title: "Chaqiruvlar daraxti bo‘yicha mini-amaliyot", description: "Kuzatish natijasini kuchaytirish uchun 20 daqiqalik ishchi misol.", targetOutcomeIds: [`${namespace}-outcome-trace`], status: "ACTIVE", plannedAt: new Date("2026-09-22T09:00:00.000Z") } });
  }, { timeout: 30_000 });
  console.log(JSON.stringify({ provisioned: true, accounts: 2, courses: 1, assessments: 1, materials: 1, learningPlans: 1, careerAvailable }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Provisioning failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
