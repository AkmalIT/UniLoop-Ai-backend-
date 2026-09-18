import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from "@nestjs/common";
import type { Request, Response } from "express";

// Focused, process-local abuse protection. Production multi-instance deployments need gateway limits.
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { count: number; expires: number }
  >();
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    if (request.method !== "POST") return true;
    const path = request.path.replace(/\/$/, "");
    const rule =
      path === "/api/v1/auth/login"
        ? (["login", 30] as const)
        : path === "/api/v1/auth/register"
          ? (["register", 10] as const)
          : /^\/api\/v1\/students\/me\/assessments\/[^/]+\/submissions$/.test(
                path,
              )
            ? (["submit", 60] as const)
            : path === "/api/v1/students/me/endorsement-requests"
              ? (["endorsement", 30] as const)
              : null;
    if (!rule) return true;
    const now = Date.now();
    for (const [key, value] of this.buckets)
      if (value.expires <= now) this.buckets.delete(key);
    const key = `${rule[0]}:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      // Bound memory without resetting existing clients' counters under attacker churn.
      if (this.buckets.size >= 10000)
        throw new HttpException("Too many requests", 429);
      bucket = { count: 0, expires: now + 60000 };
      this.buckets.set(key, bucket);
    }
    if (++bucket.count > rule[1]) {
      http
        .getResponse<Response>()
        .setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((bucket.expires - now) / 1000))),
        );
      throw new HttpException("Too many requests", 429);
    }
    return true;
  }
}
