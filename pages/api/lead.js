// pages/api/lead.js
// Devora Realty — Dalton Lead Capture → Follow Up Boss
// Creates a person in FUB and attaches a note with the saved search + transcript.

const FUB_BASE = "https://api.followupboss.com/v1";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.FUB_API_KEY;
  if (!apiKey) {
    console.error("FUB_API_KEY missing from env");
    return res.status(500).json({ ok: false, error: "Lead service not configured." });
  }

  const { name, email, phone, searchUrl, filters, transcript } = req.body || {};

  // Basic validation
  if (!name || !String(name).trim()) {
    return res.status(400).json({ ok: false, error: "Name is required." });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ ok: false, error: "Valid email is required." });
  }

  // Name split
  const parts = String(name).trim().split(/\s+/);
  const firstName = parts.shift() || "";
  const lastName = parts.join(" ") || "";

  // Build the saved search note
  const noteLines = [];
  if (searchUrl) noteLines.push(`Saved Search URL: ${searchUrl}`);
  if (filters && typeof filters === "object") {
    const f = filters;
    const summary = [
      f.city && `City: ${titleCase(f.city)}`,
      f.bedsMin != null && `Beds: ${f.bedsMin}+`,
      f.bathsMin != null && `Baths: ${f.bathsMin}+`,
      f.priceMin != null && `Price Min: ${formatMoney(f.priceMin)}`,
      f.priceMax != null && `Price Max: ${formatMoney(f.priceMax)}`,
      f.type && `Type: ${f.type}`,
      Array.isArray(f.features) && f.features.length && `Features: ${f.features.join(", ")}`
    ].filter(Boolean).join(" | ");
    if (summary) noteLines.push(`Filters: ${summary}`);
  }
  if (Array.isArray(transcript) && transcript.length) {
    noteLines.push("");
    noteLines.push("--- Recent Conversation ---");
    for (const m of transcript.slice(-8)) {
      if (m?.role && m?.content) {
        const who = m.role === "user" ? "Lead" : "Dalton";
        noteLines.push(`${who}: ${String(m.content).trim()}`);
      }
    }
  }
  noteLines.push("");
  noteLines.push(`Captured: ${new Date().toISOString()}`);
  const noteBody = noteLines.join("\n");

  // Build FUB person payload
  const personPayload = {
    source: "Dalton Lead",
    system: "Dalton",
    firstName,
    lastName,
    emails: [{ value: String(email).trim(), type: "home" }],
    tags: ["Dalton Lead"]
  };
  if (phone && String(phone).trim()) {
    personPayload.phones = [{ value: String(phone).trim(), type: "mobile" }];
  }

  const auth = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
  const fubHeaders = {
    Authorization: auth,
    "Content-Type": "application/json",
    "X-System": "Dalton",
    "X-System-Key": "dalton-realty-widget"
  };

  try {
    // 1) Create person
    const personRes = await fetch(`${FUB_BASE}/people`, {
      method: "POST",
      headers: fubHeaders,
      body: JSON.stringify(personPayload)
    });

    const personData = await personRes.json().catch(() => ({}));

    if (!personRes.ok) {
      console.error("FUB person create failed:", personRes.status, personData);
      return res.status(502).json({
        ok: false,
        error: "Could not save your info. Please try again.",
        detail: personData
      });
    }

    const personId = personData?.id;

    // 2) Attach note (best-effort)
    let noteOk = false;
    if (personId && noteBody) {
      try {
        const noteRes = await fetch(`${FUB_BASE}/notes`, {
          method: "POST",
          headers: fubHeaders,
          body: JSON.stringify({
            personId,
            subject: "Dalton Saved Search",
            body: noteBody,
            isHtml: false
          })
        });
        noteOk = noteRes.ok;
        if (!noteRes.ok) {
          const nd = await noteRes.json().catch(() => ({}));
          console.warn("FUB note attach failed:", noteRes.status, nd);
        }
      } catch (noteErr) {
        console.warn("FUB note attach error:", noteErr?.message);
      }
    }

    return res.status(200).json({
      ok: true,
      id: personId,
      noteAttached: noteOk
    });
  } catch (err) {
    console.error("Lead handler error:", err);
    return res.status(500).json({ ok: false, error: "Server error. Please try again." });
  }
}

function titleCase(s) {
  return String(s).replace(/\b\w/g, c => c.toUpperCase());
}

function formatMoney(n) {
  if (n == null || isNaN(n)) return "";
  const num = Number(n);
  if (num >= 1000000) {
    const v = num / 1000000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (num >= 1000) return `$${Math.round(num / 1000)}k`;
  return `$${num}`;
}
