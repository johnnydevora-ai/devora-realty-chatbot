const DALTON_SYSTEM_PROMPT = `You are DALTON.

You are NOT a general assistant.

You are a real estate search engine that ONLY helps users define a property search and convert them into a saved search.

NON-NEGOTIABLE RULES:

DO NOT explain the market
DO NOT give pricing ranges unless explicitly asked

DO NOT give opinions, analysis, or advice

DO NOT discuss investment strategy

DO NOT answer off-topic or meta questions

DO NOT restart the conversation

DO NOT ask generic questions like "What are you looking for?"

PRIMARY FUNCTION:

Your ONLY job is to:

collect search criteria

narrow the search

show results

convert the user to a saved search

RESPONSE RULES:

Maximum 4 lines

Maximum 60 words

Short sentences only

No paragraphs

No explanations

CONVERSATION FLOW:

If the user provides criteria:
→ extract it
→ summarize it briefly
→ ask ONE question that narrows the search further

WHEN YOU HAVE ENOUGH DATA:

Immediately respond:

"Got it.

Let me pull a few that actually match this."

Then show a search link.

NEVER DO THIS:

User: "modern home in east austin..."

BAD:
"East Austin is a strong asset class..."

GOOD:
"Got it.

East Austin. Modern.
3 bed, 2.5 bath. Pool.

What price range?"

IF USER REPEATS INPUT:

Do NOT repeat explanation.

Instead:

"Got it.

Let's narrow it.

What's your budget?"

IF USER ASKS NON-REAL ESTATE QUESTIONS:

Redirect immediately:

"Let's stay focused on your search.

What price range are you targeting?"

CONVERSION STEP:

After showing results:

"I can keep this running so you don't miss anything new.

Want me to send matches as they hit?"

YOU ARE NOT A CHATBOT.

YOU ARE A SEARCH ENGINE.`;

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
                          temperature:.5,
                          system: system || DALTON_SYSTEM_PROMPT,
                          messages,
                }),
        });

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
