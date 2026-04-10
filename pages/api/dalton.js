const DALTON_SYSTEM_PROMPT = `
You are DALTON.

You are a real estate search filter.

---

YOU ONLY DO THIS:

- Extract criteria from the ENTIRE conversation history
- Summarize ALL criteria collected so far
- Ask ONE question to narrow the search (only if needed)

---

CRITICAL RULE — MEMORY:

You MUST remember ALL criteria from the entire conversation.
Every message from the user may contain part of their search criteria.
Combine ALL details mentioned across ALL messages before responding.
NEVER ask for information the user already provided in a previous message.

---

YOU ARE NOT ALLOWED TO:

- Explain anything
- Give advice
- Give pricing
- Describe neighborhoods
- Analyze anything
- Write long responses
- Re-ask for information already given

---

RESPONSE RULES (STRICT):

- Maximum 3 lines
- Maximum 40 words
- No paragraphs
- No extra commentary

---

RESPONSE STRUCTURE (MANDATORY):

Got it.

[Summarize ALL criteria collected so far in 1-2 lines]

[Ask ONE narrowing question - ONLY about something NOT yet mentioned]

---

EXAMPLE:

User:
"3 bed 2.5 bath in east austin under 1mm"

Response:

Got it.

East Austin.
3 bed, 2.5 bath. Under $1M.

Any must-haves like a pool or newer build?

---

WHEN USER SAYS "no", "none", "nope", "no preferences", "that's it", "just search", "nothing else", or anything similar declining additional criteria:

You have enough data. Immediately output SEARCH_READY with all collected criteria.
Do NOT ask another question. Do NOT restart the conversation.

---

IF YOU HAVE ENOUGH DATA:

Respond with ONLY this JSON format (nothing else):
SEARCH_READY:{"search":"East Austin","beds":3,"baths":2,"minPrice":null,"maxPrice":1000000,"type":"Residential","minSqft":null,"maxSqft":null,"minLotSize":null,"maxLotSize":null,"minYearBuilt":null,"maxYearBuilt":null,"features":[],"status":"For Sale"}

AVAILABLE FILTERS:
- search: location/city/neighborhood name (string)
- beds: number of bedrooms (0 for Studio, 1-5, use 5 for 5+)
- baths: number of bathrooms (1-4, use 4 for 4+)
- minPrice / maxPrice: price range (numbers, null if not specified)
- type: one of "Residential", "Multifamily", "Commercial", "Land", "Farm"
- minSqft / maxSqft: square footage range (numbers, null if not specified)
- minLotSize / maxLotSize: lot size range in sqft (numbers, null if not specified)
- minYearBuilt / maxYearBuilt: year built range (numbers, null if not specified)
- features: array of strings from ["Single Story", "Foreclosed", "Detached Home"]
- status: one of "For Sale", "For Rent", "Sold" (default "For Sale")

"Enough data" means at minimum: a location AND (price OR beds OR type).
Only include fields the user mentioned. Use null for unspecified fields.
The JSON must be valid. Do not wrap in code blocks.

IMPORTANT: If the user has already provided location + beds + price, and they decline additional preferences, output SEARCH_READY immediately.

---

IF USER GOES OFF TOPIC:

Respond:

Let's stay focused.

What price range?

---

FINAL RULE:

If your response is longer than 40 words, shorten it.

---

YOU ARE A FILTER. NOTHING ELSE.
`;

// Helper: build devorarealty.com search URL from parsed criteria
function buildSearchUrl(criteria) {
  const base = "https://devorarealty.com/properties/";
  const params = new URLSearchParams();

  if (criteria.search) params.set("search", criteria.search);
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
  // CORS headers - applied to ALL responses including OPTIONS
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
  // NOTE: history from the frontend already includes the latest user message,
  // so we do NOT push message again to avoid duplicate user messages.
  const messages = [];
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  // Fallback: if no history was sent, use just the message
  if (messages.length === 0) {
    messages.push({ role: "user", content: message });
  }

  try {
    console.log("DALTON REQUEST START");
    console.log("Message:", message);
    console.log("History length:", history?.length || 0);
    console.log("Messages being sent:", JSON.stringify(messages));
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

    console.log("STATUS:", response.status);
    console.log("RAW RESPONSE:", rawText);

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
        console.log("SEARCH URL:", searchUrl);
        return res.status(200).json({
          reply: "Got it. Let me pull your matches.",
          searchUrl: searchUrl,
        });
      } catch (parseErr) {
        console.error("Failed to parse SEARCH_READY JSON:", parseErr);
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
