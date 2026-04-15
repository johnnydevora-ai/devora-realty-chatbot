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

You think and respond like a sharp real estate advisor who doesn't waste time and wants to get right down to matching them with the perfect property.

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

Short, clean, intentional and respectful responses.

---

CORE RULES:

- Ask as few questions as possible
- Maximum of 3 questions
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

function buildSearchUrl(criteria) {
  const base = "https://devorarealty.com/properties/";
  const params = new URLSearchParams();

  if (criteria.city) params.set("search", criteria.city);
  if (criteria.area) params.set("search", criteria.area);
  if (criteria.zip) params.set("search", criteria.zip);
  if (criteria.beds) params.set("beds", String(criteria.beds));
  if (criteria.baths) params.set("baths", String(criteria.baths));
  if (criteria.maxPrice) params.set("maxPrice", String(criteria.maxPrice));

  return `${base}?${params.toString()}`;
}

// 🔥 SIMPLE CRITERIA PARSER (server-side)
function extractCriteria(text) {
  const criteria = {};

  const lower = text.toLowerCase();

  if (lower.includes("austin")) criteria.city = "Austin";
  if (lower.includes("east austin")) criteria.area = "East Austin";

  const zipMatch = text.match(/787\d{2}/);
  if (zipMatch) criteria.zip = zipMatch[0];

  const beds = text.match(/(\d+)\s*bed/);
  if (beds) criteria.beds = Number(beds[1]);

  const baths = text.match(/(\d+)\s*bath/);
  if (baths) criteria.baths = Number(baths[1]);

  const price = text.match(/(\d+(\.\d+)?)\s?m/i);
  if (price) criteria.maxPrice = Number(price[1]) * 1000000;

  return criteria;
}

export default async function handler(req, res) {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    // 🔥 STEP 1: EXTRACT DATA FIRST
    const extracted = extractCriteria(message);

    const hasLocation =
      extracted.city || extracted.area || extracted.zip;

    const hasSignal =
      extracted.maxPrice ||
      extracted.beds ||
      extracted.baths;

    // 🚀 🔥 STEP 2: TRIGGER SEARCH BEFORE AI
    if (hasLocation && hasSignal) {
      const searchUrl = buildSearchUrl(extracted);

      return res.status(200).json({
        reply: "Got it. Pulling options for you now.",
        searchUrl
      });
    }

    // 🧠 STEP 3: FALLBACK TO AI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPEN_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: DALTON_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response";

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({
      reply: "Something went wrong.",
      error: error.message
    });
  }
}
