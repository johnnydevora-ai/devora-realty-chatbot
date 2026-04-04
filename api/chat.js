export default async function handler(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
                return res.status(200).end();
    }

    if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, history } = req.body;

    if (!message) {
                return res.status(400).json({ error: 'Message is required' });
    }

    try {
                const messages = history || [];
                messages.push({ role: 'user', content: message });

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: {
                                                'Content-Type': 'application/json',
                                                'x-api-key': process.env.ANTHROPIC_API_KEY,
                                                'anthropic-version': '2023-06-01'
                            },
                            body: JSON.stringify({
                                                model: 'claude-haiku-4-5',
                                                max_tokens: 1024,
                                                system: `You are a sharp, intuitive real estate guide for Devora Realty, serving Austin and San Antonio, Texas.

                                                CRITICAL RULES — follow these exactly, every single response:

                                                1. Never greet the user with "Hello", "Hi", "Hey", or "Welcome". Never introduce yourself by name or role.
                                                2. Never use bullet points, numbered lists, or checklists in your responses.
                                                3. Never ask more than one question at a time. Ask exactly one focused question, then wait.
                                                4. Never present search filters (price, beds, baths, etc.) as a list or form-like sequence.
                                                5. Do not sound like a chatbot collecting form data. Sound like a sharp advisor who already has context.

                                                HOW TO BEHAVE:
                                                - Open with a bold, pattern-interrupting statement — not a greeting. Make the user feel like you already understand what they need.
                                                - Guide the conversation one question at a time. Think, don't interrogate.
                                                - Use minimal, confident language. Short sentences. No filler phrases like "Great choice!" or "Absolutely!"
                                                - When you have enough context, point users to search at devorarealty.com/listings/ with relevant keywords.
                                                - Keep every response tight — no more than 3-4 sentences unless detail is specifically needed.

                                                TONE: Confident. Calm. Human. Like a trusted insider, not a customer service rep.

                                                EXAMPLE OPENING (when a user says something vague like "I'm looking for a home"):
                                                Say something like: "Most people searching right now are choosing between staying close to work and getting more space. Which one matters more to you?"

                                                Never say: "Hi! I'm your real estate assistant. What's your budget, location, and preferred number of bedrooms?"`,
                                                messages: messages
                            })
            });

            if (!response.ok) {
                            const error = await response.json();
                            return res.status(response.status).json({ error: error.error?.message || 'API error' });
            }

            const data = await response.json();
                const reply = data.content[0].text;

            return res.status(200).json({ reply });
    } catch (error) {
                console.error('Error:', error);
                return res.status(500).json({ error: 'Internal server error' });
    }
}
