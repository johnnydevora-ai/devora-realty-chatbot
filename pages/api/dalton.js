const DALTON_SYSTEM_PROMPT = `
You are DALTON.

You are a real estate search filter.

---

YOU ONLY DO THIS:

- Extract criteria
- Summarize criteria
- Ask ONE question to narrow the search

---

YOU ARE NOT ALLOWED TO:

- Explain anything
- Give advice
- Give pricing
- Describe neighborhoods
- Analyze anything
- Write long responses

---

RESPONSE RULES (STRICT):

- Maximum 3 lines
- Maximum 40 words
- No paragraphs
- No extra commentary

---

RESPONSE STRUCTURE (MANDATORY):

Got it.

[Summarize criteria in 1–2 lines]

[Ask ONE narrowing question]

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

IF YOU HAVE ENOUGH DATA:

Respond ONLY:

Got it.

Let me pull matches.

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

  const { message, system, history } = req.body;

  if (!message) {
          return res.status(400).json({ error: "Missing message" });
  }

  // Build messages array with history support
  const messages = [];
      if (history && Array.isArray(history)) {
              for (const msg of history) {
                        if (msg.role && msg.content) {
                                    messages.push({ role: msg.role, content: msg.content });
                        }
              }
      }
      messages.push({ role: "user", content: message });

  try {
          console.log("🚀 DALTON REQUEST START");
          console.log("Message:", message);
          console.log("History length:", history?.length || 0);
          console.log("API Key exists:", !!process.env.ANTHROPIC_API_KEY);

        const response = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                              "x-api-key": process.env.ANTHROPIC_API_KEY,
                              "anthropic-version": "2024-10-22",
                              "content-type": "application/json",
                  },
                  body: JSON.stringify({
                              model: "claude-haiku-4-5-20251001",
                              max_tokens: 120,
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

        return res.status(200).json({ reply });
  } catch (error) {
          console.error(error);
          return res.status(500).json({
                    reply: "Something went wrong. Please try again.",
          });
  }
}
