export function corsOrigins(value = "http://localhost:3000"): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length) throw new Error("CORS_ORIGINS must contain an origin");
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error("CORS_ORIGINS must contain exact HTTP(S) origins");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== origin ||
      url.username ||
      url.password
    ) {
      throw new Error("CORS_ORIGINS must contain exact HTTP(S) origins");
    }
  }
  return origins;
}
