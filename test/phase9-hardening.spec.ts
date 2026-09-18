import { ExecutionContext, HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validateEnvironment } from "../src/common/config/environment";
import { corsOrigins } from "../src/common/config/cors.config";
import { RateLimitGuard } from "../src/common/guards/rate-limit.guard";
import { GeminiLlmProvider } from "../src/integrations/llm/providers/gemini-llm.provider";

const base = {
  DATABASE_URL: "postgresql://localhost/test",
  JWT_SECRET: "test-only-not-a-real-secret",
};
function context(path: string, ip = "127.0.0.1", method = "POST") {
  const setHeader = jest.fn();
  return {
    setHeader,
    context: {
      switchToHttp: () => ({
        getRequest: () => ({ path, ip, method }),
        getResponse: () => ({ setHeader }),
      }),
    },
  } as unknown as { setHeader: jest.Mock; context: ExecutionContext };
}
describe("Phase 9 environment and focused abuse protection", () => {
  test("safe local defaults and normalized Gemini identifier", () => {
    expect(validateEnvironment(base)).toMatchObject({
      PORT: "5001",
      LLM_PROVIDER: "",
      STORAGE_ENABLED: "false",
    });
    expect(
      validateEnvironment({
        ...base,
        LLM_PROVIDER: " GEMINI ",
        LLM_API_KEY: "test-key",
      }).LLM_PROVIDER,
    ).toBe("gemini");
  });
  test.each([
    ["DATABASE_URL", "not-a-connection"],
    ["JWT_SECRET", ""],
    ["PORT", "5001x"],
    ["PORT", "0"],
    ["LLM_PROVIDER", "Google Gemini"],
    ["LLM_PROVIDER", "gemini"],
    ["STORAGE_ENABLED", "yes"],
    ["STORAGE_ENABLED", "true"],
    ["SEED_DISPOSABLE", "yes"],
    ["CORS_ORIGINS", "secret-invalid-origin"],
  ])("invalid %s fails without revealing its value", (key, value) => {
    expect(() => validateEnvironment({ ...base, [key]: value })).toThrow(
      key === "LLM_PROVIDER" && value === "gemini"
        ? "LLM_API_KEY"
        : key === "STORAGE_ENABLED" && value === "true"
          ? "AWS_ENDPOINT_URL_S3"
          : key,
    );
  });
  test("comma-delimited CORS origins and credential/path rejection", () => {
    expect(corsOrigins("http://localhost:3000, http://localhost:3001")).toEqual(
      ["http://localhost:3000", "http://localhost:3001"],
    );
    for (const origin of [
      "*",
      "https://user:password@example.test",
      "http://localhost:3000/path",
      "private-invalid-value",
    ])
      expect(() => corsOrigins(origin)).toThrow("CORS_ORIGINS");
  });
  test.each([
    ["/api/v1/auth/login", 30],
    ["/api/v1/auth/register", 10],
    ["/api/v1/students/me/assessments/a/submissions", 60],
    ["/api/v1/students/me/endorsement-requests", 30],
  ])("limits %s and returns retry metadata", (path, limit) => {
    const guard = new RateLimitGuard(),
      http = context(path);
    for (let i = 0; i < limit; i++)
      expect(guard.canActivate(http.context)).toBe(true);
    try {
      guard.canActivate(http.context);
      throw new Error("Expected rejection");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(http.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      expect.any(String),
    );
    expect(guard.canActivate(context(path, "127.0.0.2").context)).toBe(true);
    expect(guard.canActivate(context(path, "127.0.0.1", "GET").context)).toBe(
      true,
    );
  });
  test("buckets expire rather than permanently blocking clients", () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
    try {
      const guard = new RateLimitGuard(),
        http = context("/api/v1/auth/register");
      for (let i = 0; i < 10; i++) guard.canActivate(http.context);
      expect(() => guard.canActivate(http.context)).toThrow();
      clock.mockReturnValue(61001);
      expect(guard.canActivate(http.context)).toBe(true);
    } finally {
      clock.mockRestore();
    }
  });
});
describe("Gemini request boundary", () => {
  afterEach(() => jest.restoreAllMocks());
  test("key travels in header, never URL; model output is parsed and request bounded", async () => {
    const fetcher = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"titleUz":"Test"}' }] } },
            ],
          }),
          { status: 200 },
        ),
      );
    const provider = new GeminiLlmProvider(
      new ConfigService({
        LLM_PROVIDER: "gemini",
        LLM_API_KEY: "test-only-key",
      }),
    );
    expect(
      (await provider.generate({ prompt: "Public synthetic test" })).text,
    ).toContain("titleUz");
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).not.toContain("test-only-key");
    expect(String(url)).not.toContain("?key=");
    expect(options?.headers).toMatchObject({
      "x-goog-api-key": "test-only-key",
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
  test("provider failures do not reveal response bodies", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("sensitive-provider-response", { status: 403 }),
      );
    const provider = new GeminiLlmProvider(
      new ConfigService({ LLM_API_KEY: "test-only-key" }),
    );
    await expect(provider.generate({ prompt: "Public test" })).rejects.toThrow(
      "LLM provider request failed.",
    );
  });
});
