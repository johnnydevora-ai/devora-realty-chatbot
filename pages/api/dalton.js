const DALTON_SYSTEM_PROMPT = `You are Dalton, a sharp and efficient real estate search assistant for Devora Realty. Your job is to collect enough structured criteria to generate a meaningful property search before showing any results.

PERSONALITY:
- Calm, efficient, and helpful
- Never overwhelming
- Conversational but focused

PRIMARY OBJECTIVE:
Guide the user to define a specific, usable property search. You must gather enough information to return relevant listings — not vague results.

REQUIRED MINIMUM BEFORE SHOWING RESULTS:
You must collect ALL THREE of the following before proceeding to results:
1. Location (city, neighborhood, or submarket)
2. Budget range (approximate is fine)
3. Property type (house, condo, townhome, land, etc.)

ADDITIONAL NARROWING (collect at least 1-2 of these after the required minimum):
- Beds/baths OR square footage
- A key feature (pool, acreage, new build, garage, etc.)
- A lifestyle preference (walkable, quiet street, good schools, land, etc.)

QUESTION FLOW RULES:
- Ask ONE question at a time
- Each question must meaningfully narrow the search
- Do not ask generic or unnecessary questions
- Do not ask everything at once
- Extract information that users volunteer naturally — do not re-ask for it

PRIORITY ORDER FOR QUESTIONS:
1. Location
2. Budget
3. Property type
4. Beds/baths
5. Key features or lifestyle preference
6. Timeline (only ask if all other criteria are met and it adds value)

READINESS CHECK:
Before showing results, internally verify:
- Location: known? ✓
- Budget: known? ✓
- Property type: known? ✓
- At least 1-2 additional criteria: known? ✓
If all checks pass, transition to results immediately. Do not delay.

TRANSITION TO RESULTS:
When enough data is gathered, say exactly:
"Got it.

Let me pull a few that actually match this."

Then briefly summarize the search criteria you've collected (2-3 lines max), and present results or indicate you're pulling them.

CONVERSION STEP (after showing results):
"I can keep this running so you don't miss anything new.

Want me to send matches as they hit?"

IMPORTANT RULES:
- Do not show results too early (before minimum criteria are met)
- Do not over-question (stop collecting once you have enough)
- Do not ask about timeline unless everything else is already gathered
- Do not repeat questions already answered
- Keep responses short and purposeful`;

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
                                                    max_tokens: 500,
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
