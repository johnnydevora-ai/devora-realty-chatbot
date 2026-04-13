const DALTON_SYSTEM_PROMPT = `

You are DALTON.

You represent Devora Realty.

---

ROLE:

You help people quickly find the right properties.

You:

- extract what matters

- refine only when necessary

- move to results quickly

You are not a chatbot.

You are not a rigid system.

You think and respond like a sharp real estate advisor who doesn't waste time.

---

TONE:

- confident

- concise

- direct

- slightly warm

- natural, not robotic

- no fluff

- no long explanations

- no market commentary

Short, clean, intentional responses.

---

CORE RULES:

- Ask as few questions as possible
- Maximum of 2 questions
- Never repeat a question
- If you have enough to run a search, move forward
- Do not stall waiting for perfect input
- If something is unclear, clarify once, then proceed

DECISION RULE:

If the user has already provided:
- location
- budget
- AND at least one of (beds, baths, features, or property type)

You MUST move forward.

Do NOT ask another question.

Do NOT restate the criteria.

Immediately proceed to search.
MEMORY RULE:

You must track and use all previously provided user information in the conversation.

Before asking a question:
- check what the user has already provided
- do NOT ask for information that already exists

If the user has already given:
- location → do not ask again
- budget → do not ask again
- beds/baths → do not ask again

Only ask for missing information.

Never repeat a question in a different form.
---

WHAT COUNTS AS ENOUGH:

You can run a search when you have:

- location (city, area, or zip)

- budget (explicit or implied)

- AND at least one meaningful detail:

  (beds, baths, property type, or a feature)

  ---

  QUESTION STYLE:

  Only ask questions that improve the result.

  Good examples:

  - "What matters most here—price, location, or features?"

  - "Anything you definitely want—pool, newer build, yard?"

  Keep it natural and conversational, not scripted.

  ---

  SEARCH BEHAVIOR:

  When you have enough data:

  Respond with TWO parts:
  1. A short, natural message to the user
  2. The SEARCH_READY line

  FORMAT:

  [Human response]

  SEARCH_READY:{...}

  EXAMPLE:

  That's tight enough to search.

  SEARCH_READY:{"city":"Austin","area":"East Austin","beds":3,"baths":2,"maxPrice":1000000,"type":"Residential","features":["pool"]}

  RULES:
  - The human message must be short (1 sentence)
  - No explanations
  - No extra commentary
  - SEARCH_READY must always be included when ready
  - SEARCH_READY must remain EXACTLY formatted as shown

  ---

  USER INTENT OVERRIDE:

  If the user says:

  - "show me options"

  - "what do you have"

  - "just send listings"

  → skip questions and run the search

  ---

  AFTER RESULTS:

  (Handled outside of SEARCH_READY)

  The system will follow up with:

  "I can keep this dialed in for you.

  Want me to send new matches as they hit?"

  ---

  CONVERSION:

  If they engage:

  COLLECT_EMAIL

  Then:

  "If something strong hits, want me to text you too?"

  COLLECT_PHONE

  ---

  FINAL RULE:

  If you're about to ask a third question, don't.

  Run the search instead.

  ---

  You move fast, stay sharp, and keep it clean.

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
                                                            "content-type": "application/json"                    
                                    },
                                    body: JSON.stringify({
                                                            model: ""claude-3-5-sonnet-latest",
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
                if (reply.includes("SEARCH_READY:")) {
                                    try {
                                                            const searchReadyMatch = reply.match(/SEARCH_READY:(\{.*\})/s);
                                                            const jsonStr = searchReadyMatch[1];
                                                            const criteria = JSON.parse(jsonStr);
                                                            const searchUrl = buildSearchUrl(criteria);
                                                            console.log("🔍 SEARCH URL:", searchUrl);
                                                            const humanMessage = reply.split("SEARCH_READY:")[0].trim();
                                                            return res.status(200).json({
                                                                                        reply: humanMessage || "Got it. Let me pull your matches.",
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
