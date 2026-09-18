import fs from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const env = {
  ...(fs.existsSync(".env") ? parseEnv(fs.readFileSync(".env", "utf8")) : {}),
  ...process.env,
};
try {
  const {
    validateEnvironment,
  } = require("../dist/src/common/config/environment.js");
  validateEnvironment(env);
  console.log("PASS: environment validates without disclosing values.");
} catch {
  console.error(
    "FAIL: environment validation. Build first; check DATABASE_URL, JWT_SECRET, PORT, CORS_ORIGINS, provider/storage categories locally.",
  );
  process.exit(1);
}
const status = spawnSync("./node_modules/.bin/prisma", ["migrate", "status"], {
  env,
  encoding: "utf8",
  timeout: 30000,
});
console.log(
  JSON.stringify({
    migrationsUpToDate: status.status === 0,
    migrationCheckTimedOut: !!status.error,
  }),
);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
try {
  const users = await db.user.findMany({
    select: { passwordHash: true, name: true },
  });
  console.log(
    JSON.stringify({
      databaseReachable: true,
      userCount: users.length,
      accountsRequiringPasswordReset: users.filter(
        (user) => !user.passwordHash?.startsWith("scrypt$"),
      ).length,
      goldenStudentPresent: users.some(
        (user) => user.name === "Dilnoza Karimova",
      ),
      goldenProfessorPresent: users.some(
        (user) => user.name === "Azizbek Rahmonov",
      ),
      courseCount: await db.course.count(),
      followUpCount: await db.assessment.count({
        where: { type: "FOLLOW_UP" },
      }),
    }),
  );
  if (status.status !== 0) process.exitCode = 1;
} catch {
  console.error(
    "FAIL: real database readiness check. No credentials or connection details disclosed.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
