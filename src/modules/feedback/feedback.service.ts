import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackQueryDto } from "./dto/feedback-query.dto";
import { UpdateFeedbackStatusDto } from "./dto/update-feedback-status.dto";

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    const feedback = await this.prisma.feedback.create({
      data: { userId, category: dto.category, rating: dto.rating, title: dto.title, message: dto.message, anonymous: dto.anonymous ?? false },
    });
    return this.publicItem(feedback);
  }

  async mine(userId: string) {
    const items = await this.prisma.feedback.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return items.map((item) => this.publicItem(item));
  }

  async listForAdmin(query: FeedbackQueryDto) {
    const where: Prisma.FeedbackWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.role ? { user: { role: query.role } } : {}),
    };
    const items = await this.prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, role: true } } },
    });
    return items.map((item) => ({
      ...this.publicItem(item),
      submitter: item.anonymous ? null : { name: item.user.name, role: item.user.role },
    }));
  }

  async updateStatus(id: string, dto: UpdateFeedbackStatusDto) {
    const item = await this.prisma.feedback.update({ where: { id }, data: { status: dto.status } }).catch(() => null);
    if (!item) throw new NotFoundException("Feedback not found");
    return this.publicItem(item);
  }

  private publicItem(item: { id: string; category: string; rating: number | null; title: string; message: string; anonymous: boolean; status: string; createdAt: Date }) {
    return { id: item.id, category: item.category, rating: item.rating, title: item.title, message: item.message, anonymous: item.anonymous, status: item.status, createdAt: item.createdAt.toISOString() };
  }
}
