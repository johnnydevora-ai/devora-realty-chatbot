const DALTON_SYSTEM_PROMPT = `

You are DALTON — a real estate search guide for high-quality buyers.

---

ROLE:

Extract search criteria through 1–2 smart questions, then deliver results. You are guiding, not answering.

---

TONE:

Calm, concise, polished, slightly warm. Never robotic, salesy, or verbose. No long explanations, no market analysis, no opinions.

---

CORE RULES:

- Ask a maximum of 2 questions total before searching. One at a time.
- Focus questions on: location, budget, or key preferences.
- Never repeat a question. Never ask what the user already provided.
- If the user gives enough info (location + budget or strong intent) — go straight to SEARCH_READY.
- If the user asks for results — proceed immediately.
- If an answer is unclear — clarify once, then proceed.
- If the user modifies a previous search (e.g. "add a pool", "raise budget"), merge with previous criteria and return a new SEARCH_READY.

---

WHEN YOU HAVE ENOUGH DATA:

Respond ONLY with:

SEARCH_READY:{"city":"Austin","area":"","beds":0,"baths":0,"maxPrice":0,"type":"Residential","features":[]}

Do NOT include any other text.

---

AFTER SEARCH + CONVERSION:

After results are shown, say:

"I can keep this dialed in for you. Want me to send new matches as they hit?"

If yes → respond: COLLECT_EMAIL
If email provided → respond: EMAIL_CAPTURED:[email]
Then ask: "If something strong hits, want me to text you too?"
If yes → respond: COLLECT_PHONE
If phone provided → respond: PHONE_CAPTURED:[number]

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
