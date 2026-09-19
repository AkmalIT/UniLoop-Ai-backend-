import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AcademicService } from "./academic.service";
import { CareerApiService } from "./career-api.service";
import {
  AnswersDto,
  AudienceDto,
  ClubDto,
  CreateManagedCourseDto,
  EndorsementDecisionDto,
  EndorsementDto,
  EnrollmentRequestDecisionDto,
  GenerationDto,
  InterventionDecisionDto,
  MaterialDto,
  ProfileDto,
  RecommendationDto,
  UpdateManagedCourseDto,
  AiSuggestionRequestDto,
  AiSuggestionApprovalDto,
} from "./integration.dto";

@ApiTags("student")
@ApiBearerAuth()
@Controller("students/me")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("STUDENT")
export class StudentApiController {
  constructor(
    private readonly academic: AcademicService,
    private readonly career: CareerApiService,
  ) {}
  @Get("dashboard") dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.dashboard(user);
  }
  @Get("progress") progress(@CurrentUser() user: AuthenticatedUser) {
    return this.career.progress(user);
  }
  @Get("courses") courses(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.courses(user);
  }
  @Get("course-catalog") catalog(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.courseCatalog(user);
  }
  @Get("recommended-courses") recommendedCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.recommendedCourses(user);
  }
  @Post("courses/:id/enrollment") enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.requestEnrollment(user, id);
  }
  @Post("courses/:id/enrollment-requests") requestEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.requestEnrollment(user, id);
  }
  @Get("courses/:id") course(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.course(user, id);
  }
  @Get("assessments/:id") assessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.assessment(user, id);
  }
  @Post("assessments/:id/submissions") submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() input: AnswersDto,
  ) {
    return this.academic.submit(user, id, input);
  }
  @Get("mastery/:id") mastery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.mastery(user, id);
  }
  @Get("learning-plans/:id") plan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.learningPlan(user, id);
  }
  @Post("learning-plans/:id") generatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.learningPlan(user, id, true);
  }
  @Get("opportunity-dashboard") opportunities(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.career.dashboard(user);
  }
  @Patch("career-profile") profile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ProfileDto,
  ) {
    return this.career.updateProfile(user, input);
  }
  @Get("recommendations") async recommendations(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.career.recommendations(await this.academic.profile(user));
  }
  @Patch("recommendations/:id") recommendation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() input: RecommendationDto,
  ) {
    return this.career.updateRecommendation(user, id, input);
  }
  @Post("endorsement-requests") request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: EndorsementDto,
  ) {
    return this.career.request(user, input);
  }
  @Post("next-step") nextStep(@CurrentUser() user: AuthenticatedUser) {
    return this.career.nextStep(user);
  }
  @Post("clubs") createClub(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ClubDto,
  ) {
    return this.career.createClub(user, input);
  }
  @Get("clubs") clubs(@CurrentUser() user: AuthenticatedUser) {
    return this.career.clubs(user);
  }
  @Post("clubs/:id/join") joinClub(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.career.joinClub(user, id);
  }
  @Post("recommendations/:id/explanation") explain(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.career.explain(user, id);
  }
  @Post("skill-gaps/:id/explanation") gap(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.career.explainGap(user, id);
  }
}
@ApiTags("professor")
@ApiBearerAuth()
@Controller("professors/me")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("PROFESSOR")
export class ProfessorApiController {
  constructor(
    private readonly academic: AcademicService,
    private readonly career: CareerApiService,
  ) {}
  @Get("dashboard") dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.dashboard(user);
  }
  @Get("courses") courses(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.courses(user);
  }
  @Post("courses") createCourse(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateManagedCourseDto,
  ) {
    return this.academic.createCourse(user, input);
  }
  @Get("courses/:id") course(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.course(user, id);
  }
  @Patch("courses/:id") updateCourse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() input: UpdateManagedCourseDto) {
    return this.academic.updateCourse(user, id, input);
  }
  @Post("courses/:id/publish") publishCourse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) { return this.academic.publishCourse(user, id); }
  @Post("courses/:id/archive") archiveCourse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) { return this.academic.archiveCourse(user, id); }
  @Post("courses/:id/ai-suggestions") aiSuggestions(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() input: AiSuggestionRequestDto) {
    return this.academic.aiSuggestions(user, id, input.instruction);
  }
  @Post("courses/:courseId/ai-suggestions/:suggestionId/approval") approveAiSuggestion(@CurrentUser() user: AuthenticatedUser, @Param("courseId") courseId: string, @Param("suggestionId") suggestionId: string, @Body() input: AiSuggestionApprovalDto) {
    return this.academic.approveAiSuggestion(user, courseId, suggestionId, input.approved, input.approvedDraft);
  }
  @Get("courses/:id/enrollment-requests") enrollmentRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.enrollmentRequests(user, id);
  }
  @Patch("courses/:courseId/enrollment-requests/:requestId") decideEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("requestId") requestId: string,
    @Body() input: EnrollmentRequestDecisionDto,
  ) {
    return this.academic.decideEnrollmentRequest(
      user,
      courseId,
      requestId,
      input,
    );
  }
  @Get("assessments/:id") assessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.assessment(user, id);
  }
  @Get("courses/:id/assessments") assessments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.assessments(user, id);
  }
  @Post("courses/:id/materials") material(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() input: MaterialDto,
  ) {
    return this.academic.material(user, id, input);
  }
  @Post("courses/:id/outcomes/extract") async extract(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.academic.access(user, id);
    throw new ServiceUnavailableException(
      "Outcome extraction unavailable; use configured course outcomes",
    );
  }
  @Post("courses/:id/assessments/generate") async generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() input: GenerationDto,
  ) {
    await this.academic.access(user, id);
    throw new ServiceUnavailableException(
      `Automatic ${input.type} authoring unavailable; use configured assessments`,
    );
  }
  @Get("courses/:id/insights") insights(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.insights(user, id);
  }
  @Get("courses/:id/interventions") interventions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.interventions(user, id);
  }
  @Post("courses/:id/interventions") suggest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.academic.interventions(user, id, true);
  }
  @Patch("courses/:courseId/interventions/:id") decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("id") id: string,
    @Body() input: InterventionDecisionDto,
  ) {
    return this.academic.decideIntervention(user, courseId, id, input);
  }
  @Get("growth-plans") growth(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.growthPlan(user);
  }
  @Post("growth-plans") generateGrowth(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.growthPlan(user, true);
  }
  @Get("referral-candidates") referrals(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.career.candidates(user);
  }
  @Get("students/:id/evidence") evidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.career.evidence(user, id);
  }
  @Post("endorsements") endorse(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: EndorsementDecisionDto,
  ) {
    return this.career.decide(user, input);
  }
  @Post("students/:id/recommendation-draft") draft(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.career.draft(user, id);
  }
}
export function surveyUrl(value?: string): string | null {
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
@ApiTags("surveys")
@ApiBearerAuth()
@Controller("surveys")
@UseGuards(JwtAuthGuard)
export class SurveysController {
  constructor(private readonly config: ConfigService) {}
  @Get() get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AudienceDto,
  ) {
    if (user.role !== query.audience) throw new ForbiddenException();
    const externalUrl = surveyUrl(
      this.config.get<string>(`SURVEY_${query.audience}_URL`),
    );
    return [
      {
        id: `survey-${query.audience.toLowerCase()}`,
        title: "Universitet tajribasi so‘rovnomasi",
        description:
          "Taʼlim jarayonini yaxshilash uchun fikringizni bildiring.",
        audience: query.audience,
        estimatedMinutes: 5,
        active: externalUrl !== null,
        externalUrl,
      },
    ];
  }
}
