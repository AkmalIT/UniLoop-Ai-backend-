import { PrismaClient, UserRole, type User } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";

const prisma = new PrismaClient();
const namespace = "fictional-cohort-2026";

type StudentSeed = {
  name: string;
  email: string;
  universityId: string;
  major: string;
  courseIndex: number;
  legacyNumber?: number;
};

type ProfessorSeed = {
  name: string;
  email: string;
  department: string;
};

type CourseSeed = {
  code: string;
  title: string;
  description: string;
  professorIndex: number;
  outcomes: [string, string, string][];
};

const professors: ProfessorSeed[] = [
  {
    name: "Otabek Inomov",
    email: "otabek.inomov@demo.uniloop.test",
    department: "Dasturiy injiniring kafedrasi",
  },
  {
    name: "Zarnigor Murodova",
    email: "zarnigor.murodova@demo.uniloop.test",
    department: "Kompyuter injiniringi kafedrasi",
  },
  {
    name: "Jasur Usmonov",
    email: "jasur.usmonov@demo.uniloop.test",
    department: "Sun'iy intellekt va ma'lumotlar tahlili",
  },
  {
    name: "Shahnoza Tohirova",
    email: "shahnoza.tohirova@demo.uniloop.test",
    department: "Axborot xavfsizligi kafedrasi",
  },
  {
    name: "Ulugbek Sobirov",
    email: "ulugbek.sobirov@demo.uniloop.test",
    department: "Dasturlash texnologiyalari kafedrasi",
  },
  {
    name: "Dilbar Sattorova",
    email: "dilbar.sattorova@demo.uniloop.test",
    department: "Ma'lumotlar bazalari kafedrasi",
  },
  {
    name: "Akmal Jurayev",
    email: "akmal.jurayev@demo.uniloop.test",
    department: "Tizimli dasturlash kafedrasi",
  },
  {
    name: "Nigora Qobilova",
    email: "nigora.qobilova@demo.uniloop.test",
    department: "Raqamli mahsulotlar kafedrasi",
  },
  {
    name: "Bahodir Ruzimuhammedov",
    email: "bahodir.ruzimuhammedov@demo.uniloop.test",
    department: "Bulutli texnologiyalar kafedrasi",
  },
  {
    name: "Mohinur Tursunova",
    email: "mohinur.tursunova@demo.uniloop.test",
    department: "Web injiniring kafedrasi",
  },
];

const studentRows: [string, string, string, number, number?][] = [
  [
    "Dilshod Akbarov",
    "dilshod.akbarov@demo.uniloop.test",
    "Kompyuter injiniringi",
    0,
    1,
  ],
  [
    "Madina Raximova",
    "madina.raximova@demo.uniloop.test",
    "Dasturiy injiniring",
    1,
    2,
  ],
  [
    "Javohir Islomov",
    "javohir.islomov@demo.uniloop.test",
    "Axborot xavfsizligi",
    2,
    3,
  ],
  [
    "Nilufar Tojiboyeva",
    "nilufar.tojiboyeva@demo.uniloop.test",
    "Ma'lumotlar tahlili",
    3,
    4,
  ],
  [
    "Bekzod Rasulov",
    "bekzod.rasulov@demo.uniloop.test",
    "Dasturiy injiniring",
    4,
    5,
  ],
  [
    "Laylo Sodiqova",
    "laylo.sodiqova@demo.uniloop.test",
    "Kompyuter injiniringi",
    5,
    6,
  ],
  [
    "Sardor Karimov",
    "sardor.karimov@demo.uniloop.test",
    "Web texnologiyalar",
    6,
    7,
  ],
  [
    "Mohira Abdullayeva",
    "mohira.abdullayeva@demo.uniloop.test",
    "Sun'iy intellekt",
    7,
    8,
  ],
  [
    "Farrux Qosimov",
    "farrux.qosimov@demo.uniloop.test",
    "Axborot xavfsizligi",
    8,
    9,
  ],
  [
    "Zilola Mahmudova",
    "zilola.mahmudova@demo.uniloop.test",
    "Dasturiy injiniring",
    9,
    10,
  ],
  ["Shahzod Karimov", "shahzod@gmail.com", "Dasturiy injiniring", 0],
  [
    "Iroda Yusupova",
    "iroda.yusupova@demo.uniloop.test",
    "Ma'lumotlar tahlili",
    1,
  ],
  [
    "Azizbek Tursunov",
    "azizbek.tursunov@demo.uniloop.test",
    "Kompyuter injiniringi",
    2,
  ],
  [
    "Gulnoza Ergasheva",
    "gulnoza.ergasheva@demo.uniloop.test",
    "Web texnologiyalar",
    3,
  ],
  [
    "Murodjon Aliyev",
    "murodjon.aliyev@demo.uniloop.test",
    "Tizimli dasturlash",
    4,
  ],
  [
    "Sevara Xolmatova",
    "sevara.xolmatova@demo.uniloop.test",
    "Sun'iy intellekt",
    5,
  ],
  [
    "Shoxrux Mirzayev",
    "shoxrux.mirzayev@demo.uniloop.test",
    "Axborot xavfsizligi",
    6,
  ],
  [
    "Diyora Qodirova",
    "diyora.qodirova@demo.uniloop.test",
    "Dasturiy injiniring",
    7,
  ],
  [
    "Kamron Umarov",
    "kamron.umarov@demo.uniloop.test",
    "Kompyuter injiniringi",
    8,
  ],
  [
    "Nargiza Mamatqulova",
    "nargiza.mamatqulova@demo.uniloop.test",
    "Ma'lumotlar tahlili",
    9,
  ],
  [
    "Abdulloh Norqulov",
    "abdulloh.norqulov@demo.uniloop.test",
    "Backend injiniring",
    0,
  ],
  [
    "Malika Gafurova",
    "malika.gafurova@demo.uniloop.test",
    "Frontend injiniring",
    1,
  ],
  ["Rustam Saidov", "rustam.saidov@demo.uniloop.test", "DevOps injiniring", 2],
  [
    "Zarnigor Boboyeva",
    "zarnigor.boboyeva@demo.uniloop.test",
    "Raqamli mahsulot",
    3,
  ],
  [
    "Temur Shermatov",
    "temur.shermatov@demo.uniloop.test",
    "Dasturiy injiniring",
    4,
  ],
  [
    "Umida Nematova",
    "umida.nematova@demo.uniloop.test",
    "Axborot tizimlari",
    5,
  ],
  [
    "Otabek Xudoyberdiyev",
    "otabek.xudoyberdiyev@demo.uniloop.test",
    "Kompyuter injiniringi",
    6,
  ],
  [
    "Maftuna Yoqubova",
    "maftuna.yoqubova@demo.uniloop.test",
    "Ma'lumotlar tahlili",
    7,
  ],
  [
    "Doston Hamroyev",
    "doston.hamroyev@demo.uniloop.test",
    "Backend injiniring",
    8,
  ],
  [
    "Shahnoza Davronova",
    "shahnoza.davronova@demo.uniloop.test",
    "Frontend injiniring",
    9,
  ],
];

const students: StudentSeed[] = studentRows.map(
  ([name, email, major, courseIndex, legacyNumber], index) => ({
    name,
    email,
    major,
    courseIndex,
    legacyNumber,
    universityId: `UL-26-${String(index + 1).padStart(3, "0")}`,
  }),
);

const courses: CourseSeed[] = [
  {
    code: "U26-ALG",
    title: "Algoritmlar va ma'lumotlar tuzilmalari",
    description:
      "Yakuniy imtihonga ikki hafta qolganda rekursiya, graf va dinamik dasturlashni mustahkamlash.",
    professorIndex: 0,
    outcomes: [
      [
        "recursion",
        "Rekursiv algoritmlarni tahlil qilish",
        "Tayanch holat, kamayish va murakkablikni tushuntirish.",
      ],
      [
        "graphs",
        "Graf traversal strategiyalarini qo'llash",
        "BFS va DFS ni mos masalalarda ishlatish.",
      ],
      [
        "dp",
        "Dinamik dasturlash holatlarini qurish",
        "Holat va o'tish formulasini asoslash.",
      ],
    ],
  },
  {
    code: "U26-WEB",
    title: "Frontend tizimlari",
    description:
      "React holat boshqaruvi, shakllar va accessibility bo'yicha final oldi sprinti.",
    professorIndex: 9,
    outcomes: [
      [
        "state",
        "UI holatini ishonchli boshqarish",
        "Server va client holatini ajratish.",
      ],
      [
        "forms",
        "Shakllarni validatsiya qilish",
        "Foydalanuvchi xatolarini aniq ko'rsatish.",
      ],
      [
        "a11y",
        "Accessibility talablarini bajarish",
        "Keyboard va screen reader oqimini tekshirish.",
      ],
    ],
  },
  {
    code: "U26-DB",
    title: "Ma'lumotlar bazasi loyihalash",
    description:
      "Normalizatsiya, indekslar va tranzaksiyalar bo'yicha amaliy tayyorgarlik.",
    professorIndex: 5,
    outcomes: [
      [
        "schema",
        "Relatsion sxema loyihalash",
        "Bog'lanish va cheklovlarni asoslash.",
      ],
      [
        "query",
        "SQL so'rovlarini optimallashtirish",
        "Indekslar va query planlardan foydalanish.",
      ],
      [
        "tx",
        "Tranzaksiya izolyatsiyasini tushuntirish",
        "Race condition holatlarini aniqlash.",
      ],
    ],
  },
  {
    code: "U26-SE",
    title: "Dasturiy injiniring amaliyoti",
    description:
      "Talablar, testlar va code review bo'yicha loyiha yakunlash haftalari.",
    professorIndex: 4,
    outcomes: [
      [
        "requirements",
        "Talablarni aniqlashtirish",
        "User story va acceptance criteria yozish.",
      ],
      [
        "testing",
        "Test strategiyasini tanlash",
        "Unit, integration va smoke test farqini qo'llash.",
      ],
      [
        "review",
        "Code review xulosasini asoslash",
        "Riskli o'zgarishlarni topish.",
      ],
    ],
  },
  {
    code: "U26-SEC",
    title: "Web xavfsizligi",
    description:
      "Auth, input validation va OWASP risklari bo'yicha final oldi laboratoriya ishlari.",
    professorIndex: 3,
    outcomes: [
      [
        "auth",
        "Autentifikatsiya oqimini himoyalash",
        "Token va sessiya risklarini kamaytirish.",
      ],
      [
        "validation",
        "Kiritmalarni validatsiya qilish",
        "Server tomoni tekshiruvlarini yozish.",
      ],
      [
        "owasp",
        "OWASP zaifliklarini tanish",
        "XSS va SQL injection himoyalarini tushuntirish.",
      ],
    ],
  },
  {
    code: "U26-API",
    title: "Backend API injiniring",
    description:
      "NestJS, REST kontraktlari va service qatlamlari bo'yicha yakuniy loyiha tayyorgarligi.",
    professorIndex: 1,
    outcomes: [
      [
        "contracts",
        "API kontraktlarini loyihalash",
        "DTO, status code va error formatni belgilash.",
      ],
      [
        "services",
        "Service qatlamida biznes qoidalarni saqlash",
        "Controller va service mas'uliyatini ajratish.",
      ],
      [
        "observability",
        "API kuzatuvchanligini yaxshilash",
        "Log va health checklardan foydalanish.",
      ],
    ],
  },
  {
    code: "U26-AI",
    title: "Amaliy sun'iy intellekt",
    description:
      "Model baholash, prompt dizayn va mas'uliyatli AI bo'yicha finalga tayyorgarlik.",
    professorIndex: 2,
    outcomes: [
      [
        "evaluation",
        "Model natijalarini baholash",
        "Precision, recall va xatolik namunalarini sharhlash.",
      ],
      [
        "prompting",
        "Promptlarni iterativ yaxshilash",
        "Kontekst, cheklov va formatni aniq berish.",
      ],
      [
        "ethics",
        "Mas'uliyatli AI risklarini aniqlash",
        "Bias va privacy holatlarini baholash.",
      ],
    ],
  },
  {
    code: "U26-OS",
    title: "Operatsion tizimlar",
    description:
      "Jarayonlar, xotira va fayl tizimlari bo'yicha yakuniy nazorat oldi ko'rik.",
    professorIndex: 6,
    outcomes: [
      [
        "process",
        "Jarayonlarni rejalashtirishni tushuntirish",
        "Scheduling algoritmlarini solishtirish.",
      ],
      [
        "memory",
        "Xotira boshqaruvini tahlil qilish",
        "Paging va segmentation farqini aytish.",
      ],
      [
        "files",
        "Fayl tizimi amallarini izohlash",
        "Permission va metadata rolini tushuntirish.",
      ],
    ],
  },
  {
    code: "U26-SYS",
    title: "Bulutli tizimlar",
    description:
      "Deployment, monitoring va reliability bo'yicha ikki haftalik demo tayyorgarlik.",
    professorIndex: 8,
    outcomes: [
      [
        "deploy",
        "Deployment oqimini tashkil qilish",
        "Build, release va rollback bosqichlarini ajratish.",
      ],
      [
        "monitor",
        "Monitoring signallarini tanlash",
        "Latency, error rate va saturationni izohlash.",
      ],
      [
        "reliability",
        "Ishonchlilik risklarini kamaytirish",
        "Retry, timeout va circuit breakerlarni tushuntirish.",
      ],
    ],
  },
  {
    code: "U26-PROD",
    title: "Raqamli mahsulot laboratoriyasi",
    description:
      "Foydalanuvchi tadqiqoti, analytics va MVP qarorlari bo'yicha final oldi loyiha ishlari.",
    professorIndex: 7,
    outcomes: [
      [
        "research",
        "Foydalanuvchi muammosini aniqlash",
        "Interview xulosalarini action itemga aylantirish.",
      ],
      [
        "metrics",
        "Mahsulot metrikalarini tanlash",
        "Activation va retention o'lchovlarini tushuntirish.",
      ],
      ["mvp", "MVP hajmini asoslash", "Scope va riskni muvozanatlash."],
    ],
  },
];

const userId = (role: "student" | "professor", index: number) =>
  `${namespace}-${role}-${String(index + 1).padStart(2, "0")}`;
const profileId = (role: "student" | "professor", index: number) =>
  `${namespace}-${role}-profile-${String(index + 1).padStart(2, "0")}`;
const courseId = (index: number) =>
  `${namespace}-course-${String(index + 1).padStart(2, "0")}`;
const outcomeId = (courseIndex: number, suffix: string) =>
  `${courseId(courseIndex)}-outcome-${suffix}`;
const assessmentId = (courseIndex: number) =>
  `${courseId(courseIndex)}-assessment-final-prep`;

function requirePermission() {
  if (process.env.DEMO_ADDITIVE_PROVISIONING !== "true")
    throw new Error(
      "Set DEMO_ADDITIVE_PROVISIONING=true before provisioning demo data.",
    );
  if (process.env.ALLOW_MANAGED_DEMO_PROVISIONING !== "true")
    throw new Error(
      "Set ALLOW_MANAGED_DEMO_PROVISIONING=true after confirming this is the disposable demo database.",
    );
  if (
    !process.env.COHORT_DEMO_PASSWORD ||
    process.env.COHORT_DEMO_PASSWORD.length < 12
  )
    throw new Error("COHORT_DEMO_PASSWORD must be at least 12 characters.");
  if (process.env.SHAHZOD_DEMO_PASSWORD !== "shahzod999")
    throw new Error(
      "Set SHAHZOD_DEMO_PASSWORD=shahzod999 for the requested Shahzod account.",
    );
}

function statusFor(score: number) {
  if (score >= 80) return "MASTERED" as const;
  if (score >= 55) return "DEVELOPING" as const;
  return "NEEDS_ATTENTION" as const;
}

function scoreFor(studentIndex: number, outcomeIndex: number) {
  return Math.max(
    38,
    Math.min(96, 52 + ((studentIndex * 13 + outcomeIndex * 17) % 45)),
  );
}

async function ensureStudent(
  index: number,
  seed: StudentSeed,
  defaultHash: string,
  shahzodHash: string,
) {
  const passwordHash =
    seed.email === "shahzod@gmail.com" ? shahzodHash : defaultHash;
  const existingByEmail = await prisma.user.findUnique({
    where: { email: seed.email },
  });
  if (existingByEmail) {
    if (existingByEmail.role !== UserRole.STUDENT)
      throw new Error(`Refusing to reuse non-student email ${seed.email}.`);
    if (
      seed.email === "shahzod@gmail.com" &&
      existingByEmail.id !== userId("student", index) &&
      existingByEmail.name !== seed.name
    ) {
      throw new Error(
        "Refusing to overwrite an existing unrelated shahzod@gmail.com account.",
      );
    }
    if (
      seed.email !== "shahzod@gmail.com" &&
      existingByEmail.id !== userId("student", index) &&
      !existingByEmail.id.startsWith(namespace) &&
      existingByEmail.name !== seed.name
    ) {
      throw new Error(`Refusing to modify unrelated account ${seed.email}.`);
    }
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: { name: seed.name, role: UserRole.STUDENT, passwordHash },
    });
  }

  if (seed.legacyNumber) {
    const legacy = await prisma.user.findFirst({
      where: {
        email: `student${seed.legacyNumber}@uniloop.local`,
        name: `Student ${seed.legacyNumber}`,
        role: UserRole.STUDENT,
      },
    });
    if (legacy)
      return prisma.user.update({
        where: { id: legacy.id },
        data: { email: seed.email, name: seed.name, passwordHash },
      });
  }

  return prisma.user.create({
    data: {
      id: userId("student", index),
      email: seed.email,
      name: seed.name,
      role: UserRole.STUDENT,
      passwordHash,
    },
  });
}

async function ensureProfessor(
  index: number,
  seed: ProfessorSeed,
  passwordHash: string,
) {
  const existing = await prisma.user.findUnique({
    where: { email: seed.email },
  });
  if (existing) {
    if (
      existing.role !== UserRole.PROFESSOR ||
      (existing.id !== userId("professor", index) &&
        !existing.id.startsWith(namespace))
    ) {
      throw new Error(`Refusing to modify unrelated professor ${seed.email}.`);
    }
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: seed.name, role: UserRole.PROFESSOR, passwordHash },
    });
  }

  return prisma.user.create({
    data: {
      id: userId("professor", index),
      email: seed.email,
      name: seed.name,
      role: UserRole.PROFESSOR,
      passwordHash,
    },
  });
}

async function main() {
  requirePermission();

  const defaultHash = hashPassword(process.env.COHORT_DEMO_PASSWORD!);
  const shahzodHash = hashPassword(process.env.SHAHZOD_DEMO_PASSWORD!);
  const professorUsers: User[] = [];
  const studentUsers: User[] = [];

  for (let i = 0; i < professors.length; i++)
    professorUsers.push(await ensureProfessor(i, professors[i], defaultHash));
  for (let i = 0; i < students.length; i++)
    studentUsers.push(
      await ensureStudent(i, students[i], defaultHash, shahzodHash),
    );

  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < professorUsers.length; i++) {
        await tx.professorProfile.upsert({
          where: { userId: professorUsers[i].id },
          create: {
            id: profileId("professor", i),
            userId: professorUsers[i].id,
            department: professors[i].department,
          },
          update: { department: professors[i].department },
        });
      }

      for (let i = 0; i < studentUsers.length; i++) {
        await tx.studentProfile.upsert({
          where: { userId: studentUsers[i].id },
          create: {
            id: profileId("student", i),
            userId: studentUsers[i].id,
            universityId: students[i].universityId,
          },
          update: { universityId: students[i].universityId },
        });
      }

      for (let i = 0; i < courses.length; i++) {
        const professorProfile = await tx.professorProfile.findUniqueOrThrow({
          where: { userId: professorUsers[courses[i].professorIndex].id },
        });
        const existingCourse = await tx.course.findUnique({
          where: { code: courses[i].code },
        });
        if (existingCourse && existingCourse.id !== courseId(i)) {
          throw new Error(
            `Refusing to modify existing non-cohort course code ${courses[i].code}.`,
          );
        }
        await tx.course.upsert({
          where: { code: courses[i].code },
          create: {
            id: courseId(i),
            code: courses[i].code,
            title: courses[i].title,
            description: courses[i].description,
            professorId: professorProfile.id,
          },
          update: {
            title: courses[i].title,
            description: courses[i].description,
            professorId: professorProfile.id,
          },
        });

        for (let j = 0; j < courses[i].outcomes.length; j++) {
          const [suffix, title, description] = courses[i].outcomes[j];
          await tx.learningOutcome.upsert({
            where: { courseId_title: { courseId: courseId(i), title } },
            create: {
              id: outcomeId(i, suffix),
              courseId: courseId(i),
              title,
              description,
              sortOrder: j,
            },
            update: { description, sortOrder: j },
          });
        }

        await tx.material.upsert({
          where: { id: `${courseId(i)}-material-revision` },
          create: {
            id: `${courseId(i)}-material-revision`,
            courseId: courseId(i),
            title: `${courses[i].title}: final oldi revision`,
            contentType: "text/plain",
            url: `https://demo.uniloop.test/materials/${courses[i].code.toLowerCase()}/final-revision`,
            content:
              "Ikki hafta qoldi: zaif outcome bo'yicha 30 daqiqa takrorlash, follow-up savollarini yechish, 25-sentabrgacha mini-topshiriqni yakunlash.",
          },
          update: { title: `${courses[i].title}: final oldi revision` },
        });

        await tx.assessment.upsert({
          where: { id: assessmentId(i) },
          create: {
            id: assessmentId(i),
            courseId: courseId(i),
            title: `${courses[i].title}: follow-up assessment`,
            type: "FOLLOW_UP",
            startsAt: new Date("2026-09-18T09:00:00.000Z"),
            dueAt: new Date("2026-10-02T18:00:00.000Z"),
          },
          update: {
            title: `${courses[i].title}: follow-up assessment`,
            dueAt: new Date("2026-10-02T18:00:00.000Z"),
          },
        });

        for (let j = 0; j < courses[i].outcomes.length; j++) {
          const [suffix, title] = courses[i].outcomes[j];
          await tx.question.upsert({
            where: { id: `${assessmentId(i)}-q-${suffix}` },
            create: {
              id: `${assessmentId(i)}-q-${suffix}`,
              assessmentId: assessmentId(i),
              prompt: `${title} bo'yicha eng to'g'ri keyingi qadamni tanlang.`,
              type: "MULTIPLE_CHOICE",
              weight: 1,
              maxScore: 1,
              correctAnswer: "correct",
              options: [
                {
                  id: "correct",
                  text: "Asosiy tushunchani misol bilan qo'llash",
                },
                { id: "incorrect", text: "Bir xil xatoni takrorlash" },
              ],
              sortOrder: j,
              outcomeLinks: {
                create: { learningOutcomeId: outcomeId(i, suffix), weight: 1 },
              },
            },
            update: {
              prompt: `${title} bo'yicha eng to'g'ri keyingi qadamni tanlang.`,
              sortOrder: j,
            },
          });
        }

        await tx.intervention.upsert({
          where: { id: `${courseId(i)}-intervention-final-lab` },
          create: {
            id: `${courseId(i)}-intervention-final-lab`,
            courseId: courseId(i),
            professorId: professorProfile.id,
            title: `${courses[i].title}: zaif outcome bo'yicha mini-lab`,
            description:
              "Cohort mastery pastroq bo'lgan outcome uchun 35 daqiqalik qayta tushuntirish va follow-up mashq.",
            targetOutcomeIds: [outcomeId(i, courses[i].outcomes[1][0])],
            status: "ACTIVE",
            plannedAt: new Date("2026-09-25T09:00:00.000Z"),
          },
          update: {
            status: "ACTIVE",
            plannedAt: new Date("2026-09-25T09:00:00.000Z"),
          },
        });
      }

      for (let i = 0; i < studentUsers.length; i++) {
        const seed = students[i];
        const course = courses[seed.courseIndex];
        const studentProfile = await tx.studentProfile.findUniqueOrThrow({
          where: { userId: studentUsers[i].id },
        });
        await tx.enrollment.upsert({
          where: {
            courseId_studentId: {
              courseId: courseId(seed.courseIndex),
              studentId: studentProfile.id,
            },
          },
          create: {
            courseId: courseId(seed.courseIndex),
            studentId: studentProfile.id,
          },
          update: {},
        });

        const submissionId = `${namespace}-submission-${String(i + 1).padStart(2, "0")}`;
        await tx.submission.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: assessmentId(seed.courseIndex),
              studentId: studentProfile.id,
            },
          },
          create: {
            id: submissionId,
            assessmentId: assessmentId(seed.courseIndex),
            studentId: studentProfile.id,
            status: "SCORED",
            answers: {
              create: course.outcomes.map(([suffix], j) => ({
                questionId: `${assessmentId(seed.courseIndex)}-q-${suffix}`,
                answer: scoreFor(i, j) >= 70 ? "correct" : "partial",
                score: scoreFor(i, j) >= 70 ? 1 : 0,
              })),
            },
          },
          update: { status: "SCORED" },
        });

        for (let j = 0; j < course.outcomes.length; j++) {
          const [suffix] = course.outcomes[j];
          const percentage = scoreFor(i, j);
          await tx.masteryRecord.upsert({
            where: {
              submissionId_learningOutcomeId: {
                submissionId,
                learningOutcomeId: outcomeId(seed.courseIndex, suffix),
              },
            },
            create: {
              id: `${namespace}-mastery-${String(i + 1).padStart(2, "0")}-${suffix}`,
              studentId: studentProfile.id,
              courseId: courseId(seed.courseIndex),
              assessmentId: assessmentId(seed.courseIndex),
              submissionId,
              learningOutcomeId: outcomeId(seed.courseIndex, suffix),
              percentage,
              status: statusFor(percentage),
            },
            update: { percentage, status: statusFor(percentage) },
          });
        }

        await tx.learningPlan.upsert({
          where: { id: `${namespace}-plan-${String(i + 1).padStart(2, "0")}` },
          create: {
            id: `${namespace}-plan-${String(i + 1).padStart(2, "0")}`,
            studentId: studentProfile.id,
            courseId: courseId(seed.courseIndex),
            title: `${seed.name}: finalgacha shaxsiy rivojlanish rejasi`,
            rationale: `${seed.major} talabasi uchun eng past mastery outcome bo'yicha 7 kunlik qayta ishlash rejasi.`,
          },
          update: {
            title: `${seed.name}: finalgacha shaxsiy rivojlanish rejasi`,
            rationale: `${seed.major} talabasi uchun eng past mastery outcome bo'yicha 7 kunlik qayta ishlash rejasi.`,
          },
        });

        await tx.learningTask.upsert({
          where: { id: `${namespace}-task-${String(i + 1).padStart(2, "0")}` },
          create: {
            id: `${namespace}-task-${String(i + 1).padStart(2, "0")}`,
            learningPlanId: `${namespace}-plan-${String(i + 1).padStart(2, "0")}`,
            learningOutcomeId: outcomeId(
              seed.courseIndex,
              course.outcomes[1][0],
            ),
            title: "Final oldi follow-up mashq",
            description: `${course.outcomes[1][1]} bo'yicha 3 ta xatoni topib, tuzatish izohini yozing.`,
            dueAt: new Date("2026-09-25T18:00:00.000Z"),
            completedAt:
              i % 4 === 0 ? new Date("2026-09-21T18:00:00.000Z") : null,
          },
          update: {
            description: `${course.outcomes[1][1]} bo'yicha 3 ta xatoni topib, tuzatish izohini yozing.`,
            dueAt: new Date("2026-09-25T18:00:00.000Z"),
            completedAt:
              i % 4 === 0 ? new Date("2026-09-21T18:00:00.000Z") : null,
          },
        });
      }
    },
    { timeout: 300000 },
  );

  console.log(
    JSON.stringify(
      {
        provisioned: true,
        students: students.length,
        professors: professors.length,
        courses: courses.length,
        shahzod: {
          email: "shahzod@gmail.com",
          password: "shahzod999",
          role: "STUDENT",
          name: "Shahzod Karimov",
          universityId: "UL-26-011",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? (error.stack ?? error.message)
        : "Provisioning failed",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
