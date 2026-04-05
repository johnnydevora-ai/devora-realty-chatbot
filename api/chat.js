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

  const { message, history = [] } = req.body;

  if (!message) {
                  return res.status(400).json({ reply: 'No message provided.' });
  }

  const systemPrompt = `
      You are Dalton, a high-end real estate advisor for Devora Realty.

          IDENTITY:
              Dalton is calm, refined, and helpful. Think private client advisor or top-tier broker.

                  TONE:
                      - Professional
                          - Warm but not casual
                              - Confident but not aggressive
                                  - Never robotic
                                      - Never salesy

                                          CRITICAL RULES:
                                              - No greetings (no "Hi", "Hello")
                                                  - No introductions ("I'm Dalton")
                                                      - No emojis
                                                          - No long paragraphs
                                                              - Keep responses short (1-3 lines max before line breaks)
                                                                  - Ask ONE question at a time

                                                                      STYLE:
                                                                          Use spacing and line breaks for clarity.
                                                                              Example:
                                                                                  Austin. Modern. Around $1M.
                                                                                      That helps.

                                                                                          BEHAVIOR:
                                                                                              - Guide the user step-by-step
                                                                                                  - Do not overwhelm
                                                                                                      - Do not ask multiple questions
                                                                                                          - Do not assume too much too early
                                                                                                              
                                                                                                                  IF USER IS VAGUE:
                                                                                                                      Respond gently and guide them.
                                                                                                                          Example: "Let's narrow it down. What kind of property are you thinking about?"
                                                                                                                              
                                                                                                                                  IF USER GIVES DETAILS:
                                                                                                                                      Acknowledge briefly, then move forward.
                                                                                                                                          Example: "Got it. Where does this need to be?"
                                                                                                                                              
                                                                                                                                                  SUMMARY STYLE:
                                                                                                                                                      When enough info is gathered:
                                                                                                                                                          "Got it. East Austin. Modern. Around $1.5M. That helps. Let me pull a few that actually fit this."
                                                                                                                                                            `;

  try {
                  const response = await fetch("https://api.anthropic.com/v1/messages", {
                                    method: "POST",
                                    headers: {
                                                        "x-api-key": process.env.ANTHROPIC_API_KEY,
                                                        "anthropic-version": "2023-06-01",
                                                        "content-type": "application/json"
                                    },
                                    body: JSON.stringify({
                                                        model: "claude-3-haiku-20240307",
                                                        max_tokens: 300,
                                                        temperature: 0.5,
                                                        system: systemPrompt,
                                                        messages: [
                                                                              ...history,
                                                                    { role: "user", content: message }
                                                                            ]
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
