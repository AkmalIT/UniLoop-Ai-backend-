import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { firstValueFrom, of } from "rxjs";
import { AuthService } from "../src/modules/auth/auth.service";
import { JwtStrategy } from "../src/modules/auth/jwt.strategy";
import { hashPassword, verifyPassword } from "../src/common/security/password";
import { ApiEnvelopeInterceptor } from "../src/common/http/api-envelope.interceptor";
import { ApiExceptionFilter } from "../src/common/http/api-exception.filter";
import { corsOrigins } from "../src/common/config/cors.config";
import {
  AcademicService,
  gradeAnswers,
  safeAssessment,
} from "../src/modules/integration/academic.service";
import {
  AnswersDto,
  AudienceDto,
} from "../src/modules/integration/integration.dto";
import { RegisterDto } from "../src/modules/auth/dto/register.dto";
import {
  SurveysController,
  surveyUrl,
} from "../src/modules/integration/integration.controller";
import {
  endorsementStates,
  interventionStates,
  masteryLevels,
  opportunityTypes,
  readinessStates,
  recommendationStates,
} from "../src/modules/integration/public-mappers";
import { CareerApiService } from "../src/modules/integration/career-api.service";

const user = {
  id: "user-one",
  name: "Dilnoza Karimova",
  email: "student@uniloop.local",
  role: "STUDENT" as const,
  passwordHash: hashPassword("password123"),
  studentProfile: { id: "student-one" },
  professorProfile: null,
};
const question = {
  id: "question-one",
  assessmentId: "assessment-one",
  prompt: "Savol",
  type: "MULTIPLE_CHOICE" as const,
  weight: new Prisma.Decimal(1),
  maxScore: new Prisma.Decimal(1),
  correctAnswer: "option-right",
  options: [
    { id: "option-right", text: "To‘g‘ri", correct: true },
    { id: "option-wrong", text: "Noto‘g‘ri" },
  ],
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  outcomeLinks: [
    {
      id: "link",
      questionId: "question-one",
      learningOutcomeId: "outcome-one",
      weight: new Prisma.Decimal(1),
    },
  ],
};
const assessment = {
  id: "assessment-one",
  courseId: "course-one",
  title: "Diagnostika",
  type: "DIAGNOSTIC" as const,
  startsAt: null,
  dueAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  questions: [question],
  course: {
    id: "course-one",
    title: "Kurs",
    code: "CS1",
    description: null,
    professorId: "professor-one",
    createdAt: new Date(),
    updatedAt: new Date(),
    learningOutcomes: [],
  },
};
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const validate = (
  value: unknown,
  metatype: typeof AnswersDto | typeof RegisterDto | typeof AudienceDto,
) => pipe.transform(value, { type: "body", metatype });

describe("v1 authentication trust boundary", () => {
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const jwt = { signAsync: jest.fn().mockResolvedValue("test-access-token") };
  const auth = new AuthService(prisma as never, jwt as unknown as JwtService);
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
  });
  it("uses salted scrypt and safely rejects corrupt/legacy hashes", () => {
    expect(verifyPassword("password123", user.passwordHash)).toBe(true);
    expect(verifyPassword("wrong", user.passwordHash)).toBe(false);
    expect(verifyPassword("password123", "salt:sha256")).toBe(false);
    expect(verifyPassword("password123", "scrypt$bad$short")).toBe(false);
    expect(hashPassword("password123")).not.toEqual(user.passwordHash);
  });
  it("normalizes login email and returns profile identity without password hash", async () => {
    const response = await auth.login({
      email: " STUDENT@UNILOOP.LOCAL ",
      password: "password123",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "student@uniloop.local" },
    });
    expect(response.user).toMatchObject({
      id: "user-one",
      profileId: "student-one",
      fullName: user.name,
    });
    expect(response.user).not.toHaveProperty("passwordHash");
  });
  it("rejects wrong credentials and missing users", async () => {
    await expect(
      auth.login({ email: user.email, password: "incorrect" }),
    ).rejects.toThrow(UnauthorizedException);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      auth.login({ email: user.email, password: "password123" }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(auth.me(user.id)).rejects.toThrow(UnauthorizedException);
  });
  it("returns controlled duplicate-email conflicts", async () => {
    await expect(
      auth.register({
        name: "Student",
        email: user.email,
        password: "password123",
        role: "STUDENT",
      }),
    ).rejects.toThrow(ConflictException);
  });
  it("rejects ADMIN at both DTO and service boundaries", async () => {
    const input = {
      name: "Admin",
      email: "admin@uniloop.local",
      password: "password123",
      role: "ADMIN" as const,
    };
    await expect(validate(input, RegisterDto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(auth.register(input)).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("does not accept stale JWT identity after deletion", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: "unit-test-secret" }),
      prisma as never,
    );
    await expect(
      strategy.validate({ sub: user.id, email: user.email, role: "STUDENT" }),
    ).rejects.toThrow(UnauthorizedException);
  });
  it("uses current database role instead of a stale token role", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, role: "PROFESSOR" });
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: "unit-test-secret" }),
      prisma as never,
    );
    expect(
      (
        await strategy.validate({
          sub: user.id,
          email: user.email,
          role: "STUDENT",
        })
      ).role,
    ).toBe("PROFESSOR");
  });
});
describe("safe assessments and deterministic grading", () => {
  it("never exposes a grading key or correct-option flag", () => {
    const serialized = JSON.stringify(safeAssessment(assessment));
    expect(serialized).not.toMatch(
      /correctAnswer|"correct"|maxScore|outcomeLinks/,
    );
    expect(safeAssessment(assessment).questions[0].options).toEqual([
      { id: "option-right", text: "To‘g‘ri" },
      { id: "option-wrong", text: "Noto‘g‘ri" },
    ]);
  });
  it("rejects client identities, grades and hidden nested fields", async () => {
    for (const body of [
      {
        studentId: user.id,
        answers: [{ questionId: question.id, optionId: "option-right" }],
      },
      {
        answers: [
          { questionId: question.id, optionId: "option-right", score: 100 },
        ],
      },
      {
        scorePercentage: 100,
        answers: [{ questionId: question.id, optionId: "option-right" }],
      },
    ])
      await expect(validate(body, AnswersDto)).rejects.toThrow(
        BadRequestException,
      );
  });
  it("grades choices server-side and rejects foreign, duplicate or missing questions", () => {
    expect(
      gradeAnswers(assessment, {
        answers: [{ questionId: question.id, optionId: "option-right" }],
      })[0].score,
    ).toBe(1);
    expect(
      gradeAnswers(assessment, {
        answers: [{ questionId: question.id, optionId: "option-wrong" }],
      })[0].score,
    ).toBe(0);
    for (const answers of [
      [],
      [{ questionId: "foreign", optionId: "option-right" }],
      [
        { questionId: question.id, optionId: "option-right" },
        { questionId: question.id, optionId: "option-right" },
      ],
      [{ questionId: question.id, optionId: "nonexistent" }],
      [{ questionId: question.id, optionId: "option-right", answer: "extra" }],
    ])
      expect(() => gradeAnswers(assessment, { answers })).toThrow(
        BadRequestException,
      );
  });
  it("uses explicit normalized short-answer comparison, not AI", () => {
    const short = {
      ...assessment,
      questions: [
        {
          ...question,
          type: "SHORT_ANSWER" as const,
          correctAnswer: "Base Case",
          options: null,
        },
      ],
    };
    expect(
      gradeAnswers(short, {
        answers: [{ questionId: question.id, answer: " BASE   case " }],
      })[0].score,
    ).toBe(1);
    expect(
      gradeAnswers(short, {
        answers: [{ questionId: question.id, answer: "Other" }],
      })[0].score,
    ).toBe(0);
  });
  it("enforces student enrollment and professor course ownership", async () => {
    const prisma = {
      studentProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: "student-one" }),
      },
      professorProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: "professor-other" }),
      },
      course: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ enrollments: [], professorId: "professor-one" }),
      },
    };
    const service = new AcademicService(prisma as never, {} as never);
    await expect(service.access(user, "course-one")).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.access({ ...user, role: "PROFESSOR" }, "course-one"),
    ).rejects.toThrow(ForbiddenException);
  });
});
describe("consent, surveys and shared serialization", () => {
  it("requires both an actual teaching relationship and live consent/request", async () => {
    const prisma = {
      enrollment: { findFirst: jest.fn().mockResolvedValue(null) },
      consent: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ professorReferralAllowed: false }),
      },
      professorEndorsement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CareerApiService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.reviewAccess("professor-one", "student-one"),
    ).rejects.toThrow(ForbiddenException);
    prisma.enrollment.findFirst.mockResolvedValue({
      id: "enrollment",
    } as never);
    await expect(
      service.reviewAccess("professor-one", "student-one"),
    ).rejects.toThrow(ForbiddenException);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "",
    "invalid",
    "https://name:pass@example.com",
  ])("rejects unsafe survey URL %s", (value) => {
    expect(surveyUrl(value)).toBeNull();
  });
  it("normalizes valid HTTP(S) links and returns invalid configuration inactive", async () => {
    const surveys = new SurveysController(
      new ConfigService({ SURVEY_STUDENT_URL: "javascript:alert(1)" }),
    );
    expect(surveys.get(user, { audience: "STUDENT" })[0]).toMatchObject({
      active: false,
      externalUrl: null,
    });
    expect(() => surveys.get(user, { audience: "PROFESSOR" })).toThrow(
      ForbiddenException,
    );
    expect(surveyUrl("https://example.com")).toBe("https://example.com/");
    await expect(validate({ audience: "ADMIN" }, AudienceDto)).rejects.toThrow(
      BadRequestException,
    );
  });
  it("wraps responses exactly once and never leaks exception internals", async () => {
    const interceptor = new ApiEnvelopeInterceptor();
    expect(
      await firstValueFrom(
        interceptor.intercept({} as never, { handle: () => of([1, 2]) }),
      ),
    ).toEqual({ data: [1, 2] });
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) };
    new ApiExceptionFilter().catch(
      new Error("secret connection string"),
      host as never,
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_ERROR",
        message: "Request could not be completed",
        details: [],
      },
    });
  });
  it("rejects wildcard and path-bearing CORS origins", () => {
    expect(corsOrigins()).toEqual(["http://localhost:3000"]);
    for (const origin of ["*", "https://example.com/path", "null"])
      expect(() => corsOrigins(origin)).toThrow();
  });
  it("covers every database enum at the public boundary", () => {
    expect(Object.keys(masteryLevels)).toHaveLength(4);
    expect(Object.keys(interventionStates)).toHaveLength(4);
    expect(Object.keys(opportunityTypes)).toHaveLength(6);
    expect(Object.keys(readinessStates)).toHaveLength(4);
    expect(Object.keys(recommendationStates)).toHaveLength(4);
    expect(Object.keys(endorsementStates)).toHaveLength(4);
  });
});
