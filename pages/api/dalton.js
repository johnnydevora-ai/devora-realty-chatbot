const DALTON_SYSTEM_PROMPT = `

You are DALTON.

You are a real estate search guide focused on high-quality buyers.

You are NOT a chatbot.

You are NOT a market explainer.

You are NOT a generic assistant.

---

YOUR ROLE:

Guide the user to a focused property search by:

- extracting criteria

- asking 1 smart question at a time

- narrowing intent

- then delivering results

---

TONE:

- calm

- concise

- polished

- slightly warm

- never robotic

- never salesy

- never verbose

DO NOT:

- give long explanations

- analyze the market

- give opinions

- overwhelm the user

---

FLOW (STRICT):

STEP 1 — UNDERSTAND

User gives initial request.

You respond with ONE focused question that helps clarify:

- price

- location

- features

- intent

Example:

"What matters most here—price, location, or features?"

---

STEP 2 — NARROW

Ask 1 follow-up question to refine intent.

Examples:

- "What would make this stand out—pool, newer build, or something else?"

- "Is this something you’re planning to live in or invest in?"

---

STEP 3 — SEARCH READY

Only trigger search when you have:

- location

- budget (or strong implied range)

- at least ONE meaningful preference

When ready, respond ONLY with:

SEARCH_READY:{"city":"Austin","area":"East Austin","beds":3,"baths":2,"maxPrice":1000000,"type":"Residential","features":["pool"]}

NO extra text.

---

STEP 4 — AFTER SEARCH

After results are shown, guide the user:

"I can keep this dialed in for you.

Want me to send new matches as they hit?"

---

STEP 5 — CONVERSION

If user says yes:

Respond:

COLLECT_EMAIL

If email provided:

EMAIL_CAPTURED:[email]

Then ask:

"If something strong hits, want me to text you too?"

If yes:

COLLECT_PHONE

If phone provided:

PHONE_CAPTURED:[number]

---

STEP 6 — REFINEMENT

If user modifies search:

- "add a pool"

- "raise budget"

- "switch areas"

You MUST:

- merge with previous criteria

- return a NEW SEARCH_READY

---

FINAL RULES:

- One question at a time

- No repetition

- No over-talking

- No explanations

You are guiding, not answering.

`;

// Helper: build devorarealty.com search URL from parsed criteria
function buildSearchUrl(criteria) {
  const base = "https://devorarealty.com/properties/";
  const params = new URLSearchParams();

  if (criteria.search) params.set("search", criteria.search);
  if (criteria.city) params.set("search", criteria.city);
  if (criteria.area) params.set("search", criteria.area);
  if (criteria.beds) params.set("beds", String(criteria.beds));
  if (criteria.baths) params.set("baths", String(criteria.baths));
  if (criteria.minPrice) params.set("minPrice", String(criteria.minPrice));
  if (criteria.maxPrice) params.set("maxPrice", String(criteria.maxPrice));
  if (criteria.type && criteria.type !== "Residential") params.set("type", criteria.type);
  if (criteria.minSqft) params.set("minSqft", String(criteria.minSqft));
  if (criteria.maxSqft) params.set("maxSqft", String(criteria.maxSqft));
  if (criteria.minLotSize) params.set("minLotSize", String(criteria.minLotSize));
  if (criteria.maxLotSize) params.set("maxLotSize", String(criteria.maxLotSize));
  if (criteria.minYearBuilt) params.set("minYearBuilt", String(criteria.minYearBuilt));
  if (criteria.maxYearBuilt) params.set("maxYearBuilt", String(criteria.maxYearBuilt));
  if (criteria.status && criteria.status !== "For Sale") params.set("status", criteria.status);
  if (criteria.features && criteria.features.length > 0) {
    params.set("features", criteria.features.join(","));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function handler(req, res) {
  // CORS headers — applied to ALL responses including OPTIONS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  // Build messages array from history
  // history from the frontend already includes the latest user message,
  // so we use it directly — do NOT push message again to avoid duplicates.
  const messages = [];
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  // Fallback: if history was empty or missing, add the current message
  if (messages.length === 0) {
    messages.push({ role: "user", content: message });
  }

  try {
    console.log("🚀 DALTON REQUEST START");
    console.log("Message:", message);
    console.log("History length:", history?.length || 0);
    console.log("Messages sent to API:", messages.length);
    console.log("API Key exists:", !!process.env.ANTHROPIC_API_KEY);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        temperature: 0.2,
        system: DALTON_SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    const rawText = await response.text();

    console.log("🔥 STATUS:", response.status);
    console.log("🔥 RAW RESPONSE:", rawText);

    if (!response.ok) {
      return res.status(500).json({
        reply: "API ERROR",
        debug: rawText,
      });
    }

    const data = JSON.parse(rawText);
    const reply = data.content?.[0]?.text || "No response";

    // --- SEARCH_READY detection ---
    if (reply.trim().startsWith("SEARCH_READY:")) {
      try {
        const jsonStr = reply.trim().replace("SEARCH_READY:", "");
        const criteria = JSON.parse(jsonStr);
        const searchUrl = buildSearchUrl(criteria);
        console.log("🔍 SEARCH URL:", searchUrl);
        return res.status(200).json({
          reply: "Got it. Let me pull your matches.",
          searchUrl: searchUrl,
        });
      } catch (parseErr) {
        console.error("❌ Failed to parse SEARCH_READY JSON:", parseErr);
        return res.status(200).json({ reply });
      }
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      reply: "Something went wrong. Please try again.",
    });
  }
}
