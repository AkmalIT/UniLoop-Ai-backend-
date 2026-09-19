import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackQueryDto } from "./dto/feedback-query.dto";
import { UpdateFeedbackStatusDto } from "./dto/update-feedback-status.dto";
import { FeedbackService } from "./feedback.service";

@ApiTags("feedback")
@ApiBearerAuth()
@Controller("feedback")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}
  @Get("me") mine(@CurrentUser() user: AuthenticatedUser) { return this.feedback.mine(user.id); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFeedbackDto) { return this.feedback.create(user.id, dto); }
}

@ApiTags("admin feedback")
@ApiBearerAuth()
@Controller("admin/feedback")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}
  @Get() list(@Query() query: FeedbackQueryDto) { return this.feedback.listForAdmin(query); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFeedbackStatusDto) { return this.feedback.updateStatus(id, dto); }
}
