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

  const { message, system } = req.body;

  if (!message) {
        return res.status(400).json({ error: "Missing message" });
  }

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
                          max_tokens: 500,
                          system: system || "",
                          messages: [
                            {
                                          role: "user",
                                          content: message,
                            },
                                    ],
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
