import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";
import { AcademicService } from "../src/modules/integration/academic.service";
import { CareerApiService } from "../src/modules/integration/career-api.service";
import { CoursesService } from "../src/modules/courses/courses.service";
import { MasteryService } from "../src/modules/mastery/mastery.service";
import { CareerReadinessService } from "../src/modules/career/career-readiness.service";

const prisma = new PrismaClient();
async function main() {
  if (process.env.SEED_DISPOSABLE !== "true")
    throw new Error(
      "Seed requires explicit SEED_DISPOSABLE=true for a disposable database",
    );
  // Refuse populated targets. Never delete user data or silently reseed.
  if (
    (await prisma.user.count()) ||
    (await prisma.course.count()) ||
    (await prisma.opportunity.count())
  )
    throw new Error("Seed requires an empty database");
  const passwordHash = hashPassword("password123"); // Development-only accounts; never use in production.
  const professor = await prisma.user.create({
    data: {
      id: "user-azizbek",
      name: "Azizbek Rahmonov",
      email: "professor@uniloop.local",
      role: "PROFESSOR",
      passwordHash,
      professorProfile: {
        create: {
          id: "professor-azizbek",
          department: "Axborot texnologiyalari kafedrasi",
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      id: "user-other-professor",
      name: "Boshqa professor",
      email: "other-professor@uniloop.local",
      role: "PROFESSOR",
      passwordHash,
      professorProfile: { create: { id: "professor-other" } },
    },
  });
  const course = await prisma.course.create({
    data: {
      id: "course-programming",
      title: "Programming Fundamentals",
      code: "CS101",
      description:
        "Dasturlash asoslari: rekursiya, tayanch holat va chaqiruv steki.",
      professorId: "professor-azizbek",
    },
  });
  const outcomes = [
    [
      "outcome-recursion",
      "Rekursiv funksiyalar (recursive functions)",
      "Funksiyaning o‘zini chaqirishini tushuntiring.",
    ],
    [
      "outcome-base-case",
      "Tayanch holat (base case)",
      "Rekursiyaning to‘xtash shartini aniqlang.",
    ],
    [
      "outcome-call-stack",
      "Chaqiruv steki (trace recursive call stack)",
      "Chaqiruvlar tartibini kuzating.",
    ],
    [
      "outcome-implementation",
      "Rekursiv yechim (implement recursive solutions)",
      "Rekursiv yechimni amaliyotda qo‘llang.",
    ],
  ];
  for (const [sortOrder, [id, title, description]] of outcomes.entries())
    await prisma.learningOutcome.create({
      data: { id, title, description, courseId: course.id, sortOrder },
    });
  await prisma.material.create({
    data: {
      id: "material-recursion",
      courseId: course.id,
      title: "Rekursiya bo‘yicha qo‘llanma",
      content:
        "Rekursiv funksiya o‘zini chaqiradi. Tayanch holat rekursiyani to‘xtatadi. factorial(0) = 1.",
      contentType: "text/plain",
    },
  });
  const specs = [
    [
      "Rekursiv funksiya nima qiladi?",
      "O‘zini chaqiradi",
      "Faqat o‘zgaruvchilarni o‘chiradi",
    ],
    [
      "Tayanch holatning vazifasi nima?",
      "Rekursiyani to‘xtatish",
      "Chaqiruvlar sonini cheksiz oshirish",
    ],
    ["factorial(3) natijasi nechaga teng?", "6", "3"],
    ["factorial(0) qiymati nechaga teng?", "1", "0"],
  ];
  for (const type of ["DIAGNOSTIC", "FOLLOW_UP"] as const) {
    const id =
      type === "DIAGNOSTIC" ? "assessment-diagnostic" : "assessment-follow-up";
    await prisma.assessment.create({
      data: {
        id,
        courseId: course.id,
        title:
          type === "DIAGNOSTIC"
            ? "Rekursiya diagnostikasi"
            : "Rekursiyani qayta tekshirish",
        type,
      },
    });
    for (const [index, [prompt, right, wrong]] of specs.entries())
      await prisma.question.create({
        data: {
          id: id + "-q-" + (index + 1),
          assessmentId: id,
          prompt,
          type: "MULTIPLE_CHOICE",
          weight: 25,
          maxScore: 1,
          sortOrder: index,
          options: [
            { id: "option-right", text: right },
            { id: "option-wrong", text: wrong },
          ],
          correctAnswer: "option-right",
          outcomeLinks: {
            create: { learningOutcomeId: outcomes[index][0], weight: 1 },
          },
        },
      });
  }
  const academic = new AcademicService(
    prisma as never,
    new MasteryService(prisma as never, new CoursesService(prisma as never)),
  );
  const patterns = [
    [1, 0, 0, 1],
    [1, 1, 0, 1],
    [1, 0, 1, 1],
    [0, 0, 0, 1],
    [1, 1, 1, 1],
    [0, 1, 0, 0],
    [1, 0, 1, 0],
    [0, 0, 0, 0],
    [1, 1, 0, 1],
    [0, 0, 1, 0],
  ];
  for (let index = 0; index < patterns.length; index++) {
    const id = "user-student-" + (index + 1),
      profileId = "student-" + (index + 1);
    const user = await prisma.user.create({
      data: {
        id,
        name: index === 0 ? "Dilnoza Karimova" : "Talaba " + (index + 1),
        email: "student" + (index + 1) + "@uniloop.local",
        role: UserRole.STUDENT,
        passwordHash,
        studentProfile: {
          create: { id: profileId, universityId: "UNI-" + (index + 1) },
        },
      },
    });
    await prisma.enrollment.create({
      data: { courseId: course.id, studentId: profileId },
    });
    await prisma.careerProfile.create({
      data: {
        studentId: profileId,
        targetRole: "BACKEND_DEVELOPER",
        interests: ["Dasturlash", "Algoritmlar"],
      },
    });
    await prisma.consent.create({
      data: {
        studentId: profileId,
        networkingVisible: index < 3,
        peerRecommendations: index < 3,
        professorReferralAllowed: index < 3,
      },
    });
    await academic.submit(user, "assessment-diagnostic", {
      answers: patterns[index].map((value, question) => ({
        questionId: "assessment-diagnostic-q-" + (question + 1),
        optionId: value ? "option-right" : "option-wrong",
      })),
    });
    if (index < 2)
      await academic.submit(user, "assessment-follow-up", {
        answers: specs.map((_, question) => ({
          questionId: "assessment-follow-up-q-" + (question + 1),
          optionId:
            question === 2 && index === 0 ? "option-wrong" : "option-right",
        })),
      });
    if (index === 0) await academic.learningPlan(user, course.id, true);
  }
  await academic.interventions(professor, course.id, true);
  await academic.growthPlan(professor, true);
  const types = [
    "PERSON",
    "MENTOR",
    "CLUB",
    "PROJECT",
    "INTERNSHIP",
    "JOB",
  ] as const;
  const titles = [
    "Algoritmlar bo‘yicha hamkor",
    "Dasturlash mentori",
    "Dasturlash klubi",
    "REST API amaliy loyihasi",
    "Backend amaliyoti",
    "Junior backend dasturchi",
  ];
  for (const [index, type] of types.entries())
    await prisma.opportunity.create({
      data: {
        id: "opportunity-" + (index + 1),
        type,
        title: titles[index],
        description:
          "Dasturlash dalillarini amaliy tajriba bilan rivojlantiring.",
        requiredSkills: index < 3 ? ["Algorithms"] : ["Python", "REST APIs"],
        targetRoleIds: ["role-backend-developer"],
        gapSkills: ["REST APIs"],
        collaborative: index < 4,
        relatedUserId: index === 0 ? "user-student-2" : null,
      },
    });
  const career = new CareerApiService(
    prisma as never,
    academic,
    new CareerReadinessService(),
  );
  const student = await prisma.user.findUniqueOrThrow({
    where: { id: "user-student-1" },
  });
  await career.request(student, {
    professorId: "professor-azizbek",
    targetRole: "Backend dasturchi",
    consentToReview: true,
  });
  console.log(
    "Disposable demo seeded: ten students, two professors, diagnostic/follow-up evidence, plans, interventions, six opportunity types and a consented request.",
  );
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
