import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";
import { AcademicService } from "../src/modules/integration/academic.service";
import { CareerApiService } from "../src/modules/integration/career-api.service";
import { CoursesService } from "../src/modules/courses/courses.service";
import { MasteryService } from "../src/modules/mastery/mastery.service";
import { CareerReadinessService } from "../src/modules/career/career-readiness.service";
import { JobSearchService } from "../src/modules/integration/job-search.service";

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
      email: "azizbek.rahmonov@demo.uniloop.test",
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
      name: "Zarnigor Murodova",
      email: "zarnigor.murodova@demo.uniloop.test",
      role: "PROFESSOR",
      passwordHash,
      professorProfile: { create: { id: "professor-other" } },
    },
  });
  const supportingProfessors = [
    ["user-professor-3", "professor-3", "Madina Usmonova", "Maʼlumotlar muhandisligi"],
    ["user-professor-4", "professor-4", "Jasur Islomov", "Dasturiy injiniring"],
    ["user-professor-5", "professor-5", "Nodira Qodirova", "Veb texnologiyalar"],
    ["user-professor-6", "professor-6", "Sardor Tursunov", "Maʼlumotlar tahlili"],
    ["user-professor-7", "professor-7", "Gulnoza Karimova", "Algoritmlar"],
    ["user-professor-8", "professor-8", "Kamoliddin Aliyev", "Amaliy dasturlash"],
    ["user-professor-9", "professor-9", "Ruxshona To‘laganova", "Obyektga yo‘naltirilgan dasturlash"],
    ["user-professor-10", "professor-10", "Ulug‘bek Hamdamov", "Kiberxavfsizlik asoslari"],
  ] as const;
  for (const [userId, profileId, name, department] of supportingProfessors) {
    await prisma.user.create({ data: { id: userId, name, email: `${userId.replace("user-", "")}@demo.uniloop.test`, role: UserRole.PROFESSOR, passwordHash, professorProfile: { create: { id: profileId, department } } } });
  }
  await prisma.user.create({ data: { id: "user-demo-admin", name: "Demo administrator", email: "admin@demo.uniloop.test", role: UserRole.ADMIN, passwordHash } });
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
  const additionalCourses = [
    ["course-data-structures", "Data Structures and Algorithms", "CS-202", "professor-7"],
    ["course-databases", "Database Systems", "CS-221", "professor-3"],
    ["course-web-development", "Web Development", "CS-240", "professor-5"],
    ["course-data-analytics", "Data Analytics Fundamentals", "DS-110", "professor-6"],
    ["course-software-engineering", "Software Engineering Practice", "SE-310", "professor-4"],
    ["course-object-oriented", "Object-Oriented Programming", "CS-201", "professor-9"],
  ] as const;
  for (const [id, title, code, professorId] of additionalCourses) {
    await prisma.course.create({ data: { id, title, code, professorId, description: `${title} fanining yakuniy imtihon oldi amaliy mashg‘ulotlari.` , learningOutcomes: { create: [{ title: "Asosiy tushunchani qo‘llash", description: "Fan bo‘yicha asosiy amaliy ko‘nikma.", sortOrder: 0 }, { title: "Yechimni asoslash", description: "Tanlangan yondashuvni tushuntirish.", sortOrder: 1 }] }, materials: { create: { title: "Yakuniy tayyorgarlik eslatmasi", content: "Imtihon oldidan asosiy mavzularni takrorlang.", contentType: "text/plain" } } } });
  }
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
    [1, 1, 1, 0], [1, 0, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0],
    [0, 1, 1, 1], [1, 0, 1, 1], [0, 0, 1, 1], [1, 1, 1, 1],
    [0, 1, 0, 1], [1, 0, 1, 0], [1, 1, 0, 1], [0, 0, 0, 1],
    [1, 0, 0, 1], [0, 1, 1, 0], [1, 1, 0, 1], [0, 1, 0, 0], [1, 0, 1, 1], [0, 0, 1, 0],
  ];
  const studentAccounts = [
    ["Dilnoza Karimova", "dilnoza.karimova"], ["Javohir Xudoyberdiyev", "javohir.xudoyberdiyev"], ["Sevinch Abdullayeva", "sevinch.abdullayeva"], ["Bekzod Sodiqov", "bekzod.sodiqov"], ["Malika Ergasheva", "malika.ergasheva"], ["Azizbek Mirzayev", "azizbek.mirzayev"], ["Shahnoza Rasulova", "shahnoza.rasulova"], ["Oybek Jo‘rayev", "oybek.jorayev"], ["Madina Nurmatova", "madina.nurmatova"], ["Doston Yusupov", "doston.yusupov"], ["Zarina To‘xtayeva", "zarina.toxtayeva"], ["Sardor Abduqodirov", "sardor.abduqodirov"], ["Nilufar Akramova", "nilufar.akramova"], ["Temur Gʻaniyev", "temur.ganiyev"], ["Laylo Ismoilova", "laylo.ismoilova"], ["Umidjon Qosimov", "umidjon.qosimov"], ["Shahzoda Rahimova", "shahzoda.rahimova"], ["Farruh Saidov", "farruh.saidov"], ["Diyora Mamatqulova", "diyora.mamatqulova"], ["Abror Kamilov", "abror.kamilov"], ["Mohira Sobirova", "mohira.sobirova"], ["Suhayl Usmonov", "suhayl.usmonov"], ["Iroda Yo‘ldosheva", "iroda.yoldosheva"], ["Rustam Nazarov", "rustam.nazarov"], ["Kamol Yusupov", "kamol.yusupov"], ["Aziza Raxmatova", "aziza.raxmatova"], ["Botir Jumayev", "botir.jumayev"], ["Munisa Jo‘rayeva", "munisa.jorayeva"], ["Sherzod Eshonqulov", "sherzod.eshonqulov"], ["Nargiza Abduvaliyeva", "nargiza.abduvaliyeva"],
  ] as const;
  for (let index = 0; index < patterns.length; index++) {
    const id = "user-student-" + (index + 1),
      profileId = "student-" + (index + 1);
    const user = await prisma.user.create({
      data: {
        id,
        name: studentAccounts[index][0],
        email: `${studentAccounts[index][1]}@demo.uniloop.test`,
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
    for (const [courseId] of additionalCourses.filter((_, courseIndex) => (index + courseIndex) % 3 === 0))
      await prisma.enrollment.create({ data: { courseId, studentId: profileId } });
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
  // A broader, relational demo dataset: five professors, fifteen students and
  // fifteen published courses with authoring, enrollment and assessment data.
  const courseAuthoringProfessors = [
    ["professor-madina", "user-madina", "Madina Usmonova", "madina.professor@uniloop.local", "Dasturiy injiniring"],
    ["professor-kamol", "user-kamol", "Kamol Ergashev", "kamol.professor@uniloop.local", "Ma’lumotlar tahlili"],
    ["professor-nilufar", "user-nilufar", "Nilufar Qodirova", "nilufar.professor@uniloop.local", "Kompyuter tarmoqlari"],
  ] as const;
  for (const [profileId, userId, name, email, department] of courseAuthoringProfessors)
    await prisma.user.create({ data: { id: userId, name, email, role: "PROFESSOR", passwordHash, professorProfile: { create: { id: profileId, department, university: "UniLoop Demo University", title: "Professor" } } } });
  const extraStudents = [
    ["student-11", "user-student-11", "Aziza To‘xtayeva", "student11@uniloop.local", "Frontend dasturchi", ["React", "JavaScript"]],
    ["student-12", "user-student-12", "Jasur Mamatqulov", "student12@uniloop.local", "Data analyst", ["Python", "SQL"]],
    ["student-13", "user-student-13", "Malika Yusupova", "student13@uniloop.local", "DevOps engineer", ["Docker", "Linux"]],
    ["student-14", "user-student-14", "Sardor Aliyev", "student14@uniloop.local", "Backend developer", ["REST APIs", "Database Design"]],
    ["student-15", "user-student-15", "Zarina Abdullayeva", "student15@uniloop.local", "Machine learning engineer", ["Python", "Machine Learning"]],
  ] as const;
  for (const [profileId, userId, name, email, targetRole, coreSkills] of extraStudents) {
    await prisma.user.create({ data: { id: userId, name, email, role: "STUDENT", passwordHash, studentProfile: { create: { id: profileId, universityId: `UNI-${profileId}`, university: "UniLoop Demo University", faculty: "Computer Science", major: "Software Engineering", studyYear: 2 + (Number(profileId.split("-")[1]) % 3) } } } });
    await prisma.careerProfile.create({ data: { studentId: profileId, targetRole, interests: [...coreSkills], coreSkills: [...coreSkills], vacancyQueries: [targetRole] } });
    await prisma.consent.create({ data: { studentId: profileId, networkingVisible: true, peerRecommendations: true, professorReferralAllowed: true } });
    await prisma.skillEvidence.create({ data: { studentId: profileId, skill: coreSkills[0], sourceType: "PROJECT", sourceId: `portfolio-${profileId}`, score: 72, professorVerified: profileId === "student-11" } });
  }
  const courseTemplates = [
    ["WEB201", "Web dasturlash asoslari", "Frontend Development", ["HTML/CSS", "JavaScript"], "React komponentlarini yaratadi"],
    ["DB202", "Ma’lumotlar bazasi dizayni", "Database Design", ["SQL", "Database Design"], "Normalizatsiyalangan sxemani loyihalaydi"],
    ["NET203", "Kompyuter tarmoqlari", "Networking", ["TCP/IP", "Linux"], "Tarmoq konfiguratsiyasini tahlil qiladi"],
    ["ALG204", "Algoritmlar va murakkablik", "Algorithms", ["Algorithms", "Python"], "Algoritm murakkabligini baholaydi"],
    ["DS205", "Data analytics", "Data Analysis", ["Python", "SQL"], "Ma’lumotlardan xulosa chiqaradi"],
    ["DEV206", "DevOps asoslari", "DevOps", ["Docker", "Linux"], "CI/CD jarayonini sozlaydi"],
    ["API207", "REST API arxitekturasi", "Backend Development", ["REST APIs", "Database Design"], "Xavfsiz REST API yaratadi"],
    ["ML208", "Machine learning kirish", "Machine Learning", ["Python", "Machine Learning"], "Oddiy modelni baholaydi"],
    ["UX209", "UX va interfeys dizayni", "UX Design", ["Figma", "Research"], "Foydalanuvchi oqimini loyihalaydi"],
    ["SEC210", "Kiberxavfsizlik asoslari", "Cybersecurity", ["Security", "Networking"], "Zaifliklarni aniqlaydi"],
    ["MOB211", "Mobil ilovalar", "Mobile Development", ["React", "JavaScript"], "Mobil interfeysni ishlab chiqadi"],
    ["CLOUD212", "Cloud computing", "Cloud", ["Docker", "Linux"], "Cloud infratuzilmasini tushuntiradi"],
    ["STAT213", "Statistika amaliyoti", "Statistics", ["Statistics", "Data Analysis"], "Statistik natijalarni izohlaydi"],
    ["PRO214", "Professional loyiha laboratoriyasi", "Project Management", ["Communication", "Git"], "Jamoaviy loyihani taqdim etadi"],
  ] as const;
  const professorIds = ["professor-azizbek", "professor-other", ...courseAuthoringProfessors.map(([id]) => id)];
  const allStudentIds = Array.from({ length: 15 }, (_, index) => `student-${index + 1}`);
  for (const [index, [code, title, subject, skills, outcomeTitle]] of courseTemplates.entries()) {
    const courseId = `course-${code.toLowerCase()}`;
    const courseRecord = await prisma.course.create({ data: { id: courseId, code, title, description: `${subject} bo‘yicha amaliy demo kurs.`, shortDescription: `${subject} kursi`, fullDescription: `${title}: nazariya, laboratoriya va yakuniy loyiha.`, subject, difficulty: index % 3 === 0 ? "BEGINNER" : index % 3 === 1 ? "INTERMEDIATE" : "ADVANCED", language: "uz", estimatedDurationMinutes: 2400, weeklyWorkloadHours: 6, targetStudyYears: [2, 3], targetPrograms: ["Software Engineering", "Computer Science"], prerequisites: index % 2 ? ["Programming Fundamentals"] : [], careerRelevance: `${subject} bo‘yicha portfolio dalili yaratadi.`, type: "SUPPLEMENTARY", status: "PUBLISHED", enrollmentMode: index % 2 ? "APPROVAL_REQUIRED" : "OPEN", maximumEnrollment: 40, professorId: professorIds[index % professorIds.length], modules: { create: [{ title: "Asoslar", description: `${subject} asosiy tushunchalari`, sortOrder: 0, estimatedMinutes: 600, topics: { create: [{ title: `${subject} kirish`, sortOrder: 0, estimatedMinutes: 180 }] } }, { title: "Amaliyot", description: "Laboratoriya va loyiha", sortOrder: 1, estimatedMinutes: 900, topics: { create: [{ title: "Loyiha topshirig‘i", sortOrder: 0, estimatedMinutes: 360 }] } }] } } });
    const outcome = await prisma.learningOutcome.create({ data: { id: `outcome-${code.toLowerCase()}`, courseId, title: outcomeTitle, description: `${skills.join(" va ")} bo‘yicha o‘lchanadigan natija.`, category: subject, careerRelevance: "Kasbiy portfolio", sortOrder: 0, professorApprovedAt: new Date() } });
    await prisma.material.create({ data: { id: `material-${code.toLowerCase()}`, courseId, title: `${title} konspekti`, description: "Demo o‘quv materiali", content: `${title} bo‘yicha asosiy tushunchalar va amaliy ko‘rsatmalar.`, contentType: "text/plain", published: true, visibility: "ENROLLED" } });
    const assessment = await prisma.assessment.create({ data: { id: `assessment-${code.toLowerCase()}`, courseId, title: `${title} diagnostikasi`, type: "DIAGNOSTIC", published: true } });
    await prisma.question.create({ data: { id: `question-${code.toLowerCase()}`, assessmentId: assessment.id, prompt: `${title} kursining asosiy ko‘nikmasini tanlang.`, type: "MULTIPLE_CHOICE", weight: 100, maxScore: 1, options: [{ id: "correct", text: skills[0] }, { id: "wrong", text: "Tasodifiy javob" }], correctAnswer: "correct", outcomeLinks: { create: { learningOutcomeId: outcome.id, weight: 1 } } } });
    for (const studentId of allStudentIds.filter((_, studentIndex) => (studentIndex + index) % 3 === 0))
      await prisma.enrollment.create({ data: { courseId: courseRecord.id, studentId } });
  }
  const simulatedJobs = new JobSearchService(prisma as never);
  for (const profile of await prisma.careerProfile.findMany())
    await simulatedJobs.refreshForProfile({ targetRole: profile.targetRole, interests: profile.interests, coreSkills: profile.coreSkills, vacancyQueries: profile.vacancyQueries, userId: profile.studentId });
  console.log(
    "Disposable demo seeded: fifteen students, five professors, fifteen published courses, enrollments, outcomes, materials, assessments, mastery evidence and simulated profile-matched vacancies.",
  );
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
