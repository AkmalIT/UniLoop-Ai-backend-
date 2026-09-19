import {
  OpportunityExplanationContext,
  CareerProfileAnalysisContext,
  LearningPlanContext,
  ProfessorRecommendationContext,
  SkillGapContext,
  StudentNextStepContext,
  VacancyQueryContext,
} from './ai-career.types';

const GROUNDING_RULES = `
MUHIM QOIDALAR:
- Faqat berilgan ma'lumotlardan foydalaning.
- Ko'nikmalar, loyihalar, baholar, kompaniyalar yoki yutuqlarni o'ylab topmang.
- Agar ma'lumot yetarli bo'lmasa, shuni aytib qo'ying.
- Shaxsiy xususiyatlar (intellekt, shaxsiyat, motivatsiya) haqida taxmin qilmang.
- Javobni faqat O'zbek tilida bering.
`.trim();

export function buildOpportunityExplanationPrompt(ctx: OpportunityExplanationContext): string {
  return `
Siz UniLoop AI yordamchisisiz. Quyidagi ma'lumotlar asosida talabaga ushbu imkoniyat nima uchun tavsiya qilinganini tushuntiring.

${GROUNDING_RULES}

TALABA MA'LUMOTLARI:
- Maqsadli yo'nalish: ${ctx.targetRole}
- Mos kelgan ko'nikmalar: ${ctx.matchedSkills.join(', ') || 'yo\'q'}
- Yetishmayotgan ko'nikmalar: ${ctx.missingSkills.join(', ') || 'yo\'q'}
- Professor tomonidan tasdiqlangan ko'nikmalar: ${ctx.verifiedSkills.join(', ') || 'yo\'q'}
- Moslik darajasi (backend tomonidan hisoblangan): ${ctx.matchScore}%

IMKONIYAT MA'LUMOTLARI:
- Turi: ${ctx.opportunityType}
- Nomi: ${ctx.opportunityTitle}
- Tavsifi: ${ctx.opportunityDescription}
- Talab qilinadigan ko'nikmalar: ${ctx.requiredSkills.join(', ')}

Quyidagi JSON formatida javob bering (boshqa hech narsa yozmang):
{
  "explanationUz": "Nima uchun tavsiya qilinganini 2-3 jumlada tushuntiring",
  "nextActionUz": "Talaba keyingi qadamda nima qilishi kerakligini 1 jumlada ayting"
}
`.trim();
}

export function buildStudentNextStepPrompt(ctx: StudentNextStepContext): string {
  return `
Siz UniLoop AI yordamchisisiz. Talabaning hozirgi holatiga qarab eng foydali keyingi rivojlanish qadamini taklif qiling.

${GROUNDING_RULES}

TALABA HOLATI:
- Maqsadli yo'nalish: ${ctx.targetRole}
- Tayorlik darajasi (backend tomonidan hisoblangan): ${ctx.readinessLevel}
- Asosiy ko'nikmalar: ${ctx.coreSkillsCovered}/${ctx.coreSkillsTotal} ko'rsatilgan
- Eng kuchli ko'nikmalar: ${ctx.strongestSkills.map((s) => `${s.skill} (${s.score}%)`).join(', ') || 'yo\'q'}
- Ko'nikma bo'shliqlari: ${ctx.skillGaps.join(', ') || 'yo\'q'}
- Loyiha dalili mavjudmi: ${ctx.hasProjectEvidence ? 'ha' : 'yo\'q'}
- Professor tomonidan tasdiqlangan dalillar soni: ${ctx.verifiedEvidenceCount}
- So'nggi o'rganilgan mavzular: ${ctx.recentMasteryTitles.join(', ') || 'yo\'q'}

Quyidagi JSON formatida javob bering (boshqa hech narsa yozmang):
{
  "titleUz": "Keyingi qadam sarlavhasi (qisqa)",
  "descriptionUz": "Nima qilish kerakligini 2-3 jumlada tushuntiring",
  "reasonUz": "Nima uchun aynan shu qadam muhimligini 1-2 jumlada tushuntiring"
}
`.trim();
}

export function buildLearningPlanPrompt(ctx: LearningPlanContext): string {
  const outcomes = ctx.course.outcomes
    .map((outcome) => `- ${outcome.title}: ${outcome.description || "tavsif yo'q"}`)
    .join("\n");
  const modules = ctx.course.modules
    .map((module) => `- ${module.title}: ${module.topics.join(", ") || "mavzular ko'rsatilmagan"}`)
    .join("\n");
  const mastery = ctx.mastery
    .map((item) => `- ${item.outcomeTitle}: ${item.percentage}% (${item.evidence ? "dalil bor" : "hali dalil yo'q"})`)
    .join("\n");

  return `Siz UniLoop AI o'quv reja tuzuvchisiz. Talabaning profili, kurs mazmuni va o'zlashtirish dalillari asosida shaxsiy o'quv reja tuzing.

${GROUNDING_RULES}
- Faqat berilgan kurs outcomes nomlaridan foydalaning.
- Har bir vazifa aynan bitta outcomeTitle bilan bog'langan bo'lsin.
- 3-6 ta amaliy, ketma-ket vazifa tuzing; vazifalar kurs mazmuni va talabaning bo'shliqlariga mos bo'lsin.
- Talaba profilida yo'q tajriba yoki natijani taxmin qilmang.

TALABA PROFILI:
- Mutaxassislik: ${ctx.studentProfile.major || "ko'rsatilmagan"}
- Fakultet: ${ctx.studentProfile.faculty || "ko'rsatilmagan"}
- Kurs bosqichi: ${ctx.studentProfile.studyYear ?? "ko'rsatilmagan"}
- Maqsadli yo'nalish: ${ctx.studentProfile.targetRole || "ko'rsatilmagan"}
- Qiziqishlar: ${ctx.studentProfile.interests.join(", ") || "ko'rsatilmagan"}
- Asosiy ko'nikmalar: ${ctx.studentProfile.coreSkills.join(", ") || "ko'rsatilmagan"}

KURS:
- Nomi: ${ctx.course.title}
- Fan: ${ctx.course.subject || "ko'rsatilmagan"}
- Tavsif: ${ctx.course.description || "ko'rsatilmagan"}
- Prerequisites: ${ctx.course.prerequisites.join(", ") || "yo'q"}
- O'quv natijalari:
${outcomes}
- Modullar va mavzular:
${modules || "- modullar ko'rsatilmagan"}

O'ZLASHTIRISH:
${mastery || "- hali baholash dalili yo'q"}

Faqat quyidagi JSON formatida javob bering:
{
  "rationaleUz": "Reja nima uchun aynan shu tartibda tuzilganini 2-3 jumlada tushuntiring",
  "tasks": [
    { "outcomeTitle": "Kursdagi aniq outcome nomi", "title": "Qisqa vazifa nomi", "reason": "Bu vazifa nima uchun kerakligini tushuntiring" }
  ]
}`;
}

export function buildProfessorRecommendationPrompt(ctx: ProfessorRecommendationContext): string {
  const masteryList = ctx.masteryOutcomes
    .map((m) => `  - ${m.title}: ${m.percentage}% (${m.status})`)
    .join('\n');
  const verifiedList = ctx.verifiedSkills
    .map((s) => `  - ${s.skill}: ${s.score}%`)
    .join('\n');

  return `
Siz UniLoop AI yordamchisisiz. Professor uchun talaba haqida tavsiya qoralamasi tuzing. Bu faqat qoralama — professor yakuniy qarorni o'zi qabul qiladi.

${GROUNDING_RULES}

TALABA MA'LUMOTLARI:
- Ism: ${ctx.studentName}
- Maqsadli yo'nalish: ${ctx.targetRole}
- Tayorlik darajasi (backend tomonidan hisoblangan): ${ctx.readinessLevel}
- Asosiy ko'nikmalar: ${ctx.coreSkillsCovered}/${ctx.coreSkillsTotal}
- Loyiha dalili: ${ctx.projectEvidence ? 'mavjud' : 'yo\'q'}
- Ko'nikma bo'shliqlari: ${ctx.skillGaps.join(', ') || 'yo\'q'}

O'ZLASHTIRILGAN MAVZULAR:
${masteryList || '  - ma\'lumot yo\'q'}

TASDIQLANGAN KO'NIKMALAR:
${verifiedList || '  - hali tasdiqlanmagan'}

Quyidagi JSON formatida javob bering (boshqa hech narsa yozmang):
{
  "summaryUz": "Talabaning kuchli tomonlarini dalillarga asoslanib 3-4 jumlada tasvirlab bering",
  "developmentNoteUz": "Rivojlanish uchun qaysi sohalar ustida ishlash kerakligini 1-2 jumlada ayting"
}
`.trim();
}

export function buildSkillGapPrompt(ctx: SkillGapContext): string {
  return `
Siz UniLoop AI yordamchisisiz. Talabaning ko'nikma bo'shlig'ini tushuntiring.

${GROUNDING_RULES}

KO'NIKMA BO'SHLIG'I:
- Ko'nikma: ${ctx.skill}
- Maqsadli yo'nalish: ${ctx.targetRole}
- Hozirgi ball (agar mavjud bo'lsa): ${ctx.currentScore !== null ? `${ctx.currentScore}%` : 'hali baholanmagan'}
- Bog'liq o'rganilgan mavzular: ${ctx.relatedMasteryTitles.join(', ') || 'yo\'q'}

Quyidagi JSON formatida javob bering (boshqa hech narsa yozmang):
{
  "skill": "${ctx.skill}",
  "explanationUz": "Bu ko'nikma bo'shlig'i nimani anglatishini 2 jumlada tushuntiring",
  "nextStepUz": "Talaba bu bo'shliqni qoplash uchun nima qilishi kerakligini 1-2 jumlada ayting"
}
`.trim();
}

export function buildVacancyQueryPrompt(ctx: VacancyQueryContext): string {
  return `Siz ish qidirish uchun xavfsiz qidiruv so'zlarini tanlaysiz. Faqat rol va qiziqishlar asosida inglizcha 1-3 qisqa lavozim nomini qaytaring. Shaxsiy ma'lumot, kompaniya yoki ko'nikma o'ylab topmang.\nRol: ${ctx.targetRole}\nQiziqishlar: ${ctx.interests.join(', ') || 'yoq'}\nZaxira: ${ctx.fallbackQueries.join(', ')}\nFaqat JSON: {"queries":["junior developer"]}`;
}

export function buildCareerProfileAnalysisPrompt(ctx: CareerProfileAnalysisContext): string {
  return `Siz UniLoop AI kasbiy yo'nalish tahlilchisisiz. Talabaning o'zi bergan ma'lumotlarini umumlashtiring. Yo'nalishni IT bilan almashtirmang: agar u biologiya, tibbiyot, huquq, dizayn yoki boshqa sohani aytsa, o'sha soha doirasida qoling. Ism, kompaniya, diplom, tajriba yoki yutuqlarni o'ylab topmang.

TALABA MA'LUMOTLARI:
- Talaba aytgan yo'nalish: ${ctx.statedDirection}
- Mutaxassislik: ${ctx.major}
- Qiziqishlar: ${ctx.interests.join(', ') || "ko'rsatilmagan"}
- O'zi ko'rsatgan ko'nikmalar: ${ctx.skills.join(', ') || "ko'rsatilmagan"}

Quyidagi JSON formatida javob bering (boshqa hech narsa yozmang):
{
  "targetRole": "talaba ma'lumotlariga mos, qisqa kasbiy yo'nalish",
  "coreSkills": ["ushbu yo'nalish uchun 3-6 asosiy ko'nikma"],
  "vacancyQueries": ["1-3 qisqa inglizcha vakansiya qidiruv so'zi"]
}`;
}
