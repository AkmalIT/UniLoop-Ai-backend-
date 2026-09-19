import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type CareerInput = {
  targetRole: string;
  interests: string[];
  coreSkills: string[];
  vacancyQueries: string[];
  userId: string;
};

const companies = ["Tashkent Digital", "UzCloud Labs", "Silk Road Tech"];
const locations = ["Toshkent", "Samarqand", "Masofadan"];

/** Generates local demo vacancies; profile data never leaves UniLoop. */
@Injectable()
export class JobSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshForProfile(profile: CareerInput) {
    const role = profile.targetRole.trim() || "Junior mutaxassis";
    const skills = unique([...profile.coreSkills, ...profile.interests]).slice(0, 6);
    const requirements = skills.length ? skills : ["Muloqot", "Muammoni hal qilish"];
    const roleKey = slug(role);
    const records = [
      { suffix: "intern", title: `${role} — amaliyotchi`, level: "Amaliyot", work: "mentor bilan amaliy vazifalar" },
      { suffix: "junior", title: `Junior ${role}`, level: "Boshlang‘ich lavozim", work: "real mahsulot jamoasi" },
      { suffix: "project", title: `${role} uchun loyiha assistenti`, level: "Loyiha tajribasi", work: "portfolio loyihasi" },
    ];
    await Promise.all(records.map((record, index) => this.prisma.opportunity.upsert({
      where: { externalId: `uniloop-simulated:${roleKey}:${record.suffix}` },
      create: this.vacancyData(record, index, role, requirements, profile.userId),
      update: this.vacancyData(record, index, role, requirements, profile.userId),
    })));
  }

  private vacancyData(record: { suffix: string; title: string; level: string; work: string }, index: number, role: string, skills: string[], userId: string) {
    return {
      type: "JOB" as const,
      title: record.title.slice(0, 250),
      description: `${record.level}. ${companies[index]} jamoasida ${role} yo‘nalishida ${record.work}. Kerakli ko‘nikmalar: ${skills.join(", ")}. Bu UniLoop tomonidan profilga moslab yaratilgan demo vakansiya.`,
      requiredSkills: skills,
      targetRoleIds: [slug(role)],
      gapSkills: skills.slice(0, 3),
      location: locations[index],
      source: "UNI_LOOP_SIMULATED",
      externalId: `uniloop-simulated:${slug(role)}:${record.suffix}`,
      sourceUrl: null,
      externalFetchedAt: new Date(),
      relatedUserId: userId,
    };
  }
}

function unique(values: string[]) { return [...new Set(values.map((value) => value.trim()).filter(Boolean))]; }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general"; }
