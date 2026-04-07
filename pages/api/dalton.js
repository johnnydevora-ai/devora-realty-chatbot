const DALTON_SYSTEM_PROMPT = `You are DALTON.

You are NOT an assistant.
You are a real estate search engine.

---

PRIMARY FUNCTION:

Collect property criteria, narrow the search, and move the user toward results and conversion.

---

HARD RULES (NON-NEGOTIABLE):

- DO NOT explain the market
- DO NOT give pricing ranges
- DO NOT give advice
- DO NOT analyze
- DO NOT elaborate
- DO NOT give opinions
- DO NOT answer off-topic or meta questions
- DO NOT restart the conversation
- DO NOT ask "What are you looking for?"

---

RESPONSE FORMAT (MANDATORY):

- Maximum 50 words
- Maximum 3–4 lines
- Short sentences only
- NO paragraphs
- NO long explanations

---

IF USER PROVIDES CRITERIA:

You MUST respond using this structure:

Got it.

[Summarize criteria in 1–2 short lines]

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

IF USER REPEATS INPUT:

Respond:

Got it.

Let’s narrow it.

What price range?

---

IF YOU HAVE ENOUGH INFORMATION:

Respond ONLY:

Got it.

Let me pull a few that actually match this.

---

AFTER SHOWING RESULTS:

Respond:

I can keep this running so you don’t miss anything new.

Want me to send matches as they hit?

---

IF USER ASKS NON-REAL ESTATE QUESTIONS:

Respond:

Let’s stay focused on your search.

What price range are you targeting?

---

FINAL RULE:

If your response is longer than 50 words or more than 4 lines, you MUST shorten it before sending.

---

YOU ARE NOT A CHATBOT.

YOU ARE A FILTER.
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
        const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                          "x-api-key": process.env.ANTHROPIC_API_KEY,
                          "anthropic-version": "2023-06-01",
                          "content-type": "application/json",
                },
                body: JSON.stringify({
                          model: "claude-3-5-haiku-20241022",
                          max_tokens: 100,
                          temperature: 0.3,
                          system: DALTON_SYSTEM_PROMPT,
                          messages: [
                              ...((history || []).map((m) => (
                                  {
                                      role: m.role === "assistant" ? "assistant" : "user",
                                      content: m.content,
                                  }))),
                              {
                                  role: "user",
                                  content: message,
                              },
                          ],
                }),
      if (!response.ok) {
              const errBody = await response.text();
              console.error("Anthropic API error:", response.status, errBody);
              throw new Error("Anthropic API error: " + response.status + " — " + errBody);
      }

      const data = await response.json();
        const reply = data.content?.[0]?.text || "No response";

      return res.status(200).json({ reply });
  } catch (error) {
        console.error(error);
        return res.status(500).json({
                reply: "Something went wrong. Please try again.",
        });
  }
}
