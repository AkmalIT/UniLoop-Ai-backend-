import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";

/** Additive and idempotent data for a two-account product walkthrough. */
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

const courses = [
  {
    id: `${namespace}-course`,
    code: "DEMO26-PF",
    title: "Backend API arxitekturasi",
    subject: "Backend Development",
    description:
      "REST API, ma’lumotlar modeli va xatolarni boshqarish bo‘yicha amaliy kurs.",
    outcomes: [
      [
        "api",
        "REST API endpointlarini loyihalash",
        "Endpointlar, HTTP metodlari va validatsiyani amalda qo‘llash.",
      ],
      [
        "database",
        "Ma’lumotlar bazasi sxemasini tuzish",
        "Normalizatsiyalangan sxema va ishonchli so‘rovlarni yaratish.",
      ],
      [
        "backend",
        "Backend xatolarini boshqarish",
        "Xavfsiz xato javoblari va kuzatuv ma’lumotlarini tayyorlash.",
      ],
    ],
    diagnostic: [64, 42, 71],
    followUp: [88, 46, 84],
  },
  {
    id: `${namespace}-course-algorithms`,
    code: "DEMO26-ALG",
    title: "Algoritmlar va muammolarni yechish",
    subject: "Algorithms",
    description:
      "Murakkablikni baholash, massivlar va rekursiv yechimlar bo‘yicha laboratoriya kursi.",
    outcomes: [
      [
        "complexity",
        "Algoritm murakkabligini tahlil qilish",
        "Vaqt va xotira murakkabligini solishtirish.",
      ],
      [
        "recursion",
        "Rekursiv yechimlarni implement qilish",
        "Tayanch holat va rekursiv qadam bilan yechim yozish.",
      ],
      [
        "testing",
        "Algoritmik yechimni testlash",
        "Chegara holatlari uchun testlar ishlab chiqish.",
      ],
    ],
    diagnostic: [58, 61, 54],
    followUp: [79, 86, 76],
  },
  {
    id: `${namespace}-course-data`,
    code: "DEMO26-DATA",
    title: "Ma’lumotlar bilan ishlash va SQL",
    subject: "Database Design",
    description:
      "SQL so‘rovlari, indekslar va ma’lumotlardan xulosa chiqarish bo‘yicha loyiha-amaliyot.",
    outcomes: [
      [
        "sql",
        "SQL so‘rovlarini optimallashtirish",
        "JOIN, indeks va agregatsiyadan ongli foydalanish.",
      ],
      [
        "model",
        "Database modelini loyihalash",
        "Biznes talablarini aniq ma’lumotlar modeliga aylantirish.",
      ],
      [
        "analysis",
        "Data analysis natijalarini izohlash",
        "Natijani jamoa uchun tushunarli xulosaga aylantirish.",
      ],
    ],
    diagnostic: [69, 63, 57],
    followUp: [91, 83, 78],
  },
] as const;

function requireProvisioningPermission() {
  if (process.env.DEMO_ADDITIVE_PROVISIONING !== "true")
    throw new Error(
      "Set DEMO_ADDITIVE_PROVISIONING=true to create fictional demo records.",
    );
  if (process.env.ALLOW_MANAGED_DEMO_PROVISIONING !== "true")
    throw new Error(
      "Set ALLOW_MANAGED_DEMO_PROVISIONING=true only after confirming additive demo records are intended for this target.",
    );
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "DEMO_ACCOUNT_PASSWORD must be at least 12 characters and is never stored in source.",
    );
  return password;
}

async function ensureUser(
  input: { id: string; name: string; email: string; role: UserRole },
  passwordHash: string,
) {
  const current = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (current && (current.id !== input.id || current.role !== input.role))
    throw new Error(
      `Refusing to modify an unrelated account in the ${namespace} namespace.`,
    );
  return prisma.user.upsert({
    where: { email: input.email },
    create: { ...input, passwordHash, onboardingCompletedAt: new Date() },
    update: {
      name: input.name,
      passwordHash,
      onboardingCompletedAt: new Date(),
    },
  });
}

function masteryStatus(percentage: number) {
  return percentage >= 80
    ? ("MASTERED" as const)
    : percentage >= 50
      ? ("DEVELOPING" as const)
      : ("NEEDS_ATTENTION" as const);
}

async function seedCourse(
  course: (typeof courses)[number],
  courseIndex: number,
) {
  const courseData = {
    code: course.code,
    title: course.title,
    professorId: professor.profileId,
    description: course.description,
    shortDescription: course.description,
    fullDescription: `${course.description} Kurs AI-yordamchi tavsiyalari, laboratoriya va yakuniy portfolio dalili bilan boyitilgan.`,
    subject: course.subject,
    difficulty: courseIndex === 0 ? "INTERMEDIATE" : "BEGINNER",
    language: "uz",
    type: "SUPPLEMENTARY" as const,
    status: "PUBLISHED" as const,
    enrollmentMode: "OPEN" as const,
    estimatedDurationMinutes: 1800,
    weeklyWorkloadHours: 6,
    targetStudyYears: [2, 3, 4],
    targetPrograms: ["Software Engineering", "Computer Science"],
    prerequisites: ["Programming Fundamentals"],
    careerRelevance: "Portfolio uchun tekshiriladigan amaliy dalil yaratadi.",
    maximumEnrollment: 28,
  };
  await prisma.course.upsert({
    where: { id: course.id },
    create: { id: course.id, ...courseData },
    update: courseData,
  });
  await prisma.enrollment.upsert({
    where: {
      courseId_studentId: { courseId: course.id, studentId: student.profileId },
    },
    create: { courseId: course.id, studentId: student.profileId },
    update: {},
  });

  const outcomeIds: string[] = [];
  for (const [
    order,
    [suffix, title, description],
  ] of course.outcomes.entries()) {
    const id = `${course.id}-outcome-${suffix}`;
    outcomeIds.push(id);
    await prisma.learningOutcome.upsert({
      where: { id },
      create: {
        id,
        courseId: course.id,
        title,
        description,
        category: course.subject,
        careerRelevance: "Kasbiy portfolio va amaliy loyiha",
        sortOrder: order,
        aiSuggested: true,
        professorApprovedAt: new Date(),
      },
      update: {
        title,
        description,
        category: course.subject,
        careerRelevance: "Kasbiy portfolio va amaliy loyiha",
        sortOrder: order,
        aiSuggested: true,
        professorApprovedAt: new Date(),
      },
    });
  }
  const moduleId = `${course.id}-module`;
  await prisma.courseModule.upsert({
    where: { id: moduleId },
    create: {
      id: moduleId,
      courseId: course.id,
      title: "Nazariya, laboratoriya va portfolio",
      description:
        "AI-yordamchi tavsiyasi bilan ketma-ket amaliy mashg‘ulotlar.",
      sortOrder: 0,
      estimatedMinutes: 900,
    },
    update: {
      title: "Nazariya, laboratoriya va portfolio",
      description:
        "AI-yordamchi tavsiyasi bilan ketma-ket amaliy mashg‘ulotlar.",
      estimatedMinutes: 900,
    },
  });
  for (const [order, outcomeId] of outcomeIds.entries()) {
    await prisma.courseTopic.upsert({
      where: { id: `${moduleId}-topic-${order + 1}` },
      create: {
        id: `${moduleId}-topic-${order + 1}`,
        moduleId,
        title: course.outcomes[order][1],
        description: course.outcomes[order][2],
        sortOrder: order,
        estimatedMinutes: 180,
        outcomeIds: [outcomeId],
      },
      update: {
        title: course.outcomes[order][1],
        description: course.outcomes[order][2],
        sortOrder: order,
        estimatedMinutes: 180,
        outcomeIds: [outcomeId],
      },
    });
    await prisma.material.upsert({
      where: { id: `${course.id}-material-${order + 1}` },
      create: {
        id: `${course.id}-material-${order + 1}`,
        courseId: course.id,
        moduleId,
        outcomeId,
        title: `${course.outcomes[order][1]}: amaliy qo‘llanma`,
        description:
          "AI-yordamchi tuzgan o‘qish, mashq va tekshirish ketma-ketligi.",
        content: `1. Asosiy tushunchani o‘rganing. 2. Kichik laboratoriya ishini bajaring. 3. Natijani testlar bilan tekshiring. Mavzu: ${course.outcomes[order][1]}.`,
        contentType: "text/plain",
        published: true,
        visibility: "ENROLLED",
      },
      update: {
        moduleId,
        outcomeId,
        title: `${course.outcomes[order][1]}: amaliy qo‘llanma`,
        description:
          "AI-yordamchi tuzgan o‘qish, mashq va tekshirish ketma-ketligi.",
        content: `1. Asosiy tushunchani o‘rganing. 2. Kichik laboratoriya ishini bajaring. 3. Natijani testlar bilan tekshiring. Mavzu: ${course.outcomes[order][1]}.`,
        published: true,
        visibility: "ENROLLED",
      },
    });
  }

  const assessments = [
    [
      "diagnostic",
      course.diagnostic,
      new Date(`2026-08-${10 + courseIndex}T09:00:00.000Z`),
    ],
    [
      "follow-up",
      course.followUp,
      new Date(`2026-09-${10 + courseIndex}T14:00:00.000Z`),
    ],
  ] as const;
  for (const [assessmentKind, scores, date] of assessments) {
    const assessmentId = `${course.id}-assessment-${assessmentKind}`;
    await prisma.assessment.upsert({
      where: { id: assessmentId },
      create: {
        id: assessmentId,
        courseId: course.id,
        title:
          assessmentKind === "diagnostic"
            ? `${course.title}: boshlang‘ich diagnostika`
            : `${course.title}: qayta baholash`,
        type: assessmentKind === "diagnostic" ? "DIAGNOSTIC" : "FOLLOW_UP",
        published: true,
        startsAt: new Date("2026-08-01T08:00:00.000Z"),
        dueAt: new Date("2026-12-31T18:00:00.000Z"),
      },
      update: {
        title:
          assessmentKind === "diagnostic"
            ? `${course.title}: boshlang‘ich diagnostika`
            : `${course.title}: qayta baholash`,
        type: assessmentKind === "diagnostic" ? "DIAGNOSTIC" : "FOLLOW_UP",
        published: true,
        startsAt: new Date("2026-08-01T08:00:00.000Z"),
        dueAt: new Date("2026-12-31T18:00:00.000Z"),
      },
    });
    const questionIds: string[] = [];
    for (const [order, outcomeId] of outcomeIds.entries()) {
      const questionId = `${assessmentId}-question-${order + 1}`;
      questionIds.push(questionId);
      await prisma.question.upsert({
        where: { id: questionId },
        create: {
          id: questionId,
          assessmentId,
          prompt: `${course.outcomes[order][1]} bo‘yicha eng yaxshi amaliy yondashuvni tanlang.`,
          type: "MULTIPLE_CHOICE",
          weight: 1,
          maxScore: 100,
          sortOrder: order,
          correctAnswer: "strong",
          options: [
            {
              id: "strong",
              text: "Talabni tahlil qilib, sinovdan o‘tadigan amaliy yechim tuzish",
            },
            { id: "weak", text: "Tekshirmasdan tasodifiy yechim tanlash" },
          ],
          outcomeLinks: { create: { learningOutcomeId: outcomeId, weight: 1 } },
        },
        update: {
          prompt: `${course.outcomes[order][1]} bo‘yicha eng yaxshi amaliy yondashuvni tanlang.`,
          type: "MULTIPLE_CHOICE",
          weight: 1,
          maxScore: 100,
          sortOrder: order,
          correctAnswer: "strong",
          options: [
            {
              id: "strong",
              text: "Talabni tahlil qilib, sinovdan o‘tadigan amaliy yechim tuzish",
            },
            { id: "weak", text: "Tekshirmasdan tasodifiy yechim tanlash" },
          ],
        },
      });
    }
    const submissionId = `${assessmentId}-submission`;
    await prisma.submission.upsert({
      where: {
        assessmentId_studentId: { assessmentId, studentId: student.profileId },
      },
      create: {
        id: submissionId,
        assessmentId,
        studentId: student.profileId,
        status: "SCORED",
        submittedAt: date,
      },
      update: { status: "SCORED", submittedAt: date },
    });
    for (const [order, outcomeId] of outcomeIds.entries()) {
      await prisma.submissionAnswer.upsert({
        where: {
          submissionId_questionId: {
            submissionId,
            questionId: questionIds[order],
          },
        },
        create: {
          submissionId,
          questionId: questionIds[order],
          answer: scores[order] >= 50 ? "strong" : "weak",
          score: scores[order],
        },
        update: {
          answer: scores[order] >= 50 ? "strong" : "weak",
          score: scores[order],
        },
      });
      await prisma.masteryRecord.upsert({
        where: {
          submissionId_learningOutcomeId: {
            submissionId,
            learningOutcomeId: outcomeId,
          },
        },
        create: {
          id: `${submissionId}-mastery-${order + 1}`,
          studentId: student.profileId,
          courseId: course.id,
          assessmentId,
          submissionId,
          learningOutcomeId: outcomeId,
          percentage: scores[order],
          status: masteryStatus(scores[order]),
          calculatedAt: date,
        },
        update: {
          percentage: scores[order],
          status: masteryStatus(scores[order]),
          calculatedAt: date,
        },
      });
    }
  }
  return outcomeIds;
}

async function main() {
  const passwordHash = hashPassword(requireProvisioningPermission());
  await ensureUser(
    {
      id: professor.id,
      name: professor.name,
      email: professor.email,
      role: UserRole.PROFESSOR,
    },
    passwordHash,
  );
  await ensureUser(
    {
      id: student.id,
      name: student.name,
      email: student.email,
      role: UserRole.STUDENT,
    },
    passwordHash,
  );
  await prisma.professorProfile.upsert({
    where: { userId: professor.id },
    create: {
      id: professor.profileId,
      userId: professor.id,
      department: "Dasturiy injiniring kafedrasi",
      university: "Toshkent axborot texnologiyalari universiteti",
      title: "Katta o‘qituvchi",
      expertise: [
        "Backend Development",
        "Database Design",
        "AI-supported learning",
      ],
      bio: "Amaliy backend arxitekturasi va ma’lumotlarga asoslangan ta’lim metodlari bo‘yicha o‘qituvchi.",
    },
    update: {
      department: "Dasturiy injiniring kafedrasi",
      university: "Toshkent axborot texnologiyalari universiteti",
      title: "Katta o‘qituvchi",
      expertise: [
        "Backend Development",
        "Database Design",
        "AI-supported learning",
      ],
      bio: "Amaliy backend arxitekturasi va ma’lumotlarga asoslangan ta’lim metodlari bo‘yicha o‘qituvchi.",
    },
  });
  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    create: {
      id: student.profileId,
      userId: student.id,
      universityId: student.universityId,
      university: "Toshkent axborot texnologiyalari universiteti",
      faculty: "Dasturiy injiniring fakulteti",
      major: "Software Engineering",
      studyYear: 3,
      bio: "Backend yo‘nalishida portfolio yig‘ayotgan, jamoaviy loyihalar va ma’lumotlar bazasi bilan ishlashga qiziqadigan talaba.",
    },
    update: {
      universityId: student.universityId,
      university: "Toshkent axborot texnologiyalari universiteti",
      faculty: "Dasturiy injiniring fakulteti",
      major: "Software Engineering",
      studyYear: 3,
      bio: "Backend yo‘nalishida portfolio yig‘ayotgan, jamoaviy loyihalar va ma’lumotlar bazasi bilan ishlashga qiziqadigan talaba.",
    },
  });
  await prisma.careerProfile.upsert({
    where: { studentId: student.profileId },
    create: {
      studentId: student.profileId,
      targetRole: "Backend dasturchi",
      interests: [
        "API arxitekturasi",
        "Ma’lumotlar bazasi",
        "Cloud xizmatlari",
      ],
      coreSkills: ["Algorithms", "Python", "REST APIs", "Backend Development"],
      vacancyQueries: ["junior backend developer", "node.js backend intern"],
      availability: "Haftasiga 12 soat",
    },
    update: {
      targetRole: "Backend dasturchi",
      interests: [
        "API arxitekturasi",
        "Ma’lumotlar bazasi",
        "Cloud xizmatlari",
      ],
      coreSkills: ["Algorithms", "Python", "REST APIs", "Backend Development"],
      vacancyQueries: ["junior backend developer", "node.js backend intern"],
      availability: "Haftasiga 12 soat",
    },
  });
  await prisma.consent.upsert({
    where: { studentId: student.profileId },
    create: {
      studentId: student.profileId,
      networkingVisible: true,
      peerRecommendations: true,
      professorReferralAllowed: true,
    },
    update: {
      networkingVisible: true,
      peerRecommendations: true,
      professorReferralAllowed: true,
    },
  });

  const allOutcomeIds = (await Promise.all(courses.map(seedCourse))).flat();
  // Earlier revisions of this same isolated namespace included one 0% trace
  // result. Keep every demo percentage presentation-ready without touching
  // records outside the dedicated fictional account.
  await prisma.masteryRecord.updateMany({
    where: {
      studentId: student.profileId,
      courseId: { startsWith: namespace },
      percentage: 0,
    },
    data: { percentage: 62, status: "DEVELOPING" },
  });
  const evidence = [
    ["Algorithms", "portfolio-algorithms", 86],
    ["Python", "portfolio-python", 88],
    ["REST APIs", "portfolio-api", 91],
    ["Backend Development", "portfolio-backend", 87],
    ["SQL", "portfolio-sql", 83],
    ["Database Design", "portfolio-database", 82],
  ] as const;
  for (const [skill, sourceId, score] of evidence)
    await prisma.skillEvidence.upsert({
      where: {
        studentId_skill_sourceType_sourceId: {
          studentId: student.profileId,
          skill,
          sourceType: "PROJECT",
          sourceId: `${namespace}-${sourceId}`,
        },
      },
      create: {
        studentId: student.profileId,
        skill,
        sourceType: "PROJECT",
        sourceId: `${namespace}-${sourceId}`,
        score,
        professorVerified: true,
      },
      update: { score, professorVerified: true },
    });

  const mainOutcomeIds = allOutcomeIds.slice(0, 3);
  await prisma.learningPlan.upsert({
    where: { id: `${namespace}-learning-plan` },
    create: {
      id: `${namespace}-learning-plan`,
      studentId: student.profileId,
      courseId: courses[0].id,
      title: "AI-yordamchi tavsiya qilgan backend rivojlanish rejasi",
      rationale:
        "Qayta baholashdagi kuchli natijalarni saqlagan holda xatolarni boshqarish ko‘nikmasini 80% dan yuqoriga olib chiqish rejalashtirilgan.",
    },
    update: {
      title: "AI-yordamchi tavsiya qilgan backend rivojlanish rejasi",
      rationale:
        "Qayta baholashdagi kuchli natijalarni saqlagan holda xatolarni boshqarish ko‘nikmasini 80% dan yuqoriga olib chiqish rejalashtirilgan.",
    },
  });
  const planTasks: Array<[string, string, boolean]> = [
    [
      "API contractini tekshirish",
      "OpenAPI sxemasini validatsiya qiling va 3 ta xato holati uchun test yozing.",
      true,
    ],
    [
      "Database query review",
      "Sekin so‘rov uchun indeks tanlang va EXPLAIN natijasini yozib qo‘ying.",
      true,
    ],
    [
      "Xatolarni boshqarish mini-loyihasi",
      "Global exception filter va kuzatuv identifikatorini qo‘shing.",
      false,
    ],
  ];
  for (const [index, [title, description, complete]] of planTasks.entries()) {
    const dueDay = String(8 + index).padStart(2, "0");
    await prisma.learningTask.upsert({
      where: { id: `${namespace}-learning-task-${index + 1}` },
      create: {
        id: `${namespace}-learning-task-${index + 1}`,
        learningPlanId: `${namespace}-learning-plan`,
        learningOutcomeId: mainOutcomeIds[index],
        title,
        description,
        dueAt: new Date(`2026-10-${dueDay}T18:00:00.000Z`),
        completedAt: complete
          ? new Date(`2026-09-${15 + index}T12:00:00.000Z`)
          : null,
      },
      update: {
        learningOutcomeId: mainOutcomeIds[index],
        title,
        description,
        dueAt: new Date(`2026-10-${dueDay}T18:00:00.000Z`),
        completedAt: complete
          ? new Date(`2026-09-${15 + index}T12:00:00.000Z`)
          : null,
      },
    });
  }

  await prisma.intervention.upsert({
    where: { id: `${namespace}-intervention` },
    create: {
      id: `${namespace}-intervention`,
      courseId: courses[0].id,
      professorId: professor.profileId,
      title: "AI tavsiya qilgan error-handling code review",
      description:
        "Qayta baholash natijasiga ko‘ra xatolarni boshqarish mavzusida 25 daqiqalik amaliy code review tavsiya qilindi.",
      targetOutcomeIds: [mainOutcomeIds[1]],
      status: "PLANNED",
      plannedAt: new Date("2026-09-23T09:00:00.000Z"),
    },
    update: {
      title: "AI tavsiya qilgan error-handling code review",
      description:
        "Qayta baholash natijasiga ko‘ra xatolarni boshqarish mavzusida 25 daqiqalik amaliy code review tavsiya qilindi.",
      targetOutcomeIds: [mainOutcomeIds[1]],
      status: "PLANNED",
      plannedAt: new Date("2026-09-23T09:00:00.000Z"),
    },
  });
  for (const [index, course] of courses.entries())
    await prisma.growthGoal.upsert({
      where: { id: `${namespace}-growth-goal-${index + 1}` },
      create: {
        id: `${namespace}-growth-goal-${index + 1}`,
        professorId: professor.profileId,
        courseId: course.id,
        title: "AI tahlilini dars rejasiga kiritish",
        description: `${course.title} bo‘yicha diagnostika va qayta baholash farqidan kelib chiqib, keyingi laboratoriya ishini moslashtiring.`,
      },
      update: {
        title: "AI tahlilini dars rejasiga kiritish",
        description: `${course.title} bo‘yicha diagnostika va qayta baholash farqidan kelib chiqib, keyingi laboratoriya ishini moslashtiring.`,
      },
    });

  const opportunities: Array<
    [
      string,
      "JOB" | "INTERNSHIP" | "PROJECT" | "MENTOR",
      string,
      string,
      string[],
      boolean,
      string,
    ]
  > = [
    [
      "job",
      "JOB",
      "Junior Backend Developer",
      "Node.js, REST API va SQL bo‘yicha boshlang‘ich lavozim. Nomzodning portfolio dalillari asosida AI tomonidan moslashtirilgan demo vakansiya.",
      ["REST APIs", "Backend Development", "SQL"],
      false,
      "UniLoop AI demo job feed",
    ],
    [
      "internship",
      "INTERNSHIP",
      "Backend Engineering Internship",
      "12 haftalik mentorlik va code review bilan amaliyot dasturi.",
      ["Python", "REST APIs", "Algorithms"],
      false,
      "UniLoop AI demo job feed",
    ],
    [
      "project",
      "PROJECT",
      "Campus API monitoring mini-loyihasi",
      "Jamoa uchun API monitoring paneli va xatolarni kuzatish bo‘yicha ikki haftalik loyiha.",
      ["REST APIs", "Backend Development", "Database Design"],
      true,
      "UniLoop AI project catalog",
    ],
    [
      "mentor",
      "MENTOR",
      "Backend arxitektura mentori",
      "API contractlari va ishlab chiqarishdagi observability bo‘yicha 1:1 mentorlik uchrashuvi.",
      ["REST APIs", "Algorithms"],
      true,
      "UniLoop AI mentor network",
    ],
  ];
  for (const [
    suffix,
    type,
    title,
    description,
    requiredSkills,
    collaborative,
    source,
  ] of opportunities)
    await prisma.opportunity.upsert({
      where: { id: `${namespace}-opportunity-${suffix}` },
      create: {
        id: `${namespace}-opportunity-${suffix}`,
        type,
        title,
        description,
        requiredSkills,
        targetRoleIds: ["backend-dasturchi"],
        gapSkills: ["Cloud"],
        collaborative,
        source,
        sourceUrl: "https://demo.uniloop.test/opportunities",
      },
      update: {
        type,
        title,
        description,
        requiredSkills,
        targetRoleIds: ["backend-dasturchi"],
        gapSkills: ["Cloud"],
        collaborative,
        source,
        sourceUrl: "https://demo.uniloop.test/opportunities",
      },
    });
  const peers = [
    {
      id: `${namespace}-peer-aziza`,
      profileId: `${namespace}-peer-aziza-profile`,
      name: "Aziza Sodiqova",
      email: "aziza.sodiqova@directory.demo.uniloop.test",
      universityId: "FD-2026-PEER-01",
      title: "Aziza Sodiqova — frontend va API integratsiya hamkori",
      description:
        "React interfeyslari va REST API integratsiyasida tajriba to‘playotgan 3-kurs talabasi. Campus API monitoring mini-loyihasiga mos hamkor.",
      skills: ["REST APIs", "Frontend Development", "JavaScript"],
    },
    {
      id: `${namespace}-peer-javohir`,
      profileId: `${namespace}-peer-javohir-profile`,
      name: "Javohir Tursunov",
      email: "javohir.tursunov@directory.demo.uniloop.test",
      universityId: "FD-2026-PEER-02",
      title: "Javohir Tursunov — data va SQL hamkori",
      description:
        "SQL optimallashtirish va ma’lumotlar modeli bo‘yicha laboratoriya ishlari bilan shug‘ullanayotgan 3-kurs talabasi. Backend portfolio loyihasiga mos hamkor.",
      skills: ["SQL", "Database Design", "Algorithms"],
    },
  ] as const;
  for (const peer of peers) {
    await prisma.user.upsert({
      where: { email: peer.email },
      create: {
        id: peer.id,
        name: peer.name,
        email: peer.email,
        role: "STUDENT",
        onboardingCompletedAt: new Date(),
      },
      update: { name: peer.name, onboardingCompletedAt: new Date() },
    });
    await prisma.studentProfile.upsert({
      where: { userId: peer.id },
      create: {
        id: peer.profileId,
        userId: peer.id,
        universityId: peer.universityId,
        university: "Toshkent axborot texnologiyalari universiteti",
        faculty: "Dasturiy injiniring fakulteti",
        major: "Software Engineering",
        studyYear: 3,
      },
      update: {
        universityId: peer.universityId,
        university: "Toshkent axborot texnologiyalari universiteti",
        faculty: "Dasturiy injiniring fakulteti",
        major: "Software Engineering",
        studyYear: 3,
      },
    });
    await prisma.consent.upsert({
      where: { studentId: peer.profileId },
      create: {
        studentId: peer.profileId,
        networkingVisible: true,
        peerRecommendations: true,
        professorReferralAllowed: false,
      },
      update: { networkingVisible: true, peerRecommendations: true },
    });
    await prisma.opportunity.upsert({
      where: { id: `${namespace}-peer-opportunity-${peer.profileId}` },
      create: {
        id: `${namespace}-peer-opportunity-${peer.profileId}`,
        type: "PERSON",
        title: peer.title,
        description: peer.description,
        requiredSkills: [...peer.skills],
        targetRoleIds: ["backend-dasturchi"],
        gapSkills: ["Cloud"],
        collaborative: true,
        relatedUserId: peer.id,
        source: "UniLoop AI peer recommendations",
      },
      update: {
        title: peer.title,
        description: peer.description,
        requiredSkills: [...peer.skills],
        targetRoleIds: ["backend-dasturchi"],
        gapSkills: ["Cloud"],
        collaborative: true,
        relatedUserId: peer.id,
        source: "UniLoop AI peer recommendations",
      },
    });
  }
  const clubs: Array<[string, string, string[]]> = [
    [
      "Backend Builders Club",
      "REST API va monitoring bo‘yicha haftalik code review klubi.",
      ["REST APIs", "Backend Development"],
    ],
    [
      "Data & SQL Lab",
      "Ma’lumotlar modeli va so‘rovlarni tahlil qilish bo‘yicha ochiq laboratoriya.",
      ["SQL", "Database Design"],
    ],
    [
      "Algorithm Sprint",
      "Har hafta algoritmik masalalarni jamoa bilan yechish klubi.",
      ["Algorithms", "Python"],
    ],
  ];
  for (const [index, [title, description, skills]] of clubs.entries())
    await prisma.opportunity.upsert({
      where: { id: `${namespace}-club-${index + 1}` },
      create: {
        id: `${namespace}-club-${index + 1}`,
        type: "CLUB",
        title,
        description,
        requiredSkills: skills,
        targetRoleIds: ["backend-dasturchi"],
        collaborative: true,
        location: "TATU Innovation Lab",
        source: "UniLoop AI community catalog",
        approvalStatus: "APPROVED",
      },
      update: {
        title,
        description,
        requiredSkills: skills,
        targetRoleIds: ["backend-dasturchi"],
        collaborative: true,
        location: "TATU Innovation Lab",
        source: "UniLoop AI community catalog",
        approvalStatus: "APPROVED",
      },
    });
  await prisma.clubMembership.upsert({
    where: {
      opportunityId_studentId: {
        opportunityId: `${namespace}-club-1`,
        studentId: student.profileId,
      },
    },
    create: {
      opportunityId: `${namespace}-club-1`,
      studentId: student.profileId,
      role: "MEMBER",
    },
    update: { role: "MEMBER" },
  });

  const allEvidence = await prisma.skillEvidence.findMany({
    where: { studentId: student.profileId },
    select: { id: true },
  });
  await prisma.professorEndorsement.upsert({
    where: { pendingKey: `${namespace}-endorsement-pending` },
    create: {
      id: `${namespace}-endorsement`,
      studentId: student.profileId,
      professorId: professor.profileId,
      status: "PENDING",
      targetRole: "Backend dasturchi",
      consentToReview: true,
      pendingKey: `${namespace}-endorsement-pending`,
      comment:
        "AI tahlili portfolio dalillari kuchli ekanini ko‘rsatdi; professor yakuniy qarorini kutmoqda.",
      history: [{ status: "REQUESTED", recordedAt: new Date().toISOString() }],
      items: { create: allEvidence.map(({ id }) => ({ evidenceId: id })) },
    },
    update: {
      status: "PENDING",
      targetRole: "Backend dasturchi",
      consentToReview: true,
      comment:
        "AI tahlili portfolio dalillari kuchli ekanini ko‘rsatdi; professor yakuniy qarorini kutmoqda.",
    },
  });
  console.log(
    JSON.stringify({
      provisioned: true,
      accounts: 2,
      courses: courses.length,
      assessments: courses.length * 2,
      outcomes: allOutcomeIds.length,
      peerDirectoryProfiles: peers.length,
      opportunities: opportunities.length + peers.length + 3,
      learningPlans: 1,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Provisioning failed",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
