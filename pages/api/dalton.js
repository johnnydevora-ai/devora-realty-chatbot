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

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getCombinedUserText(messages) {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => normalizeText(m.content))
    .join(" ")
    .trim();
}

// 🔥 Extract signals (simple + reliable)
function extractSignals(text) {
  const t = normalizeText(text).toLowerCase();

  const signals = {
    hasLocation: false,
    hasSignal: false
  };

  // LOCATION
  if (/\baustin|san antonio|east austin|westlake|lakeway|bee cave\b/.test(t)) {
    signals.hasLocation = true;
  }

  if (/\b78\d{3}|79\d{3}\b/.test(t)) {
    signals.hasLocation = true;
  }

  // BEDS / BATHS
  if (/\d+\s*(bed|beds|bedroom)/.test(t)) {
    signals.hasSignal = true;
  }

  if (/\d+\s*(bath|baths|bathroom)/.test(t)) {
    signals.hasSignal = true;
  }

  // PRICE
  if (/\d+(\.\d+)?\s*m\b/.test(t) || /\d+\s*k\b/.test(t) || /\$\d+/.test(t)) {
    signals.hasSignal = true;
  }

  return signals;
}

// 🔥 Trigger logic
function shouldTriggerSearch(combinedText) {
  const s = extractSignals(combinedText);
  return s.hasLocation && s.hasSignal;
}

// 🔥 Build working search URL (THIS IS YOUR ENGINE)
function buildSearchUrl(text) {
  return `https://devorarealty.com/properties/?search=${encodeURIComponent(text)}`;
}

// 🔥 OpenAI call
async function callOpenAI(messages, prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPEN_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: "system", content: prompt },
        ...messages
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.choices?.[0]?.message?.content || "No response";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  // 🔥 Build conversation
  const messages = [];
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg?.role && msg?.content) {
        messages.push({
          role: msg.role,
          content: normalizeText(msg.content)
        });
      }
    }
  }

  if (!messages.length) {
    messages.push({ role: "user", content: normalizeText(message) });
  }

  try {
    const combinedText = getCombinedUserText(messages);

    console.log("🚀 DALTON REQUEST");
    console.log("Combined:", combinedText);

    // 🔥 STEP 1 — TRIGGER SEARCH
    if (shouldTriggerSearch(combinedText)) {
      const searchUrl = buildSearchUrl(combinedText);

      console.log("🔥 SEARCH TRIGGERED:", searchUrl);

      return res.status(200).json({
        reply: "Got it. Pulling options for you now.",
        searchUrl
      });
    }

    // 🔥 STEP 2 — CONVERSATION MODE
    const reply = await callOpenAI(messages, DALTON_SYSTEM_PROMPT);

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("❌ DALTON ERROR:", error);

    return res.status(500).json({
      reply: "Something went wrong. Please try again.",
      error: error.message
    });
  }
}
