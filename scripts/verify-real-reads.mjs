import assert from "node:assert/strict";
import fs from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { JwtService } = require("@nestjs/jwt");
const env = { ...parseEnv(fs.readFileSync(".env", "utf8")), ...process.env };
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const base = "http://localhost:5001/api/v1";
let checks = 0;
let stage = "startup";
async function get(path, token, expected = 200) {
  const response = await fetch(base + path, {
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  assert.equal(response.status, expected);
  const json = await response.json();
  checks++;
  return json.data;
}
try {
  await get("/ai/status");
  assert.equal((await fetch(base + "/docs")).status, 200);
  await get("/auth/me", undefined, 401);
  stage = "canonical-CORS";
  const preflight = await fetch(base + "/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
  const jwt = new JwtService({ secret: env.JWT_SECRET });
  for (const role of ["STUDENT", "PROFESSOR"]) {
    stage = role + "-identity-and-role";
    const user = await db.user.findFirst({
      where: { role },
      select: { id: true },
    });
    assert.ok(user);
    // Internal short-lived test token: proves JWT/database reads, NOT password-login readiness.
    const token = await jwt.signAsync(
      { sub: user.id, role },
      { expiresIn: "5m" },
    );
    await get("/auth/me", token);
    const prefix = role === "STUDENT" ? "/students/me" : "/professors/me";
    const courses = await get(prefix + "/courses", token);
    await get(prefix + "/dashboard", token);
    await get(
      role === "STUDENT" ? "/professors/me/courses" : "/students/me/courses",
      token,
      403,
    );
    const surveys = await get("/surveys?audience=" + role, token);
    assert.ok(
      surveys.every(
        (item) =>
          item.externalUrl === null || /^https?:/.test(item.externalUrl),
      ),
    );
    stage = role + "-academic-reads";
    if (courses[0]) {
      const course = await get(prefix + "/courses/" + courses[0].id, token);
      if (role === "STUDENT" && course.assessments[0]) {
        const assessment = await get(
          prefix + "/assessments/" + course.assessments[0].id,
          token,
        );
        assert.ok(
          !/correctAnswer|isCorrect|correctOption|expectedAnswer|gradingKey/.test(
            JSON.stringify(assessment),
          ),
        );
        await get(prefix + "/mastery/" + courses[0].id, token);
      }
      if (role === "PROFESSOR") {
        await get(prefix + "/courses/" + courses[0].id + "/insights", token);
        await get(
          prefix + "/courses/" + courses[0].id + "/interventions",
          token,
        );
      }
    }
  }
  stage = "nonexistent-user";
  await get(
    "/auth/me",
    await jwt.signAsync(
      { sub: "phase9-nonexistent-user", role: "STUDENT" },
      { expiresIn: "5m" },
    ),
    401,
  );
  console.log(
    `PASS: ${checks} real-target read-only HTTP checks plus Swagger and canonical CORS. Internal signed tokens do not prove password login. No user/grade/evidence writes.`,
  );
} catch {
  console.error(
    `FAIL: real-target read verification at ${stage}. No account or connection details disclosed.`,
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
