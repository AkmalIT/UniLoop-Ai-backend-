import {
  CareerReadinessLevel,
  EndorsementStatus,
  InterventionStatus,
  MasteryStatus,
  OpportunityType,
  ProfessorEndorsement,
  RecommendationStatus,
} from "@prisma/client";
export const masteryLevels = {
  MASTERED: "MASTERED",
  DEVELOPING: "DEVELOPING",
  NEEDS_ATTENTION: "NEEDS_SUPPORT",
  NOT_ASSESSED: "NEEDS_SUPPORT",
} as const satisfies Record<MasteryStatus, string>;
export const interventionStates = {
  PLANNED: "SUGGESTED",
  ACTIVE: "APPROVED",
  COMPLETED: "APPROVED",
  REJECTED: "REJECTED",
} as const satisfies Record<InterventionStatus, string>;
export const opportunityTypes = {
  PERSON: "PEER",
  MENTOR: "MENTOR",
  CLUB: "CLUB",
  PROJECT: "PROJECT",
  INTERNSHIP: "INTERNSHIP",
  JOB: "JOB",
} as const satisfies Record<OpportunityType, string>;
export const recommendationStates = {
  NEW: "NEW",
  VIEWED: "SAVED",
  INTERESTED: "ACCEPTED",
  DISMISSED: "DISMISSED",
} as const satisfies Record<RecommendationStatus, string>;
export const recommendationDatabase = {
  NEW: RecommendationStatus.NEW,
  SAVED: RecommendationStatus.VIEWED,
  ACCEPTED: RecommendationStatus.INTERESTED,
  DISMISSED: RecommendationStatus.DISMISSED,
} as const;
export const readinessStates = {
  LEARNING_FOUNDATIONS: "FOUNDATION",
  PROJECT_READY: "PROJECT_READY",
  INTERNSHIP_READY: "INTERNSHIP_READY",
  JUNIOR_READY: "JUNIOR_READY",
} as const satisfies Record<CareerReadinessLevel, string>;
export const endorsementStates = {
  PENDING: "REQUESTED",
  ENDORSED: "APPROVED",
  DECLINED: "DECLINED",
  NEEDS_DEVELOPMENT: "NEEDS_DEVELOPMENT",
} as const satisfies Record<EndorsementStatus, string>;
export const endorsementDatabase = {
  APPROVED: EndorsementStatus.ENDORSED,
  DECLINED: EndorsementStatus.DECLINED,
  NEEDS_DEVELOPMENT: EndorsementStatus.NEEDS_DEVELOPMENT,
} as const;
export const roleIds = {
  FRONTEND_DEVELOPER: "role-frontend-developer",
  BACKEND_DEVELOPER: "role-backend-developer",
  DATA_ANALYST: "role-data-analyst",
  FULLSTACK_DEVELOPER: "role-fullstack-developer",
  DEVOPS_ENGINEER: "role-devops-engineer",
  BIOLOGIST: "role-biologist",
  BIOTECHNOLOGIST: "role-biotechnologist",
} as const satisfies Record<string, string>;
export const roleLabels = {
  FRONTEND_DEVELOPER: "Frontend dasturchi",
  BACKEND_DEVELOPER: "Backend dasturchi",
  DATA_ANALYST: "Maʼlumotlar tahlilchisi",
  FULLSTACK_DEVELOPER: "Fullstack dasturchi",
  DEVOPS_ENGINEER: "DevOps muhandisi",
  BIOLOGIST: "Biolog",
  BIOTECHNOLOGIST: "Biotexnolog",
} as const satisfies Record<string, string>;
export const percent = (value: number) =>
  Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
export const average = (values: number[]): number =>
  values.length
    ? percent(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
export const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
export function summary(
  profileId: string,
  name: string,
  role: "STUDENT" | "PROFESSOR",
  faculty = "",
) {
  return {
    id: profileId,
    fullName: name,
    role,
    university: "",
    faculty,
    universityId: null,
    facultyId: null,
    avatarLabel: name
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join(""),
  };
}
export function endorsementDto(record: ProfessorEndorsement) {
  const history = Array.isArray(record.history)
    ? record.history.filter(
        (value): value is { status: string; recordedAt: string } =>
          !!value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          typeof value.status === "string" &&
          typeof value.recordedAt === "string" &&
          Object.values(endorsementStates).includes(
            value.status as "REQUESTED",
          ),
      )
    : [];
  return {
    id: record.id,
    studentId: record.studentId,
    professorId: record.professorId,
    opportunityId: record.opportunityId,
    targetRole: record.targetRole ?? "Kasbiy rivojlanish",
    consentToReview: record.consentToReview,
    status: endorsementStates[record.status],
    professorFeedback: record.comment,
    requestedAt: record.createdAt.toISOString(),
    history,
  };
}
