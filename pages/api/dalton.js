// api/dalton.js
// Devora Realty — Dalton Next.js API Route
// Central + South Texas Phase One Routing Engine

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

/* =========================================================
   DEVORA BASE
========================================================= */
const DEVORA_BASE = "https://devorarealty.com";

/* =========================================================
   DALTON CITY LOGIC TABLE
   direct  = verified working city slug route
   proxy   = route to stronger parent market
   keyword = submarket/neighborhood + parent market
========================================================= */
const DALTON_CITY_LOGIC = {
  /* ===== AUSTIN CORE / VERIFIED ===== */
  "austin":           { type: "direct", slug: "Austin,%20TX" },
  "cedar park":       { type: "direct", slug: "Cedar%20Park,%20TX" },
  "round rock":       { type: "direct", slug: "Round%20Rock,%20TX" },
  "georgetown":       { type: "direct", slug: "Georgetown,%20TX" },
  "leander":          { type: "direct", slug: "Leander,%20TX" },
  "pflugerville":     { type: "direct", slug: "Pflugerville,%20TX" },
  "dripping springs": { type: "direct", slug: "Dripping%20Springs,%20TX" },
  "buda":             { type: "direct", slug: "Buda,%20TX" },
  "kyle":             { type: "direct", slug: "Kyle,%20TX" },
  "manor":            { type: "direct", slug: "Manor,%20TX" },
  "elgin":            { type: "direct", slug: "Elgin,%20TX" },
  "liberty hill":     { type: "direct", slug: "Liberty%20Hill,%20TX" },
  "hutto":            { type: "direct", slug: "Hutto,%20TX" },
  "bastrop":          { type: "direct", slug: "Bastrop,%20TX" },
  "lockhart":         { type: "direct", slug: "Lockhart,%20TX" },
  "wimberley":        { type: "direct", slug: "Wimberley,%20TX" },
  "johnson city":     { type: "direct", slug: "Johnson%20City,%20TX" },

  /* ===== AUSTIN LUXURY / PROXY ===== */
  "west lake hills": { type: "proxy", route: "austin_luxury_west", message: "Running Austin westside luxury inventory now." },
  "west lake":       { type: "proxy", route: "austin_luxury_west", message: "Running Austin westside luxury inventory now." },
  "westlake":        { type: "proxy", route: "austin_luxury_west", message: "Running Austin westside luxury inventory now." },
  "rollingwood":     { type: "proxy", route: "austin_luxury_west", message: "Running Austin close-in luxury inventory now." },
  "bee cave":        { type: "proxy", route: "austin_luxury_west", message: "Running west Austin / Bee Cave luxury inventory now." },
  "lakeway":         { type: "proxy", route: "austin_lake_luxury", message: "Running Lake Travis area luxury inventory now." },

  /* ===== AUSTIN SUBMARKETS ===== */
  "east austin":     { type: "keyword", parent: "Austin,%20TX", keyword: "East Austin" },
  "mueller":         { type: "keyword", parent: "Austin,%20TX", keyword: "Mueller" },
  "tarrytown":       { type: "keyword", parent: "Austin,%20TX", keyword: "Tarrytown" },
  "clarksville":     { type: "keyword", parent: "Austin,%20TX", keyword: "Clarksville" },
  "south congress":  { type: "keyword", parent: "Austin,%20TX", keyword: "South Congress" },
  "zilker":          { type: "keyword", parent: "Austin,%20TX", keyword: "Zilker" },
  "rainey":          { type: "keyword", parent: "Austin,%20TX", keyword: "Rainey" },

  /* ===== SAN ANTONIO VERIFIED ===== */
  "san antonio":     { type: "direct", slug: "San%20Antonio,%20TX" },
  "boerne":          { type: "direct", slug: "Boerne,%20TX" },
  "helotes":         { type: "direct", slug: "Helotes,%20TX" },
  "bulverde":        { type: "direct", slug: "Bulverde,%20TX" },
  "spring branch":   { type: "direct", slug: "Spring%20Branch,%20TX" },
  "schertz":         { type: "direct", slug: "Schertz,%20TX" },
  "cibolo":          { type: "direct", slug: "Cibolo,%20TX" },
  "new braunfels":   { type: "direct", slug: "New%20Braunfels,%20TX" },
  "seguin":          { type: "direct", slug: "Seguin,%20TX" },
  "floresville":     { type: "direct", slug: "Floresville,%20TX" },
  "castroville":     { type: "direct", slug: "Castroville,%20TX" },
  "la vernia":       { type: "direct", slug: "La%20Vernia,%20TX" },
  "converse":        { type: "direct", slug: "Converse,%20TX" },

  /* ===== SAN ANTONIO LUXURY PROXY ===== */
  "alamo heights":    { type: "proxy", route: "sanantonio_luxury_core",  message: "Running San Antonio close-in luxury inventory now." },
  "terrell hills":    { type: "proxy", route: "sanantonio_luxury_core",  message: "Running San Antonio close-in luxury inventory now." },
  "olmos park":       { type: "proxy", route: "sanantonio_luxury_core",  message: "Running San Antonio close-in luxury inventory now." },
  "shavano park":     { type: "proxy", route: "sanantonio_north_luxury", message: "Running north San Antonio luxury inventory now." },
  "fair oaks ranch":  { type: "proxy", route: "boerne_luxury",           message: "Running Boerne / Fair Oaks Ranch inventory now." },

  /* ===== HIGHLAND LAKES VERIFIED ===== */
  "spicewood":     { type: "direct", slug: "Spicewood,%20TX" },
  "marble falls":  { type: "direct", slug: "Marble%20Falls,%20TX" },
  "horseshoe bay": { type: "direct", slug: "Horseshoe%20Bay,%20TX" },
  "kingsland":     { type: "direct", slug: "Kingsland,%20TX" },
  "burnet":        { type: "direct", slug: "Burnet,%20TX" },
  "llano":         { type: "direct", slug: "Llano,%20TX" },

  /* ===== LAKE PROXY ===== */
  "lago vista": { type: "proxy", route: "lake_inventory", message: "Running nearby lake inventory now." },
  "jonestown":  { type: "proxy", route: "lake_inventory", message: "Running nearby lake inventory now." },

  /* ===== COASTAL / SPECIALTY ===== */
  "rockport":       { type: "direct", slug: "Rockport,%20TX" },
  "port aransas":   { type: "direct", slug: "Port%20Aransas,%20TX" },
  "corpus christi": { type: "direct", slug: "Corpus%20Christi,%20TX" },
  "falls city":     { type: "direct", slug: "Falls%20City,%20TX" },
  "poth":           { type: "direct", slug: "Poth,%20TX" }
};

/* =========================================================
   PROXY ROUTE PRESETS (V1 defaults)
========================================================= */
const PROXY_ROUTES = {
  austin_luxury_west:       "/properties/city-Austin,%20TX/?priceMin=1500000",
  austin_lake_luxury:       "/properties/city-Austin,%20TX/?priceMin=1200000&keyword=Lake%20Travis",
  sanantonio_luxury_core:   "/properties/city-San%20Antonio,%20TX/?priceMin=900000",
  sanantonio_north_luxury:  "/properties/city-San%20Antonio,%20TX/?priceMin=750000",
  boerne_luxury:            "/properties/city-Boerne,%20TX/?priceMin=800000",
  lake_inventory:           "/properties/city-Spicewood,%20TX/?priceMin=700000"
};

/* =========================================================
   INPUT ALIASES
========================================================= */
const CITY_ALIASES = {
  "atx": "austin",
  "austin tx": "austin",
  "satx": "san antonio",
  "sa": "san antonio",
  "san antonio tx": "san antonio",
  "westlake": "west lake",
  "nb": "new braunfels",
  "cc": "corpus christi",
  "rr": "round rock"
};

/* =========================================================
   NORMALIZER
   - lowercase
   - trim
   - strip punctuation (keeps spaces)
   - collapse whitespace
   - apply alias map (full-string match)
========================================================= */
function normalizeCityInput(raw) {
  if (!raw) return "";
  let s = String(raw).toLowerCase();
  // strip punctuation (keep letters, numbers, spaces)
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // alias (full-string)
  if (CITY_ALIASES[s]) s = CITY_ALIASES[s];
  return s;
}

/* =========================================================
   TEXT NORMALIZER (used for combined conversation text)
========================================================= */
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

/* =========================================================
   EXTRACT CITY FROM FREE-FORM TEXT
   - normalize entire text (incl. alias map applied as token swaps)
   - longest-key match wins ("west lake hills" beats "west lake")
========================================================= */
function applyAliasTokens(text) {
  // token-level alias swap for shorthand that appears mid-sentence
  // (e.g. "show me atx under 900k")
  let out = " " + text + " ";
  for (const [alias, full] of Object.entries(CITY_ALIASES)) {
    const re = new RegExp(`\\s${alias}\\s`, "g");
    out = out.replace(re, ` ${full} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

function extractCityFromText(rawText) {
  if (!rawText) return null;
  let text = String(rawText).toLowerCase();
  text = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  text = applyAliasTokens(text);

  // sort keys longest-first so multi-word cities win
  const keys = Object.keys(DALTON_CITY_LOGIC).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const re = new RegExp(`(^|\\s)${key}(\\s|$)`, "i");
    if (re.test(text)) return key;
  }
  return null;
}

/* =========================================================
   RESOLVER
   Returns: { type, url, message? }
   type = "direct" | "proxy" | "keyword" | "fallback"
========================================================= */
function resolveCityRoute(rawCityOrText) {
  // 1) Try as a clean city string first
  const normalized = normalizeCityInput(rawCityOrText);
  let key = DALTON_CITY_LOGIC[normalized] ? normalized : null;

  // 2) If no direct hit, try to extract a known city from free-form text
  if (!key) key = extractCityFromText(rawCityOrText);

  if (!key) {
    return {
      type: "fallback",
      url: null,
      message:
        "That market isn't mapping cleanly in our live feed. Want Austin, San Antonio, or Highland Lakes inventory instead?"
    };
  }

  const entry = DALTON_CITY_LOGIC[key];

  if (entry.type === "direct") {
    return {
      type: "direct",
      url: `${DEVORA_BASE}/properties/city-${entry.slug}/`,
      matchedCity: key
    };
  }

  if (entry.type === "proxy") {
    const preset = PROXY_ROUTES[entry.route];
    if (!preset) {
      return {
        type: "fallback",
        url: null,
        message:
          "That market isn't mapping cleanly in our live feed. Want Austin, San Antonio, or Highland Lakes inventory instead?"
      };
    }
    return {
      type: "proxy",
      route: entry.route,
      url: `${DEVORA_BASE}${preset}`,
      message: entry.message,
      matchedCity: key
    };
  }

  if (entry.type === "keyword") {
    return {
      type: "keyword",
      url: `${DEVORA_BASE}/properties/city-${entry.parent}/?keyword=${encodeURIComponent(entry.keyword)}`,
      matchedCity: key,
      keyword: entry.keyword
    };
  }

  // Safety net
  return {
    type: "fallback",
    url: null,
    message:
      "That market isn't mapping cleanly in our live feed. Want Austin, San Antonio, or Highland Lakes inventory instead?"
  };
}

/* =========================================================
   SIGNAL EXTRACTION (unchanged intent, city list widened via resolver)
========================================================= */
function extractSignals(text) {
  const t = normalizeText(text).toLowerCase();
  const signals = { hasLocation: false, hasSignal: false };

  // LOCATION — any known city/alias counts
  if (extractCityFromText(t)) signals.hasLocation = true;

  // ZIPs (TX 78xxx / 79xxx)
  if (/\b78\d{3}|79\d{3}\b/.test(t)) signals.hasLocation = true;

  // BEDS / BATHS
  if (/\d+\s*(bed|beds|bedroom)/.test(t)) signals.hasSignal = true;
  if (/\d+\s*(bath|baths|bathroom)/.test(t)) signals.hasSignal = true;

  // PRICE (1.2m, 900k, $850000)
  if (/\d+(\.\d+)?\s*m\b/.test(t) || /\d+\s*k\b/.test(t) || /\$\d+/.test(t)) {
    signals.hasSignal = true;
  }

  return signals;
}

function shouldTriggerSearch(combinedText) {
  const s = extractSignals(combinedText);
  return s.hasLocation && s.hasSignal;
}

/* =========================================================
   BUILD SEARCH URL
   - Uses resolveCityRoute() when a known city is detected
   - Falls back to generic ?search= for unknown markets
========================================================= */
function buildSearchUrl(text) {
  const route = resolveCityRoute(text);

  if (route.type === "direct" || route.type === "proxy" || route.type === "keyword") {
    return {
      url: route.url,
      routeType: route.type,
      matchedCity: route.matchedCity || null,
      message: route.message || null
    };
  }

  // fallback: generic search
  return {
    url: `${DEVORA_BASE}/properties/?search=${encodeURIComponent(text)}`,
    routeType: "fallback",
    matchedCity: null,
    message: route.message
  };
}

/* =========================================================
   OPENAI
========================================================= */
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
      messages: [{ role: "system", content: prompt }, ...messages]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.choices?.[0]?.message?.content || "No response";
}

/* =========================================================
   HANDLER
========================================================= */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });

  // Build conversation
  const messages = [];
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg?.role && msg?.content) {
        messages.push({ role: msg.role, content: normalizeText(msg.content) });
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

    // STEP 1 — TRIGGER SEARCH
    if (shouldTriggerSearch(combinedText)) {
      const built = buildSearchUrl(combinedText);
      console.log("🔥 SEARCH TRIGGERED:", built);

      const reply =
        built.message ||
        (built.routeType === "fallback"
          ? "That market isn't mapping cleanly in our live feed. Want Austin, San Antonio, or Highland Lakes inventory instead?"
          : "Got it. Pulling options for you now.");

      return res.status(200).json({
        reply,
        searchUrl: built.url,
        routeType: built.routeType,
        matchedCity: built.matchedCity
      });
    }

    // STEP 2 — CONVERSATION MODE
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
