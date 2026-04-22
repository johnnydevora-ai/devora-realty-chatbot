// pages/api/lead.js
// DALTON Lead Capture -> Follow Up Boss (direct)
// Phase 2 hardening retained; AgentFire forwarding removed (Option A1).
// Phase 2C: widget-contract compatibility (accepts widget's native save-search payload).
//
// Contract:
//   POST /api/lead   -> creates FUB person + best-effort note
//   OPTIONS          -> CORS preflight (allowlisted origins only)
//   *                -> 405 { ok:false, error:"Method not allowed" }

import { randomUUID } from "node:crypto";

// ---------- CORS allowlist ----------
const STATIC_ALLOWED_ORIGINS = new Set([
  "https://devorarealty.com",
  "https://www.devorarealty.com",
]);

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

// ---------- Rate limit (in-memory, per IP) ----------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000;
const rlBuckets = new Map();

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = rlBuckets.get(ip) || [];
  const recent = arr.filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    rlBuckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  rlBuckets.set(ip, recent);
  return false;
}

// ---------- Validation ----------
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Adapt incoming payload: support both widget-native shape and canonical shape.
// Widget sends: { name, email, phone, searchUrl, filters, transcript }
// Canonical:    { sessionId, name, email, phone, pageUrl, lastSearchUrl, note, history }
function adaptIncomingPayload(body, req) {
  if (!body || typeof body !== "object") return body;
  const out = { ...body };

  if (!isNonEmptyString(out.lastSearchUrl) && isNonEmptyString(out.searchUrl)) {
    out.lastSearchUrl = out.searchUrl;
  }

  if (!Array.isArray(out.history) && Array.isArray(out.transcript)) {
    out.history = out.transcript;
  }

  if (!isNonEmptyString(out.sessionId)) {
    out.sessionId = "auto-" + randomUUID();
  }

  if (!isNonEmptyString(out.pageUrl)) {
    const ref = req.headers.referer || req.headers.referrer || "";
    if (typeof ref === "string" && ref.length > 0) {
      out.pageUrl = ref;
    } else {
      out.pageUrl = "https://devorarealty.com/";
    }
  }

  return out;
}

function validatePayload(body) {
  if (!body || typeof body !== "object") return "invalid_body";

  if (!isNonEmptyString(body.name)) return "missing_name";
  const hasEmail = isNonEmptyString(body.email);
  const hasPhone = isNonEmptyString(body.phone);
  if (!hasEmail && !hasPhone) return "missing_contact";

  if (!isNonEmptyString(body.sessionId)) return "missing_sessionId";
  if (!isNonEmptyString(body.pageUrl)) return "missing_pageUrl";

  if (body.history != null && !Array.isArray(body.history)) {
    return "invalid_history";
  }
  return null;
}

function splitName(full) {
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function summarizeHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return "";
  const lines = [];
  for (const m of history) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "DALTON" : m.role === "user" ? "User" : (m.role || "msg");
    const content = typeof m.content === "string" ? m.content : "";
    if (!content) continue;
    const trimmed = content.length > 500 ? content.slice(0, 500) + "..." : content;
    lines.push(`${role}: ${trimmed}`);
  }
  return lines.join("\n");
}

// ---------- Logging (no PII) ----------
function log(evt, fields) {
  try {
    const line = JSON.stringify({ evt, ...fields });
    console.log(line);
  } catch {}
}

// ---------- Follow Up Boss client ----------
const FUB_BASE = "https://api.followupboss.com/v1";

function fubAuthHeader() {
  const key = process.env.FUB_API_KEY || "";
  const token = Buffer.from(`${key}:`).toString("base64");
  return `Basic ${token}`;
}

async function fubCreatePerson({ firstName, lastName, email, phone, pageUrl }) {
  const body = {
    source: "dalton_chatbot",
    system: "Dalton",
    firstName,
    lastName,
    tags: ["dalton_chatbot"],
    sourceUrl: pageUrl,
  };
  if (email) body.emails = [{ value: email, type: "home" }];
  if (phone) body.phones = [{ value: phone, type: "mobile" }];
  const r = await fetch(`${FUB_BASE}/people`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": fubAuthHeader(),
      "X-System": "Dalton",
      "X-System-Key": "dalton-realty-widget",
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, ok: r.ok, json };
}

async function fubCreateNote({ personId, pageUrl, lastSearchUrl, transcript, sessionId, submittedAt, note }) {
  const lines = [];
  if (note) lines.push(`Lead note: ${note}`);
  if (pageUrl) lines.push(`Page: ${pageUrl}`);
  if (lastSearchUrl) lines.push(`Last Search: ${lastSearchUrl}`);
  if (transcript) {
    lines.push("--- Conversation ---");
    lines.push(transcript);
  }
  lines.push(`Session: ${sessionId}`);
  lines.push(`Submitted: ${submittedAt}`);
  const body = {
    personId,
    subject: "DALTON Chatbot Lead",
    body: lines.join("\n"),
    isHtml: false,
  };
  const r = await fetch(`${FUB_BASE}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": fubAuthHeader(),
      "X-System": "Dalton",
      "X-System-Key": "dalton-realty-widget",
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, ok: r.ok };
}

// ---------- Handler ----------
export default async function handler(req, res) {
  const requestId = randomUUID();
  const started = Date.now();

  if (req.method === "OPTIONS") {
    const allowed = applyCors(req, res);
    if (!allowed) {
      res.status(403).json({ ok: false, error: "origin_not_allowed", requestId });
      return;
    }
    res.status(204).end();
    return;
  }

  applyCors(req, res);

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const ip = getClientIp(req);
    if (rateLimited(ip)) {
      log("dalton_lead_ratelimited", { requestId, ip });
      res.status(429).json({ ok: false, error: "rate_limited", requestId, d: { ok: false, error: "rate_limited" } });
      return;
    }

    const rawBody = req.body && typeof req.body === "object" ? req.body : null;
    const body = adaptIncomingPayload(rawBody, req);
    const verr = validatePayload(body);
    if (verr) {
      log("dalton_lead_validation", { requestId, reason: verr });
      res.status(400).json({ ok: false, error: "validation_error", reason: verr, requestId, d: { ok: false, error: verr } });
      return;
    }

    const { sessionId, name, email, phone, pageUrl } = body;
    const note = typeof body.note === "string" ? body.note : "";
    const lastSearchUrl = typeof body.lastSearchUrl === "string" ? body.lastSearchUrl : "";
    const history = Array.isArray(body.history) ? body.history : [];
    const { firstName, lastName } = splitName(name);
    const transcript = summarizeHistory(history);
    const submittedAt = new Date().toISOString();

    if (!process.env.FUB_API_KEY) {
      log("dalton_lead_misconfig", { requestId, reason: "missing_fub_key" });
      res.status(500).json({ ok: false, error: "internal_error", requestId, d: { ok: false, error: "internal_error" } });
      return;
    }

    const personRes = await fubCreatePerson({
      firstName,
      lastName,
      email: email || "",
      phone: phone || "",
      pageUrl,
    });
    const personId = personRes.json && (personRes.json.id || personRes.json.personId);

    if (!personRes.ok || !personId) {
      log("dalton_lead_forward", {
        requestId,
        ok: false,
        status: personRes.status,
        durationMs: Date.now() - started,
        sessionId,
        pageUrl,
        stage: "person",
      });
      res.status(502).json({ ok: false, error: "upstream_error", requestId, d: { ok: false, error: "upstream_error" } });
      return;
    }

    let noteStatus = null;
    try {
      const nr = await fubCreateNote({
        personId,
        pageUrl,
        lastSearchUrl,
        transcript,
        sessionId,
        submittedAt,
        note,
      });
      noteStatus = nr.status;
    } catch (e) {
      noteStatus = "exception";
    }

    log("dalton_lead_forward", {
      requestId,
      ok: true,
      status: personRes.status,
      noteStatus,
      durationMs: Date.now() - started,
      sessionId,
      pageUrl,
    });

    res.status(200).json({ ok: true, leadId: personId, requestId, d: { ok: true, personId } });
  } catch (err) {
    log("dalton_lead_error", {
      requestId,
      message: err && err.message ? err.message : "unknown",
      durationMs: Date.now() - started,
    });
    res.status(500).json({ ok: false, error: "internal_error", requestId, d: { ok: false, error: "internal_error" } });
  }
}
