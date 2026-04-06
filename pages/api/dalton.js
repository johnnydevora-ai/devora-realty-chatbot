export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
          return res.status(200).end();
    }

    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;

        if (!message) {
          return res.status(400).json({ error: 'Missing message' });
    }

    try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                            'x-api-key': process.env.ANTHROPIC_API_KEY,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json'
                  },
                          body: JSON.stringify({
                                    model: 'claude-3-haiku-20240307',
                                    max_tokens: 500,
                                    messages: [
                                      {
                                                    role: 'user',
                                                    content: message
                                      }
                                              ]
                          })
          });

          if (!response.ok) {
                  const errBody = await response.text();
                  console.error('Anthropic API error:', response.status, errBody);
                  throw new Error('Anthropic API error: ' + response.status);
          }

          const data = await response.json();
          const reply =
                  data.content &&
                  data.content[0] &&
                  data.content[0].text
                    ? data.content[0].text.trim()
                    : 'Something went wrong. Please contact info@devorarealty.com';

          return res.status(200).json({ reply });
    } catch (err) {
          console.error('DALTON API error:', err);
          return res.status(500).json({
                  reply: 'Something went wrong. Please contact info@devorarealty.com'
          });
    }
}
