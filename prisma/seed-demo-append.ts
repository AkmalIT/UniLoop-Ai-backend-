import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";
import { JobSearchService } from "../src/modules/integration/job-search.service";

const prisma = new PrismaClient();
const passwordHash = hashPassword("password123");
const professors = [
  ["demo-load-prof-1", "Demo Professor Amina", "demo.amina.professor@uniloop.local", "Dasturiy injiniring"],
  ["demo-load-prof-2", "Demo Professor Bekzod", "demo.bekzod.professor@uniloop.local", "Data Science"],
  ["demo-load-prof-3", "Demo Professor Dilshod", "demo.dilshod.professor@uniloop.local", "Kompyuter tarmoqlari"],
  ["demo-load-prof-4", "Demo Professor Farida", "demo.farida.professor@uniloop.local", "Kiberxavfsizlik"],
  ["demo-load-prof-5", "Demo Professor G‘ulom", "demo.gulom.professor@uniloop.local", "Axborot tizimlari"],
] as const;
const students = [
  ["Demo Talaba Ali", "BACKEND_DEVELOPER", ["REST APIs", "SQL", "Python"]], ["Demo Talaba Aziza", "FRONTEND_DEVELOPER", ["React", "JavaScript", "HTML/CSS"]],
  ["Demo Talaba Bobur", "DATA_ANALYST", ["Python", "SQL", "Data Analysis"]], ["Demo Talaba Dilnoza", "DEVOPS_ENGINEER", ["Docker", "Linux", "Networking"]],
  ["Demo Talaba Elmurod", "FULLSTACK_DEVELOPER", ["React", "REST APIs", "SQL"]], ["Demo Talaba Feruza", "BACKEND_DEVELOPER", ["Python", "Database Design"]],
  ["Demo Talaba Gulnoza", "DATA_ANALYST", ["Statistics", "Python"]], ["Demo Talaba Hasan", "FRONTEND_DEVELOPER", ["JavaScript", "React"]],
  ["Demo Talaba Iroda", "DEVOPS_ENGINEER", ["Linux", "Docker"]], ["Demo Talaba Jasur", "FULLSTACK_DEVELOPER", ["JavaScript", "REST APIs"]],
  ["Demo Talaba Kamola", "BACKEND_DEVELOPER", ["SQL", "REST APIs"]], ["Demo Talaba Lola", "DATA_ANALYST", ["Data Analysis", "SQL"]],
  ["Demo Talaba Muzaffar", "FRONTEND_DEVELOPER", ["HTML/CSS", "JavaScript"]], ["Demo Talaba Nodira", "DEVOPS_ENGINEER", ["Docker", "Networking"]],
  ["Demo Talaba Otabek", "FULLSTACK_DEVELOPER", ["React", "Python", "SQL"]],
] as const;
const subjects = [
  ["Web dasturlash", "Frontend Development", "React komponentlarini yaratadi"], ["Ma’lumotlar bazasi", "Database Design", "SQL so‘rovlarini yozadi"],
  ["Algoritmlar", "Algorithms", "Algoritm murakkabligini tahlil qiladi"], ["REST API", "Backend Development", "Xavfsiz API yaratadi"],
  ["Data analytics", "Data Analysis", "Ma’lumotlardan xulosa chiqaradi"], ["DevOps", "DevOps", "CI/CD jarayonini sozlaydi"],
  ["Kiberxavfsizlik", "Cybersecurity", "Asosiy zaifliklarni aniqlaydi"], ["Cloud computing", "Cloud", "Cloud xizmatlarini tanlaydi"],
  ["Machine learning", "Machine Learning", "Model sifatini baholaydi"], ["Kompyuter tarmoqlari", "Networking", "Tarmoqni sozlaydi"],
  ["Mobil ilovalar", "Mobile Development", "Mobil ekran yaratadi"], ["UX dizayn", "UX Design", "Foydalanuvchi oqimini loyihalaydi"],
  ["Statistika", "Statistics", "Statistik natijani izohlaydi"], ["Git va jamoa", "Collaboration", "Jamoaviy Git oqimini yuritadi"],
  ["Portfolio loyihasi", "Project Management", "Loyihani taqdim etadi"],
] as const;

async function main() {
  if (process.env.DEMO_DATA_WRITE !== "true") throw new Error("Set DEMO_DATA_WRITE=true to append demo records.");
  const professorIds: string[] = [];
  for (const [index, [profileId, name, email, department]] of professors.entries()) {
    const userId = `demo-load-prof-user-${index + 1}`; professorIds.push(profileId);
    await prisma.user.upsert({ where: { email }, create: { id: userId, name, email, role: "PROFESSOR", passwordHash, onboardingCompletedAt: new Date() }, update: { name, role: "PROFESSOR", onboardingCompletedAt: new Date() } });
    await prisma.professorProfile.upsert({ where: { userId }, create: { id: profileId, userId, department, university: "UniLoop Demo University", title: "Professor" }, update: { department, university: "UniLoop Demo University", title: "Professor" } });
  }
  const studentIds: string[] = [];
  for (const [index, [name, targetRole, skills]] of students.entries()) {
    const no = index + 1, userId = `demo-load-student-user-${no}`, profileId = `demo-load-student-${no}`, email = `demo.student.${no}@uniloop.local`;
    studentIds.push(profileId);
    await prisma.user.upsert({ where: { email }, create: { id: userId, name, email, role: "STUDENT", passwordHash, onboardingCompletedAt: new Date() }, update: { name, role: "STUDENT", onboardingCompletedAt: new Date() } });
    await prisma.studentProfile.upsert({ where: { userId }, create: { id: profileId, userId, universityId: `DEMO-LOAD-${no}`, university: "UniLoop Demo University", faculty: "Computer Science", major: no % 2 ? "Software Engineering" : "Data Science", studyYear: 1 + (no % 4) }, update: { faculty: "Computer Science", major: no % 2 ? "Software Engineering" : "Data Science", studyYear: 1 + (no % 4) } });
    await prisma.careerProfile.upsert({ where: { studentId: profileId }, create: { studentId: profileId, targetRole, interests: [...skills], coreSkills: [...skills], vacancyQueries: [targetRole] }, update: { targetRole, interests: [...skills], coreSkills: [...skills], vacancyQueries: [targetRole] } });
    await prisma.consent.upsert({ where: { studentId: profileId }, create: { studentId: profileId, networkingVisible: true, peerRecommendations: true, professorReferralAllowed: true }, update: { networkingVisible: true, peerRecommendations: true, professorReferralAllowed: true } });
    await prisma.skillEvidence.upsert({ where: { studentId_skill_sourceType_sourceId: { studentId: profileId, skill: skills[0], sourceType: "PROJECT", sourceId: `demo-portfolio-${no}` } }, create: { studentId: profileId, skill: skills[0], sourceType: "PROJECT", sourceId: `demo-portfolio-${no}`, score: 55 + no, professorVerified: no % 4 === 0 }, update: { score: 55 + no, professorVerified: no % 4 === 0 } });
  }
  for (const [index, [title, subject, outcomeTitle]] of subjects.entries()) {
    const no = index + 1, courseId = `demo-load-course-${no}`, code = `DLOAD${String(no).padStart(3, "0")}`, professorId = professorIds[index % professorIds.length];
    await prisma.course.upsert({ where: { code }, create: courseData(courseId, code, title, subject, professorId, no), update: courseData(courseId, code, title, subject, professorId, no) });
    const module = await prisma.courseModule.upsert({ where: { id: `demo-load-module-${no}` }, create: { id: `demo-load-module-${no}`, courseId, title: "Asoslar va amaliyot", description: `${subject} bo‘yicha nazariya va laboratoriya`, sortOrder: 0, estimatedMinutes: 720 }, update: { title: "Asoslar va amaliyot", description: `${subject} bo‘yicha nazariya va laboratoriya`, estimatedMinutes: 720 } });
    await prisma.courseTopic.upsert({ where: { id: `demo-load-topic-${no}` }, create: { id: `demo-load-topic-${no}`, moduleId: module.id, title: `${subject} kirish`, description: "Demo mavzu", sortOrder: 0, estimatedMinutes: 180 }, update: { title: `${subject} kirish`, description: "Demo mavzu" } });
    const outcome = await prisma.learningOutcome.upsert({ where: { id: `demo-load-outcome-${no}` }, create: { id: `demo-load-outcome-${no}`, courseId, title: outcomeTitle, description: `${subject} bo‘yicha o‘lchanadigan natija`, category: subject, careerRelevance: "Portfolio va kasbiy amaliyot", sortOrder: 0, professorApprovedAt: new Date() }, update: { title: outcomeTitle, description: `${subject} bo‘yicha o‘lchanadigan natija`, category: subject } });
    await prisma.material.upsert({ where: { id: `demo-load-material-${no}` }, create: { id: `demo-load-material-${no}`, courseId, moduleId: module.id, outcomeId: outcome.id, title: `${title} konspekti`, description: "Demo o‘quv materiali", content: `${title} uchun amaliy konspekt va mashqlar.`, contentType: "text/plain", published: true, visibility: "ENROLLED" }, update: { title: `${title} konspekti`, content: `${title} uchun amaliy konspekt va mashqlar.`, published: true } });
    const assessment = await prisma.assessment.upsert({ where: { id: `demo-load-assessment-${no}` }, create: { id: `demo-load-assessment-${no}`, courseId, title: `${title} diagnostikasi`, type: "DIAGNOSTIC", published: true }, update: { title: `${title} diagnostikasi`, published: true } });
    await prisma.question.upsert({ where: { id: `demo-load-question-${no}` }, create: { id: `demo-load-question-${no}`, assessmentId: assessment.id, prompt: `${title} uchun to‘g‘ri ko‘nikmani tanlang.`, type: "MULTIPLE_CHOICE", weight: 100, maxScore: 1, options: [{ id: "correct", text: subject }, { id: "wrong", text: "Tasodifiy javob" }], correctAnswer: "correct", outcomeLinks: { create: { learningOutcomeId: outcome.id, weight: 1 } } }, update: { prompt: `${title} uchun to‘g‘ri ko‘nikmani tanlang.`, options: [{ id: "correct", text: subject }, { id: "wrong", text: "Tasodifiy javob" }], correctAnswer: "correct" } });
    for (const studentId of studentIds.filter((_, studentIndex) => (studentIndex + index) % 3 === 0)) await prisma.enrollment.upsert({ where: { courseId_studentId: { courseId, studentId } }, create: { courseId, studentId }, update: {} });
  }
  const jobs = new JobSearchService(prisma as never);
  for (const [index, [, targetRole, skills]] of students.entries()) await jobs.refreshForProfile({ targetRole, interests: [...skills], coreSkills: [...skills], vacancyQueries: [targetRole], userId: `demo-load-student-user-${index + 1}` });
  console.log("Demo append complete: 5 professors, 15 students, 15 courses and profile-matched simulated vacancies.");
}
function courseData(id: string, code: string, title: string, subject: string, professorId: string, no: number) {
  return { id, code, title, description: `${subject} bo‘yicha demo kurs.`, shortDescription: `${subject} kursi`, fullDescription: `${title}: nazariya, laboratoriya va loyiha.`, type: "SUPPLEMENTARY" as const, status: "PUBLISHED" as const, subject, difficulty: no % 3 === 0 ? "ADVANCED" : no % 2 ? "INTERMEDIATE" : "BEGINNER", language: "uz", estimatedDurationMinutes: 2400, weeklyWorkloadHours: 6, targetStudyYears: [1, 2, 3, 4], targetPrograms: ["Software Engineering", "Data Science"], prerequisites: no % 2 ? ["Programming Fundamentals"] : [], careerRelevance: `${subject} bo‘yicha portfolio yaratadi.`, enrollmentMode: no % 2 ? "APPROVAL_REQUIRED" as const : "OPEN" as const, maximumEnrollment: 50, professorId };
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
