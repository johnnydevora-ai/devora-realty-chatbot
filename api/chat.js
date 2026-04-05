export default async function handler(req, res) {
          // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
              return res.status(200).end();
  }

  if (!req.body) {
              return res.status(400).json({ reply: 'No request body received.' });
  }

  // Accept both formats:
  // New format: { messages: [{role, content}, ...] }
  // Old format: { message: "string", history: [{role, content}, ...] }
  let messages = req.body.messages;

  if (!messages || !Array.isArray(messages)) {
              // Try to reconstruct from old { message, history } format
            const { message, history } = req.body;
              if (message) {
                            const historyArray = Array.isArray(history) ? history : [];
                            messages = [...historyArray, { role: 'user', content: message }];
              }
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
              return res.status(400).json({ reply: 'No messages provided.' });
  }

  // Filter out the hardcoded UI opening greeting so it is not sent to the AI
  const OPENING_MESSAGE = "Stop the scroll.\nTell me what you're actually looking for.\nSkip the filters. Just say it.";
          const filteredMessages = messages.filter(
                      (m) => !(m.role === 'assistant' && m.content === OPENING_MESSAGE)
                    );

  if (filteredMessages.length === 0 || filteredMessages[filteredMessages.length - 1].role !== 'user') {
              return res.status(400).json({ reply: 'No user message to respond to.' });
  }

  const systemPrompt = `You are Dalton, a refined real estate advisor for Devora Realty.
  You guide clients through property searches with clarity, confidence, and ease.

  IDENTITY:
  Dalton is not a chatbot. Dalton is a trusted advisor similar to a high-end real estate broker.

  TONE:
  - Polished, calm, clear, helpful, slightly warm
  - Never robotic, never salesy, never dismissive, never overly casual

  CRITICAL RULES:
  - No greetings (no "Hi", "Hello")
  - No introductions ("I'm Dalton")
  - No emojis
  - No long paragraphs
  - Keep responses concise and easy to read
  - Ask ONE question at a time

  OPENING EXPERIENCE:
  The UI already shows the opening message "Stop the scroll. Tell me what you're actually looking for. I'll narrow it down."
  Do NOT repeat this. Respond directly to what the user says.

  FLOW:
  1. Brief acknowledgment (optional)
  2. Light structure if helpful
  3. ONE clear next question

  GOOD EXAMPLE:
  "Got it.
  East Austin.
  Modern.
  What kind of budget are you thinking?"

  AVOID:
  - Multiple questions at once
  - Long explanations before asking a question
  - Sounding like an intake form

  If user is vague: "Let's narrow it down. What kind of property are you thinking about?"
  If user provides details: "Got it. Where does this need to be?"

  HANDLING TIGHT CONSTRAINTS:
  Don't say "That's a tight range." Instead: "That's going to be a stretch in that area right now."

  SUMMARY STYLE (when enough info gathered):
  "Got it.
  East Austin.
  Modern.
  Around $1M.
  That helps.
  Let me pull a few that actually fit this."

  You are guiding, not interrogating. Keep everything calm, clear, and intentional.`;

  try {
              const response = await fetch("https://api.anthropic.com/v1/messages", {
                            method: "POST",
                            headers: {
                                            "x-api-key": process.env.ANTHROPIC_API_KEY,
                                            "anthropic-version": "2023-06-01",
                                            "content-type": "application/json"
                            },
                            body: JSON.stringify({
                                            model: "claude-haiku-4-5-20251001",
                                            max_tokens: 300,
                                            temperature: 0.5,
                                            system: systemPrompt,
                                            messages: filteredMessages
                            })
              });

            const rawText = await response.text();
              console.error("STATUS:", response.status);
              console.error("ANTHROPIC RAW RESPONSE:", rawText);

            if (!response.ok) {
                          return res.status(500).json({ reply: "Something didn't come through. Try that again." });
            }

            const data = JSON.parse(rawText);
              const reply = data?.content?.[0]?.text || "Something didn't come through. Try that again.";

            res.json({ reply });
  } catch (error) {
              console.error("Anthropic fetch error:", error);
              res.json({ reply: "Something didn't come through. Try that again." });
  }
}
