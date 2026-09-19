import { OpportunityType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const namespace = "uniloop-fictional-opportunity-2026";

type VacancyBlueprint = {
  role: string;
  roleId: string;
  skills: string[];
  category: string;
};

const blueprints: VacancyBlueprint[] = [
  { role: "Frontend dasturchi", roleId: "role-frontend-developer", skills: ["React", "TypeScript", "HTML/CSS"], category: "Frontend" },
  { role: "Backend dasturchi", roleId: "role-backend-developer", skills: ["Node.js", "REST APIs", "PostgreSQL"], category: "Backend" },
  { role: "Data analyst", roleId: "role-data-analyst", skills: ["Python", "SQL", "Data Analysis"], category: "Data" },
  { role: "Machine learning amaliyotchisi", roleId: "role-machine-learning", skills: ["Python", "Machine Learning", "Pandas"], category: "AI" },
  { role: "DevOps muhandisi", roleId: "role-devops-engineer", skills: ["Docker", "Linux", "CI/CD"], category: "Infrastructure" },
  { role: "UI/UX dizayner", roleId: "role-ui-ux-designer", skills: ["Figma", "UX Research", "Prototyping"], category: "Design" },
  { role: "QA muhandisi", roleId: "role-qa-engineer", skills: ["Test cases", "API Testing", "Playwright"], category: "Quality" },
  { role: "Business analyst", roleId: "role-business-analyst", skills: ["Requirements", "SQL", "Communication"], category: "Business" },
  { role: "Mobile dasturchi", roleId: "role-mobile-developer", skills: ["React Native", "JavaScript", "Mobile UI"], category: "Mobile" },
  { role: "Kiberxavfsizlik amaliyotchisi", roleId: "role-cybersecurity", skills: ["Security", "Networking", "Linux"], category: "Security" },
  { role: "Cloud muhandisi", roleId: "role-cloud-engineer", skills: ["Cloud", "Docker", "Linux"], category: "Cloud" },
  { role: "Product menejer assistenti", roleId: "role-product-manager", skills: ["Product discovery", "Analytics", "Communication"], category: "Product" },
];

const companies = [
  "Tashkent Digital Lab", "Silk Road Systems", "Navoi Data Works", "Samarkand Product Studio",
  "Fergana Cloud", "Orienta Fintech", "Zarafshan Analytics", "Atlas Education Tech", "Qanot Mobility",
];
const locations = ["Toshkent", "Samarqand", "Farg‘ona", "Buxoro", "Masofadan", "Gibrid — Toshkent"];
const formats = ["gibrid", "masofadan", "ofisda", "moslashuvchan jadval"];

function requirePermission() {
  if (process.env.DEMO_OPPORTUNITIES_PROVISIONING !== "true")
    throw new Error("Set DEMO_OPPORTUNITIES_PROVISIONING=true to provision fictional opportunities.");
  if (process.env.ALLOW_MANAGED_DEMO_PROVISIONING !== "true")
    throw new Error("Set ALLOW_MANAGED_DEMO_PROVISIONING=true after confirming this additive demo data is intended.");
}

function vacancyData(index: number) {
  const blueprint = blueprints[index % blueprints.length];
  const company = companies[index % companies.length];
  const location = locations[index % locations.length];
  const kind = index % 9 === 0 ? OpportunityType.INTERNSHIP : OpportunityType.JOB;
  const seniority = kind === OpportunityType.INTERNSHIP ? "amaliyot" : index % 3 === 0 ? "junior" : "entry-level";
  const requiredSkills = [...blueprint.skills, index % 2 === 0 ? "Git" : "Muloqot"];
  const deadline = new Date(Date.UTC(2026, 8, 22 + (index % 21))).toISOString().slice(0, 10);
  const title = `${seniority === "amaliyot" ? "Amaliyotchi" : "Junior"} ${blueprint.role} — ${company}`;
  return {
    type: kind,
    title,
    description: `${blueprint.category} yo‘nalishida ${formats[index % formats.length]} ${seniority} imkoniyat. ` +
      `${company} jamoasi mentorlik, kichik sprint vazifalari va portfolio uchun yakuniy ish taklif qiladi. ` +
      `Talablar: ${requiredSkills.join(", ")}. Ariza uchun demo muddat: ${deadline}. ` +
      "Bu haqiqiy internet vakansiyasi emas, UniLoop platformasidagi fictional demo opportunity.",
    requiredSkills,
    targetRoleIds: [blueprint.roleId],
    gapSkills: requiredSkills.slice(0, 2),
    collaborative: index % 4 !== 0,
    location,
    source: "UNI_LOOP_FICTIONAL_DEMO",
    externalId: `${namespace}:${String(index + 1).padStart(3, "0")}`,
    sourceUrl: null,
    externalFetchedAt: new Date(),
  };
}

async function main() {
  requirePermission();
  const records = Array.from({ length: 108 }, (_, index) => vacancyData(index));
  // Use isolated upserts rather than a large batch transaction: a rerun is
  // safe after an interrupted connection and never touches other namespaces.
  for (const record of records)
    await prisma.opportunity.upsert({
      where: { externalId: record.externalId },
      create: record,
      update: record,
    });
  const total = await prisma.opportunity.count({
    where: { externalId: { startsWith: namespace } },
  });
  const byType = await prisma.opportunity.groupBy({
    by: ["type"],
    where: { externalId: { startsWith: namespace } },
    _count: { _all: true },
  });
  console.log(JSON.stringify({ provisioned: total, source: "UNI_LOOP_FICTIONAL_DEMO", byType }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Opportunity provisioning failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
