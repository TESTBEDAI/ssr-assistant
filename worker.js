/**
 * SSR Rules Assistant — API proxy (Cloudflare Worker)
 *
 * Sits between the GitHub Pages app and the Anthropic API so the API key
 * never appears in the public page. The key is stored as a Worker secret
 * named ANTHROPIC_API_KEY (Settings → Variables and Secrets).
 *
 * Edit ALLOWED_ORIGINS below to match where the app is hosted.
 */

const ALLOWED_ORIGINS = [
  "https://lyndhurstrc.github.io",   // ← your GitHub Pages site
  // "http://localhost:8000",        // ← uncomment while testing locally
];

// Server-side guardrails: whatever the page sends, the Worker enforces these.
const FORCED_MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 1024;
const MAX_REQUEST_BYTES = 300_000; // ~16 rule extracts + history; blocks abuse-sized payloads

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const originOk = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: { message: "POST only" } }, 405, cors);
    }
    if (!originOk) {
      return json({ error: { message: "Origin not allowed" } }, 403, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: { message: "Worker secret ANTHROPIC_API_KEY is not set" } }, 500, cors);
    }

    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BYTES) {
      return json({ error: { message: "Request too large" } }, 413, cors);
    }

    let body;
    try { body = JSON.parse(raw); }
    catch { return json({ error: { message: "Invalid JSON" } }, 400, cors); }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: { message: "messages array required" } }, 400, cors);
    }

    const payload = {
      model: FORCED_MODEL,
      max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_OUTPUT_TOKENS),
      system: typeof body.system === "string" ? body.system : undefined,
      messages: body.messages,
    };

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
