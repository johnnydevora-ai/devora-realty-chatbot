// pages/api/lead.js
// DALTON Lead Capture -> AgentFire Lead Manager -> Follow Up Boss
// Phase Two: Lead Pipeline Stabilization + Security
//
// Contract:
//   POST /api/lead   -> forwards to AgentFire
//   OPTIONS          -> CORS preflight (allowlisted origins only)
//   *                -> 405 { ok:false, error:"Method not allowed" }

import { randomUUID } from "node:crypto";

// ---------- CORS allowlist ----------
const STATIC_ALLOWED_ORIGINS = new Set([
  "https://devorarealty.com",
  "https://www.devorarealty.com",
]);

// Allow approved Vercel preview URLs for this project only.
const PREVIEW_ORIGIN_RE =
  /^https:\/\/devora-realty-chatbot(?:-[a-z0-9-]+)?\.vercel\.app$/i;

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  if (PREVIEW_ORIGIN_RE.test(origin)) return true;
  return false;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return true;
  }
  return false;
}

// ---------- Tiny in-memory rate limit (5 / IP / minute) ----------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000;
const rateBucket = new Map();

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const arr = (rateBucket.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (arr.length >= RATE_LIMIT_MAX) {
    rateBucket.set(ip, arr);
    return true;
  }
  arr.push(now);
  rateBucket.set(ip, arr);
  return false;
}

// ---------- Validation ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body) {
  const errors = {};
  const b = body && typeof body === "object" ? body : {};

  const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  const note = typeof b.note === "string" ? b.note : "";
  const pageUrl = typeof b.pageUrl === "string" ? b.pageUrl.trim() : "";
  const lastSearchUrl =
    typeof b.lastSearchUrl === "string" ? b.lastSearchUrl.trim() : "";
  const history = Array.isArray(b.history) ? b.history : [];

  if (!sessionId) errors.sessionId = "required";
  if (!name) errors.name = "required";
  if (!email || !EMAIL_RE.test(email)) errors.email = "invalid";
  if (phone && phone.replace(/\D/g, "").length < 7) errors.phone = "invalid";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: { sessionId, name, email, phone, note, pageUrl, lastSearchUrl, history },
  };
}

function splitName(full) {
  const parts = full.split(/\s+/);
  const first_name = parts.shift() || "";
  const last_name = parts.join(" ");
  return { first_name, last_name };
}

function buildComments({ note, lastSearchUrl, history }) {
  const lines = [];
  if (note) lines.push(note);
  if (lastSearchUrl) lines.push(`Last Search: ${lastSearchUrl}`);
  if (history.length) {
    lines.push("--- Recent Conversation ---");
    for (const m of history.slice(-8)) {
      if (m && m.role && m.content) {
        const who = m.role === "user" ? "Lead" : "Dalton";
        lines.push(`${who}: ${String(m.content).trim()}`);
      }
    }
  }
  return lines.join("\n");
}

// ---------- Structured logging (no PII) ----------
function logEvent(obj) {
  try {
    console.log(JSON.stringify({ evt: "dalton_lead_forward", ...obj }));
  } catch {
    /* never throw from a logger */
  }
}

// ---------- Handler ----------
export default async function handler(req, res) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  const corsOk = applyCors(req, res);

  if (req.method === "OPTIONS") {
    if (!corsOk) return res.status(403).end();
    return res.status(204).end();
  }

  if (!corsOk && req.headers.origin) {
    return res
      .status(403)
      .json({ ok: false, error: "origin_not_allowed", requestId });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  if (rateLimited(ip)) {
    logEvent({
      ok: false,
      status: 429,
      durationMs: Date.now() - startedAt,
      requestId,
    });
    return res
      .status(429)
      .json({ ok: false, error: "rate_limited", requestId });
  }

  const v = validate(req.body);
  if (!v.ok) {
    logEvent({
      ok: false,
      status: 400,
      durationMs: Date.now() - startedAt,
      requestId,
      sessionId: v.data.sessionId || null,
      pageUrl: v.data.pageUrl || null,
      fields: Object.keys(v.errors),
    });
    return res.status(400).json({
      ok: false,
      error: "validation_error",
      fields: v.errors,
      requestId,
    });
  }

  const { sessionId, name, email, phone, note, pageUrl, lastSearchUrl, history } =
    v.data;

  const agentFireUrl = process.env.AGENTFIRE_LEAD_URL;
  if (!agentFireUrl) {
    logEvent({
      ok: false,
      status: 500,
      durationMs: Date.now() - startedAt,
      requestId,
      sessionId,
      pageUrl,
      reason: "missing_env",
    });
    return res
      .status(500)
      .json({ ok: false, error: "internal_error", requestId });
  }

  const { first_name, last_name } = splitName(name);
  const submittedAt = new Date().toISOString();

  const payload = {
    first_name,
    last_name,
    email_address: email,
    phone_number: phone || undefined,
    source: "dalton_chatbot",
    source_url: pageUrl || undefined,
    tags: ["dalton_chatbot"],
    other: {
      Comments: buildComments({ note, lastSearchUrl, history }),
      dalton_session_id: sessionId,
      submitted_at: submittedAt,
    },
  };

  try {
    const upstream = await fetch(agentFireUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Dalton/1.0 (+devorarealty.com)",
      },
      body: JSON.stringify(payload),
    });

    const status = upstream.status;
    const ok = upstream.ok;

    logEvent({
      ok,
      status,
      durationMs: Date.now() - startedAt,
      sessionId,
      pageUrl,
      requestId,
    });

    if (!ok) {
      return res
        .status(502)
        .json({ ok: false, error: "upstream_error", requestId });
    }

    return res.status(200).json({ ok: true, leadId: null, requestId });
  } catch (err) {
    logEvent({
      ok: false,
      status: 500,
      durationMs: Date.now() - startedAt,
      sessionId,
      pageUrl,
      requestId,
      reason: "exception",
    });
    return res
      .status(500)
      .json({ ok: false, error: "internal_error", requestId });
  }
}
