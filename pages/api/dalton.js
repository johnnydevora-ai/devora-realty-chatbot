// api/dalton.js
// Devora Realty — Dalton V2 (Central + South Texas Routing Engine)

const DALTON_SYSTEM_PROMPT = `
You are DALTON. You represent Devora Realty.
ROLE: help people quickly find the right properties. Extract what matters, refine only when necessary, move to results quickly. You are a sharp real estate advisor, not a chatbot.
TONE: confident, concise, direct, slightly warm, natural. No fluff. No market commentary. Short, clean, intentional.
CORE RULES:
- Ask as few questions as possible (max 3).
- Never repeat a question.
- If you have enough to search, move forward.
- MEMORY: track all prior info. Never re-ask for location, budget, beds, or baths already given. Only ask for missing info.
DECISION: if the user has location + budget + at least one of (beds, baths, features, type), move forward immediately. Do not restate criteria.
SEARCH BEHAVIOR: when ready, reply with a 1-sentence message only. The backend handles the URL.
INTENT OVERRIDE: "show me options" / "what do you have" / "just send listings" → run the search.
AFTER RESULTS: follow up with "Want me to save this search and alert you when something better hits?"
FINAL RULE: if about to ask a 3rd question, don't. Run the search.
`;

const DEVORA_BASE = "https://devorarealty.com";

const DALTON_CITY_LOGIC = {
  "austin": { type: "direct", slug: "Austin,%20TX" },
  "cedar park": { type: "direct", slug: "Cedar%20Park,%20TX" },
  "round rock": { type: "direct", slug: "Round%20Rock,%20TX" },
  "georgetown": { type: "direct", slug: "Georgetown,%20TX" },
  "leander": { type: "direct", slug: "Leander,%20TX" },
  "pflugerville": { type: "direct", slug: "Pflugerville,%20TX" },
  "dripping springs": { type: "direct", slug: "Dripping%20Springs,%20TX" },
  "buda": { type: "direct", slug: "Buda,%20TX" },
  "kyle": { type: "direct", slug: "Kyle,%20TX" },
  "manor": { type: "direct", slug: "Manor,%20TX" },
  "elgin": { type: "direct", slug: "Elgin,%20TX" },
  "liberty hill": { type: "direct", slug: "Liberty%20Hill,%20TX" },
  "hutto": { type: "direct", slug: "Hutto,%20TX" },
  "bastrop": { type: "direct", slug: "Bastrop,%20TX" },
  "lockhart": { type: "direct", slug: "Lockhart,%20TX" },
  "wimberley": { type: "direct", slug: "Wimberley,%20TX" },
  "johnson city": { type: "direct", slug: "Johnson%20City,%20TX" },
  "west lake hills": { type: "proxy", route: "austin_luxury_west", message: "Running Austin westside luxury inventory now." },
  "west lake": { type: "proxy", route: "austin_luxury_west", message: "Running Austin westside luxury inventory now." },
  "westlake": { type: "proxy", route: "austin_luxury_west", message: "Running Austin westside luxury inventory now." },
  "rollingwood": { type: "proxy", route: "austin_luxury_west", message: "Running Austin close-in luxury inventory now." },
  "bee cave": { type: "proxy", route: "austin_luxury_west", message: "Running west Austin / Bee Cave luxury inventory now." },
  "lakeway": { type: "proxy", route: "austin_lake_luxury", message: "Running Lake Travis area luxury inventory now." },
  "east austin": { type: "keyword", parent: "Austin,%20TX", keyword: "East Austin" },
  "mueller": { type: "keyword", parent: "Austin,%20TX", keyword: "Mueller" },
  "tarrytown": { type: "keyword", parent: "Austin,%20TX", keyword: "Tarrytown" },
  "clarksville": { type: "keyword", parent: "Austin,%20TX", keyword: "Clarksville" },
  "south congress": { type: "keyword", parent: "Austin,%20TX", keyword: "South Congress" },
  "zilker": { type: "keyword", parent: "Austin,%20TX", keyword: "Zilker" },
  "rainey": { type: "keyword", parent: "Austin,%20TX", keyword: "Rainey" },
  "san antonio": { type: "direct", slug: "San%20Antonio,%20TX" },
  "boerne": { type: "direct", slug: "Boerne,%20TX" },
  "helotes": { type: "direct", slug: "Helotes,%20TX" },
  "bulverde": { type: "direct", slug: "Bulverde,%20TX" },
  "spring branch": { type: "direct", slug: "Spring%20Branch,%20TX" },
  "schertz": { type: "direct", slug: "Schertz,%20TX" },
  "cibolo": { type: "direct", slug: "Cibolo,%20TX" },
  "new braunfels": { type: "direct", slug: "New%20Braunfels,%20TX" },
  "seguin": { type: "direct", slug: "Seguin,%20TX" },
  "floresville": { type: "direct", slug: "Floresville,%20TX" },
  "castroville": { type: "direct", slug: "Castroville,%20TX" },
  "la vernia": { type: "direct", slug: "La%20Vernia,%20TX" },
  "converse": { type: "direct", slug: "Converse,%20TX" },
  "alamo heights": { type: "proxy", route: "sanantonio_luxury_core", message: "Running San Antonio close-in luxury inventory now." },
  "terrell hills": { type: "proxy", route: "sanantonio_luxury_core", message: "Running San Antonio close-in luxury inventory now." },
  "olmos park": { type: "proxy", route: "sanantonio_luxury_core", message: "Running San Antonio close-in luxury inventory now." },
  "shavano park": { type: "proxy", route: "sanantonio_north_luxury", message: "Running north San Antonio luxury inventory now." },
  "fair oaks ranch": { type: "proxy", route: "boerne_luxury", message: "Running Boerne / Fair Oaks Ranch inventory now." },
  "spicewood": { type: "direct", slug: "Spicewood,%20TX" },
  "marble falls": { type: "direct", slug: "Marble%20Falls,%20TX" },
  "horseshoe bay": { type: "direct", slug: "Horseshoe%20Bay,%20TX" },
  "kingsland": { type: "direct", slug: "Kingsland,%20TX" },
  "burnet": { type: "direct", slug: "Burnet,%20TX" },
  "llano": { type: "direct", slug: "Llano,%20TX" },
  "lago vista": { type: "proxy", route: "lake_inventory", message: "Running nearby lake inventory now." },
  "jonestown": { type: "proxy", route: "lake_inventory", message: "Running nearby lake inventory now." },
  "rockport": { type: "direct", slug: "Rockport,%20TX" },
  "port aransas": { type: "direct", slug: "Port%20Aransas,%20TX" },
  "corpus christi": { type: "direct", slug: "Corpus%20Christi,%20TX" },
  "falls city": { type: "direct", slug: "Falls%20City,%20TX" },
  "poth": { type: "direct", slug: "Poth,%20TX" }
};

const PROXY_PRESETS = {
  austin_luxury_west: { slug: "Austin,%20TX", params: { priceMin: 1500000 } },
  austin_lake_luxury: { slug: "Austin,%20TX", params: { priceMin: 1200000, keyword: "Lake Travis" } },
  sanantonio_luxury_core: { slug: "San%20Antonio,%20TX", params: { priceMin: 900000 } },
  sanantonio_north_luxury: { slug: "San%20Antonio,%20TX", params: { priceMin: 750000 } },
  boerne_luxury: { slug: "Boerne,%20TX", params: { priceMin: 800000 } },
  lake_inventory: { slug: "Spicewood,%20TX", params: { priceMin: 700000 } }
};

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

const RESET_TRIGGERS = ["reset", "start over", "new search", "clear filters", "clear search", "restart"];

function normalizeText(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function applyAliasTokens(text) {
  let out = " " + text + " ";
  for (const [alias, full] of Object.entries(CITY_ALIASES)) {
    out = out.replace(new RegExp(`\\s${alias}\\s`, "g"), ` ${full} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

function extractCityFromText(raw) {
  if (!raw) return null;
  let t = String(raw).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  t = applyAliasTokens(t);
  const keys = Object.keys(DALTON_CITY_LOGIC).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (new RegExp(`(^|\\s)${k}(\\s|$)`, "i").test(t)) return k;
  }
  return null;
}

function toNumber(numStr, suffix) {
  const n = parseFloat(String(numStr).replace(/,/g, ""));
  if (isNaN(n)) return null;
  const s = (suffix || "").toLowerCase();
  if (s === "m" || s === "million") return Math.round(n * 1000000);
  if (s === "k" || s === "thousand") return Math.round(n * 1000);
  return Math.round(n);
}

function parsePriceTokens(text) {
  const t = text.toLowerCase();
  const state = {};
  const under = t.match(/(?:under|below|less than|max(?:imum)?|up to)\s*\$?\s*([\d.,]+)\s*(k|m|million|thousand)?/);
  if (under) state.priceMax = toNumber(under[1], under[2]);
  const over = t.match(/(?:over|above|more than|min(?:imum)?|at least|starting at)\s*\$?\s*([\d.,]+)\s*(k|m|million|thousand)?/);
  if (over) state.priceMin = toNumber(over[1], over[2]);
  if (state.priceMax == null && state.priceMin == null) {
    const bare = t.match(/\$?\s*([\d.,]+)\s*(k|m|million|thousand)\b/);
    if (bare) state.priceMax = toNumber(bare[1], bare[2]);
    else {
      const dollar = t.match(/\$\s*([\d.,]+)/);
      if (dollar) state.priceMax = toNumber(dollar[1], null);
    }
  }
  return state;
}

function parseBedsBaths(text) {
  const t = text.toLowerCase();
  const out = {};
  const beds = t.match(/(\d+)\s*(?:\+)?\s*(?:bed|beds|bedroom|br)\b/);
  if (beds) out.bedsMin = parseInt(beds[1], 10);
  const baths = t.match(/(\d+(?:\.\d)?)\s*(?:\+)?\s*(?:bath|baths|bathroom|ba)\b/);
  if (baths) out.bathsMin = parseFloat(baths[1]);
  return out;
}

function parseFeatures(text) {
  const t = text.toLowerCase();
  const feats = [];
  const catalog = ["pool", "acreage", "ranch", "view", "waterfront", "lake", "new build", "new construction", "guest house", "casita", "garage"];
  for (const f of catalog) if (t.includes(f)) feats.push(f);
  return feats;
}

function parseType(text) {
  const t = text.toLowerCase();
  if (/\bcondo\b/.test(t)) return "Condo";
  if (/\btownhome|townhouse\b/.test(t)) return "Townhome";
  if (/\bland|lot|acreage\b/.test(t)) return "Land";
  if (/\bmulti[-\s]?family|duplex|fourplex\b/.test(t)) return "MultiFamily";
  if (/\bhome|house|single family|residential\b/.test(t)) return "Residential";
  return null;
}

function buildSearchState(messages) {
  const state = {
    city: null, bedsMin: null, bathsMin: null, priceMin: null, priceMax: null,
    type: null, features: [], keyword: null, resetRequested: false
  };
  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = normalizeText(m.content);
    const low = text.toLowerCase();
    if (RESET_TRIGGERS.some(rt => low.includes(rt))) {
      state.city = null; state.bedsMin = null; state.bathsMin = null;
      state.priceMin = null; state.priceMax = null; state.type = null;
      state.features = []; state.keyword = null; state.resetRequested = true;
      continue;
    }
    const city = extractCityFromText(text);
    if (city) state.city = city;
    const bb = parseBedsBaths(text);
    if (bb.bedsMin != null) state.bedsMin = bb.bedsMin;
    if (bb.bathsMin != null) state.bathsMin = bb.bathsMin;
    const p = parsePriceTokens(text);
    if (p.priceMin != null) state.priceMin = p.priceMin;
    if (p.priceMax != null) state.priceMax = p.priceMax;
    const tp = parseType(text);
    if (tp) state.type = tp;
    const fs = parseFeatures(text);
    for (const f of fs) if (!state.features.includes(f)) state.features.push(f);
  }
  return state;
}

function buildLayeredUrl(state) {
  if (!state.city) return null;
  const entry = DALTON_CITY_LOGIC[state.city];
  if (!entry) return null;
  let slug, params = {}, proxyMessage = null;
  let routeType = entry.type;
  if (entry.type === "direct") {
    slug = entry.slug;
  } else if (entry.type === "proxy") {
    const preset = PROXY_PRESETS[entry.route];
    if (!preset) return null;
    slug = preset.slug;
    params = { ...preset.params };
    proxyMessage = entry.message;
  } else if (entry.type === "keyword") {
    slug = entry.parent;
    params.keyword = entry.keyword;
  }
  if (state.bedsMin != null) params.bedsMin = state.bedsMin;
  if (state.bathsMin != null) params.bathsMin = state.bathsMin;
  if (state.priceMin != null) params.priceMin = state.priceMin;
  if (state.priceMax != null) params.priceMax = state.priceMax;
  if (state.keyword) params.keyword = state.keyword;
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${DEVORA_BASE}/properties/city-${slug}/${query ? "?" + query : ""}`;
  return { url, routeType, proxyMessage };
}

function shouldTriggerSearch(state, combinedText) {
  if (!state.city) return false;
  const hasSignal = state.bedsMin != null || state.bathsMin != null ||
    state.priceMin != null || state.priceMax != null ||
    state.features.length > 0 || state.type != null;
  if (hasSignal) return true;
  const t = combinedText.toLowerCase();
  if (/\b(show me|what do you have|just send|send listings|options)\b/.test(t)) return true;
  return false;
}

// ---------- Smart Reply Generator ----------
function titleCase(s) {
  return String(s).replace(/\b\w/g, c => c.toUpperCase());
}

function formatPrice(n) {
  if (n == null) return "";
  if (n >= 1000000) {
    const v = n / 1000000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

function buildPrevStateFromHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const prevMessages = [];
  for (const m of history) {
    if (m?.role && m?.content) prevMessages.push({ role: m.role, content: normalizeText(m.content) });
  }
  if (prevMessages.length === 0) return null;
  return buildSearchState(prevMessages);
}

function generateSmartReply(prevState, newState, proxyMessage) {
  // No prior state → first-search welcome (or proxy override)
  if (!prevState || (!prevState.city && !prevState.bedsMin && !prevState.priceMax && !prevState.priceMin && !prevState.bathsMin)) {
    return proxyMessage || "Got it. Pulling options for you now.";
  }

  const changes = [];
  const carried = [];
  let cityChanged = false;

  // City change
  if (newState.city && prevState.city && newState.city !== prevState.city) {
    cityChanged = true;
    changes.push(`Swapped to ${titleCase(newState.city)}`);
    if (prevState.bedsMin && newState.bedsMin === prevState.bedsMin) carried.push("beds");
    if (prevState.priceMax && newState.priceMax === prevState.priceMax) carried.push("price");
    if (prevState.bathsMin && newState.bathsMin === prevState.bathsMin) carried.push("baths");
  }

  // Beds
  if (newState.bedsMin && prevState.bedsMin && newState.bedsMin !== prevState.bedsMin) {
    const dir = newState.bedsMin > prevState.bedsMin ? "Bumped" : "Tightened";
    changes.push(`${dir} it to ${newState.bedsMin} beds`);
  } else if (newState.bedsMin && !prevState.bedsMin) {
    changes.push(`Added ${newState.bedsMin}+ beds`);
  }

  // Baths
  if (newState.bathsMin && prevState.bathsMin && newState.bathsMin !== prevState.bathsMin) {
    changes.push(`Baths now ${newState.bathsMin}+`);
  } else if (newState.bathsMin && !prevState.bathsMin) {
    changes.push(`Added ${newState.bathsMin}+ baths`);
  }

  // Price max
  if (newState.priceMax && prevState.priceMax && newState.priceMax !== prevState.priceMax) {
    const dir = newState.priceMax < prevState.priceMax ? "Dropped budget to" : "Raised budget to";
    changes.push(`${dir} ${formatPrice(newState.priceMax)}`);
  } else if (newState.priceMax && !prevState.priceMax) {
    changes.push(`Capped at ${formatPrice(newState.priceMax)}`);
  }

  // Price min
  if (newState.priceMin && prevState.priceMin !== newState.priceMin) {
    changes.push(`Floor set at ${formatPrice(newState.priceMin)}`);
  }

  // Type
  if (newState.type && prevState.type !== newState.type) {
    changes.push(`Type set to ${newState.type}`);
  }

  // If proxy fired on a city change, let the proxy message lead
  if (cityChanged && proxyMessage) {
    let reply = proxyMessage;
    if (carried.length > 0) reply += ` Kept your ${carried.join(" and ")}.`;
    return reply;
  }

  if (changes.length === 0) {
    return proxyMessage || "Refreshing your results.";
  }

  let reply = changes.join(" — ") + ".";
  if (carried.length > 0) {
    reply += ` Kept your ${carried.join(" and ")}.`;
  }
  return reply;
}

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, history } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });

  const messages = [];
  if (Array.isArray(history)) {
    for (const m of history) {
      if (m?.role && m?.content) messages.push({ role: m.role, content: normalizeText(m.content) });
    }
  }
  messages.push({ role: "user", content: normalizeText(message) });

  try {
    const state = buildSearchState(messages);
    const prevState = buildPrevStateFromHistory(history);
    const combinedText = messages.filter(m => m.role === "user").map(m => m.content).join(" ");

    if (state.resetRequested && !state.city && !state.bedsMin && !state.priceMin && !state.priceMax) {
      return res.status(200).json({ reply: "Cleared. What are we looking for now?", reset: true });
    }

    if (shouldTriggerSearch(state, combinedText)) {
      const built = buildLayeredUrl(state);
      if (built) {
        const reply = generateSmartReply(prevState, state, built.proxyMessage);
        return res.status(200).json({
          reply,
          searchUrl: built.url,
          routeType: built.routeType,
          matchedCity: state.city,
          filters: {
            city: state.city,
            bedsMin: state.bedsMin,
            bathsMin: state.bathsMin,
            priceMin: state.priceMin,
            priceMax: state.priceMax,
            type: state.type,
            features: state.features
          }
        });
      }
      return res.status(200).json({
        reply: "That market isn't mapping cleanly in our live feed. Want Austin, San Antonio, or Highland Lakes inventory instead?",
        routeType: "fallback"
      });
    }

    const reply = await callOpenAI(messages, DALTON_SYSTEM_PROMPT);
    return res.status(200).json({ reply, filters: state });
  } catch (err) {
    console.error("DALTON ERROR:", err);
    return res.status(500).json({ reply: "Something went wrong. Please try again.", error: err.message });
  }
}
