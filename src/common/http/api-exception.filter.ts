import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";
import { Prisma } from "@prisma/client";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception instanceof Prisma.PrismaClientKnownRequestError &&
            exception.code === "P2002"
          ? 409
          : 500;
    const codes: Record<number, string> = {
      400: "VALIDATION_ERROR",
      422: "VALIDATION_ERROR",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      429: "RATE_LIMITED",
      503: "UNAVAILABLE",
    };
    const code = codes[status] ?? "INTERNAL_ERROR";
    const messages: Record<string, string> = {
      VALIDATION_ERROR: "Request validation failed",
      UNAUTHORIZED: "Authentication required",
      FORBIDDEN: "Access denied",
      NOT_FOUND: "Resource not found",
      CONFLICT: "Resource conflict",
      RATE_LIMITED: "Too many requests; retry later",
      UNAVAILABLE: "Workflow unavailable",
      INTERNAL_ERROR: "Request could not be completed",
    };
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const details =
      status === 400 &&
      typeof body === "object" &&
      body &&
      "message" in body &&
      Array.isArray(body.message)
        ? body.message
            .filter((item: unknown): item is string => typeof item === "string")
            .map((message) => ({ message }))
        : [];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ error: { code, message: messages[code], details } });
  }
}
