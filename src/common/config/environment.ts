import { corsOrigins } from "./cors.config";

export function validateEnvironment(input: Record<string, unknown>) {
  const read = (key: string) =>
    typeof input[key] === "string" ? input[key].trim() : "";
  const database = read("DATABASE_URL");
  try {
    if (!["postgres:", "postgresql:"].includes(new URL(database).protocol))
      throw new Error();
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }
  if (!read("JWT_SECRET")) throw new Error("JWT_SECRET is required");
  const provider = read("LLM_PROVIDER").toLowerCase();
  if (provider !== "" && provider !== "gemini")
    throw new Error("LLM_PROVIDER must be blank or gemini");
  if (provider && !read("LLM_API_KEY"))
    throw new Error("LLM_API_KEY is required when Gemini is enabled");
  const port = read("PORT") || "5001";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("PORT must be an integer from 1 to 65535");
  const storage = read("STORAGE_ENABLED") || "false";
  if (!["true", "false"].includes(storage))
    throw new Error("STORAGE_ENABLED must be true or false");
  if (storage === "true")
    for (const key of [
      "AWS_ENDPOINT_URL_S3",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
    ]) {
      if (!read(key))
        throw new Error(`${key} is required when storage is enabled`);
    }
  const origins = read("CORS_ORIGINS") || "http://localhost:3000";
  corsOrigins(origins);
  if (
    read("SEED_DISPOSABLE") &&
    !["true", "false"].includes(read("SEED_DISPOSABLE"))
  )
    throw new Error("SEED_DISPOSABLE must be true or false");
  return {
    ...input,
    PORT: port,
    LLM_PROVIDER: provider,
    STORAGE_ENABLED: storage,
    CORS_ORIGINS: origins,
  };
}
