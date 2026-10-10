import { createLLM } from "../server/llm.js";
import { logError } from "../server/error-log.js";
import llmConfig from "../src/config/llm.js";
import rerankPrompt from "../prompts/rerank.md";
import datingPrompt from "../prompts/rerank-dating.md";
import intentPrompt from "../prompts/intent.md";

const HOSTS = new Set(["duoduoland.llmwiki.cloud"]);
const appVersion = llmConfig.appVersion || llmConfig.default?.appVersion;

let llm;

function positive(value, fallback) {
  return Number(value) > 0 ? Number(value) : fallback;
}

function runtimeConfig(env) {
  return {
    key: env.OPENAI_API_KEY || "",
    baseUrl: String(env.LLM_BASE_URL || "").replace(/\/$/, ""),
    model: env.LLM_MODEL || "",
    timeout: positive(env.LLM_TIMEOUT_MS, 60000),
    maxOutputTokens: positive(env.LLM_MAX_OUTPUT_TOKENS, 2600),
    cacheTtl: env.LLM_CACHE_TTL_MS === "0" ? 0 : positive(env.LLM_CACHE_TTL_MS, 300000),
    cacheEntries: positive(env.LLM_CACHE_ENTRIES, 64),
    reasoningEffort: env.LLM_REASONING_EFFORT || "low",
    concurrency: positive(env.LLM_CONCURRENCY, 2),
  };
}

function getLLM(env) {
  if (!llm) llm = createLLM({
    config: runtimeConfig(env),
    templateOverrides: { rerank: rerankPrompt, "rerank-dating": datingPrompt, intent: intentPrompt },
  });
  return llm;
}

function json(status, body, correlationId, error) {
  if (status >= 400 && error) logError(error, {
    correlationId, operation: "http", started: Date.now(),
  });
  return new Response(JSON.stringify({ ...body, correlationId }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": correlationId,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handleApi(request, env, url, correlationId, started) {
  const kind = url.pathname === "/api/llm/rerank" ? "rerank"
    : url.pathname === "/api/llm/intent" ? "intent" : "";
  if (!kind || request.method !== "POST") return json(404, { error: "NOT_FOUND" }, correlationId);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json(403, { error: "INVALID_ORIGIN" }, correlationId);
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
    return json(415, { error: "JSON_REQUIRED" }, correlationId);
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 100000) return json(413, { error: "BODY_TOO_LARGE" }, correlationId);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 100000) return json(413, { error: "BODY_TOO_LARGE" }, correlationId);
  let input;
  try { input = JSON.parse(raw); } catch (_) { return json(400, { error: "INVALID_JSON" }, correlationId); }
  try {
    const result = await getLLM(env)[kind](input, correlationId, { signal: request.signal });
    return json(200, { ...result, correlationId }, correlationId);
  } catch (error) {
    const safe = logError(error, { correlationId, operation: kind, started });
    const status = safe.code === "LLM_TIMEOUT" ? 504 : safe.code === "LLM_BUSY" ? 429 : 502;
    return json(status, { error: safe.code }, correlationId);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const correlationId = crypto.randomUUID();
    const started = Date.now();
    if (!HOSTS.has(url.hostname)) return json(403, { error: "INVALID_HOST" }, correlationId);
    if (!appVersion) return json(500, { error: "APP_VERSION_MISSING" }, correlationId);
    if (url.pathname === "/api/health" && request.method === "GET") {
      const config = runtimeConfig(env);
      return json(200, {
        ok: true, configured: !!(config.key && config.baseUrl && config.model),
        model: config.model, timeoutMs: config.timeout, appVersion,
      }, correlationId);
    }
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url, correlationId, started);
    return env.ASSETS.fetch(request);
  },
};
