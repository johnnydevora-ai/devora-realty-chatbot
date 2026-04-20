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

// api/dalton.js
// Devora Realty — Dalton chatbot backend (Vercel serverless route)
// Single-file build. Replaces the previous /api/dalton handler.
//
// Scope:
//   - Austin + San Antonio neighborhoods (ZIP-based)
//   - Austin-metro + San Antonio-metro suburbs (each routes to its own city segment)
//   - AgentFire-compatible URL builder (path segments for geography, query string for filters)
//   - Alias normalization
//   - No luxury/price heuristics
//   - keyword= reserved for non-geographic features only
//   - Clarifying-question fallback for ambiguous / unknown locations

'use strict';

// ============================================================================
// 1. NEIGHBORHOOD / SUBURB DICTIONARIES
// Each top-level entry belongs to exactly one "city segment" that AgentFire
// understands (city-<Name>, TX). Suburbs are their OWN city segment, not Austin.
// ============================================================================

// --- Austin proper ---
const AUSTIN = {
  east_austin:     ['78702', '78721', '78722', '78723', '78741'],
  downtown:        ['78701', '78703'],
  south_congress:  ['78704'],
  south_lamar:     ['78704', '78745'],
  east_riverside:  ['78741', '78744'],
  far_south:       ['78744', '78745', '78748'],
  southwest:       ['78735', '78749'],
  westlake:        ['78746'],
  tarrytown:       ['78703'],
  hyde_park:       ['78751', '78756'],
  mueller:         ['78723'],
  allandale:       ['78756', '78757'],
  northwest_hills: ['78731', '78759'],
  north_austin:    ['78727', '78729', '78758', '78759'],
  northeast:       ['78752', '78753', '78754'],
  southeast:       ['78744', '78747'],
  lake_travis:     ['78732', '78733', '78734', '78738'],
};

// --- San Antonio proper ---
const SAN_ANTONIO = {
  alamo_heights: ['78209'],
  terrell_hills: ['78209'],
  olmos_park:    ['78212'],
  monte_vista:   ['78212'],
  king_william:  ['78204'],
  pearl:         ['78215'],
  downtown_sa:   ['78205', '78215'],
  stone_oak:     ['78258', '78259'],
  the_dominion:  ['78257'],
  shavano_park:  ['78231', '78249'],
  alamo_ranch:   ['78253'],
  northwest_sa:  ['78227', '78238', '78240', '78250'],
  northeast_sa:  ['78217', '78218', '78233', '78247'],
  west_sa:       ['78207', '78227', '78228'],
  south_sa:      ['78211', '78214', '78221', '78223', '78224'],
};

// --- Austin-metro suburbs (each is its own AgentFire city segment) ---
// Format: key -> { city: <AgentFire city name>, zips: [...] }
const AUSTIN_SUBURBS = {
  round_rock:       { city: 'Round Rock',       zips: ['78664', '78665', '78681'] },
  pflugerville:     { city: 'Pflugerville',     zips: ['78660', '78691'] },
  cedar_park:       { city: 'Cedar Park',       zips: ['78613'] },
  leander:          { city: 'Leander',          zips: ['78641', '78645'] },
  georgetown:       { city: 'Georgetown',       zips: ['78626', '78628', '78633'] },
  hutto:            { city: 'Hutto',            zips: ['78634'] },
  kyle:             { city: 'Kyle',             zips: ['78640'] },
  buda:             { city: 'Buda',             zips: ['78610'] },
  manor:            { city: 'Manor',            zips: ['78653'] },
  bee_cave:         { city: 'Bee Cave',         zips: ['78738'] },
  lakeway:          { city: 'Lakeway',          zips: ['78734', '78738'] },
  dripping_springs: { city: 'Dripping Springs', zips: ['78620'] },
};

// --- San Antonio-metro suburbs ---
const SA_SUBURBS = {
  boerne:         { city: 'Boerne',         zips: ['78006', '78015'] },
  new_braunfels:  { city: 'New Braunfels',  zips: ['78130', '78132'] },
  schertz:        { city: 'Schertz',        zips: ['78154'] },
  cibolo:         { city: 'Cibolo',         zips: ['78108'] },
  converse:       { city: 'Converse',       zips: ['78109'] },
  universal_city: { city: 'Universal City', zips: ['78148'] },
  helotes:        { city: 'Helotes',        zips: ['78023'] },
  live_oak:       { city: 'Live Oak',       zips: ['78233'] },
  selma:          { city: 'Selma',          zips: ['78154'] },
  bulverde:       { city: 'Bulverde',       zips: ['78163'] },
};

const CITY_DICTS = { 'Austin': AUSTIN, 'San Antonio': SAN_ANTONIO };
const SUBURB_DICTS = { ...AUSTIN_SUBURBS, ...SA_SUBURBS };

// Reverse lookup: canonical key -> AgentFire city name
const CITY_BY_KEY = (() => {
  const out = {};
  for (const [city, dict] of Object.entries(CITY_DICTS)) {
    for (const key of Object.keys(dict)) out[key] = city;
  }
  for (const [key, entry] of Object.entries(SUBURB_DICTS)) {
    out[key] = entry.city;
  }
  return out;
})();

// ZIPs for any key (neighborhood or suburb)
function zipsFor(key) {
  if (AUSTIN[key])       return AUSTIN[key];
  if (SAN_ANTONIO[key])  return SAN_ANTONIO[key];
  if (SUBURB_DICTS[key]) return SUBURB_DICTS[key].zips;
  return [];
}

// ============================================================================
// 2. ALIAS TABLE
// ============================================================================

const ALIASES = {
  // --- Austin neighborhoods ---
  'east austin': 'east_austin',
  'east side': 'east_austin',
  'eastside': 'east_austin',
  'east atx': 'east_austin',
  'downtown': 'downtown',
  'downtown austin': 'downtown',
  'dt austin': 'downtown',
  'south congress': 'south_congress',
  'soco': 'south_congress',
  'south lamar': 'south_lamar',
  'sola': 'south_lamar',
  'east riverside': 'east_riverside',
  'riverside': 'east_riverside',
  'far south': 'far_south',
  'far south austin': 'far_south',
  'southwest austin': 'southwest',
  'sw austin': 'southwest',
  'westlake': 'westlake',
  'west lake hills': 'westlake',
  'rollingwood': 'westlake',
  'tarrytown': 'tarrytown',
  'hyde park': 'hyde_park',
  'mueller': 'mueller',
  'allandale': 'allandale',
  'northwest hills': 'northwest_hills',
  'nw hills': 'northwest_hills',
  'north austin': 'north_austin',
  'north atx': 'north_austin',
  'northeast austin': 'northeast',
  'ne austin': 'northeast',
  'southeast austin': 'southeast',
  'se austin': 'southeast',
  'lake travis': 'lake_travis',

  // --- San Antonio neighborhoods ---
  'alamo heights': 'alamo_heights',
  '09er': 'alamo_heights',
  'terrell hills': 'terrell_hills',
  'olmos park': 'olmos_park',
  'monte vista': 'monte_vista',
  'king william': 'king_william',
  'pearl': 'pearl',
  'the pearl': 'pearl',
  'downtown san antonio': 'downtown_sa',
  'dt sa': 'downtown_sa',
  'stone oak': 'stone_oak',
  'the dominion': 'the_dominion',
  'dominion': 'the_dominion',
  'shavano park': 'shavano_park',
  'shavano': 'shavano_park',
  'alamo ranch': 'alamo_ranch',
  'northwest san antonio': 'northwest_sa',
  'nw san antonio': 'northwest_sa',
  'northeast san antonio': 'northeast_sa',
  'ne san antonio': 'northeast_sa',
  'west san antonio': 'west_sa',
  'south san antonio': 'south_sa',

  // --- Austin-metro suburbs ---
  'round rock': 'round_rock',
  'pflugerville': 'pflugerville',
  'cedar park': 'cedar_park',
  'leander': 'leander',
  'georgetown': 'georgetown',
  'hutto': 'hutto',
  'kyle': 'kyle',
  'buda': 'buda',
  'manor': 'manor',
  'bee cave': 'bee_cave',
  'lakeway': 'lakeway',
  'dripping springs': 'dripping_springs',

  // --- San Antonio-metro suburbs ---
  'boerne': 'boerne',
  'new braunfels': 'new_braunfels',
  'nb': 'new_braunfels',
  'schertz': 'schertz',
  'cibolo': 'cibolo',
  'converse': 'converse',
  'universal city': 'universal_city',
  'helotes': 'helotes',
  'live oak': 'live_oak',
  'selma': 'selma',
  'bulverde': 'bulverde',
};

// ============================================================================
// 3. LOCATION RESOLVER
// ============================================================================

function normalize(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function matchAliases(t) {
  const sorted = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  const hits = [];
  const used = [];
  for (const alias of sorted) {
    const re = new RegExp(`(?:^|\\s)${escapeRe(alias)}(?:\\s|$)`);
    if (re.test(t) && !used.some(u => u.includes(alias) || alias.includes(u))) {
      hits.push(ALIASES[alias]);
      used.push(alias);
    }
  }
  return Array.from(new Set(hits));
}

function hasNeighborhood(t) { return matchAliases(t).length > 0; }

/**
 * Resolve a free-text location phrase.
 * Returns one of:
 *   { type: 'zip',       city, key, zips }
 *   { type: 'city',      city }
 *   { type: 'zipOnly',   zips }
 *   { type: 'ambiguous', candidates: [{city, key}] }
 *   { type: 'unknown'    }
 *
 * Note: for suburbs, `city` is the SUBURB'S name (e.g. 'Round Rock'), not 'Austin'.
 * The URL builder will emit `city-Round Rock, TX|zip-78664|...` accordingly.
 */
function resolveLocation(text) {
  const t = normalize(text);
  if (!t) return { type: 'unknown' };

  // Direct ZIP(s)
  const zipMatches = t.match(/\b7[0-9]{4}\b/g);
  if (zipMatches && zipMatches.length) {
    return { type: 'zipOnly', zips: Array.from(new Set(zipMatches)) };
  }

  // Bare primary city (no neighborhood/suburb alias present)
  if (/\b(austin|atx)\b/.test(t) && !hasNeighborhood(t)) {
    return { type: 'city', city: 'Austin' };
  }
  if (/\b(san antonio|sa)\b/.test(t) && !hasNeighborhood(t)) {
    return { type: 'city', city: 'San Antonio' };
  }

  const keys = matchAliases(t);
  if (keys.length === 0) return { type: 'unknown' };

  if (keys.length === 1) {
    const key = keys[0];
    const city = CITY_BY_KEY[key];
    return { type: 'zip', city, key, zips: zipsFor(key) };
  }

  // Multiple matches — union only if all share one city segment
  const cities = new Set(keys.map(k => CITY_BY_KEY[k]));
  if (cities.size === 1) {
    const city = [...cities][0];
    const zips = Array.from(new Set(keys.flatMap(k => zipsFor(k))));
    return { type: 'zip', city, key: keys.join('+'), zips };
  }
  return {
    type: 'ambiguous',
    candidates: keys.map(k => ({ city: CITY_BY_KEY[k], key: k })),
  };
}

// ============================================================================
// 4. FILTER PARSER
// ============================================================================

const KEYWORD_FEATURES = new Set([
  'pool', 'pools',
  'view', 'views', 'hill country views',
  'wine cellar', 'wine room',
  'guest house', 'casita',
  'acreage', 'acre', 'acres',
  'waterfront', 'lakefront',
  'new construction',
  'workshop', 'shop',
  'adu',
]);

function toDollars(num, unit) {
  const n = parseFloat(num);
  if (!unit) return n >= 1000 ? Math.round(n) : Math.round(n * 1000); // bare "750" => 750k
  const u = unit.toLowerCase();
  if (u === 'k' || u === 'thousand') return Math.round(n * 1_000);
  if (u === 'm' || u === 'million')  return Math.round(n * 1_000_000);
  return Math.round(n);
}

function parseFilters(userMessage) {
  const t = String(userMessage || '').toLowerCase();
  const f = { features: [] };

  const beds = t.match(/(\d)\s*(?:bed|br|bedroom)/);
  if (beds) f.bedsMin = parseInt(beds[1], 10);

  const baths = t.match(/(\d(?:\.5)?)\s*(?:bath|ba)/);
  if (baths) f.bathsMin = parseFloat(baths[1]);

  const maxK = t.match(/(?:under|below|less than|max|up to)\s*\$?(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/);
  if (maxK) f.priceMax = toDollars(maxK[1], maxK[2]);

  const minK = t.match(/(?:over|above|at least|min(?:imum)?)\s*\$?(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/);
  if (minK) f.priceMin = toDollars(minK[1], minK[2]);

  const sqft = t.match(/(\d{3,5})\s*(?:sq\s*ft|sqft|square feet)/);
  if (sqft) f.sqftMin = parseInt(sqft[1], 10);

  for (const kw of KEYWORD_FEATURES) {
    if (t.includes(kw)) f.features.push(kw);
  }
  f.features = Array.from(new Set(f.features));

  return f;
}

// ============================================================================
// 5. URL BUILDER
// ============================================================================

const SITE = 'https://devorarealty.com';

function buildPropertiesUrl(loc, filters) {
  const segments = [];

  if (loc.type === 'zip' || loc.type === 'city') {
    segments.push(`city-${loc.city}, TX`);
  }
  if (loc.type === 'zip' || loc.type === 'zipOnly') {
    for (const z of loc.zips) segments.push(`zip-${z}`);
  }
  if (segments.length === 0) segments.push('state-TX');

  const path = `/properties/${segments.join('|')}/`;

  const qs = new URLSearchParams();
  if (filters.bedsMin)      qs.set('bedsMin',      String(filters.bedsMin));
  if (filters.bathsMin)     qs.set('bathsMin',     String(filters.bathsMin));
  if (filters.priceMin)     qs.set('priceMin',     String(filters.priceMin));
  if (filters.priceMax)     qs.set('priceMax',     String(filters.priceMax));
  if (filters.sqftMin)      qs.set('sqftMin',      String(filters.sqftMin));
  if (filters.propertyType) qs.set('propertyType', filters.propertyType);

  const kw = (filters.features || [])
    .map(f => String(f).toLowerCase().trim())
    .filter(f => KEYWORD_FEATURES.has(f));
  if (kw.length) qs.set('keyword', kw.join(' '));

  const q = qs.toString();
  return `${SITE}${path}${q ? '?' + q : ''}`;
}

// ============================================================================
// 6. RESPONSE FORMATTER
// ============================================================================

function pretty(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function summarize(loc, f) {
  const parts = [];
  if (f.bedsMin)  parts.push(`${f.bedsMin}+ bed`);
  if (f.bathsMin) parts.push(`${f.bathsMin}+ bath`);
  if (f.priceMax) parts.push(`under $${(f.priceMax / 1000).toFixed(0)}k`);
  if (f.priceMin) parts.push(`over $${(f.priceMin / 1000).toFixed(0)}k`);
  if (f.features && f.features.length) parts.push(`with ${f.features.join(', ')}`);

  const where =
    loc.type === 'zip'     ? `${pretty(loc.key)} (${loc.city})` :
    loc.type === 'city'    ? loc.city :
    loc.type === 'zipOnly' ? `ZIP ${loc.zips.join(', ')}` :
                             'Texas';
  return `Pulling ${parts.join(', ') || 'matching homes'} in ${where}.`;
}

// ============================================================================
// 7. TURN HANDLER
// ============================================================================

function handleSearchTurn(userMessage) {
  const loc = resolveLocation(userMessage);
  const filters = parseFilters(userMessage);

  if (!filters.priceMax && !filters.priceMin && !filters.bedsMin) {
    return {
      kind: 'askFilter',
      text: "Got it — what's your target budget or minimum bedroom count? That helps me trim to homes that actually fit.",
    };
  }

  if (loc.type === 'ambiguous') {
    const names = loc.candidates.map(c => `${pretty(c.key)} (${c.city})`).join(' or ');
    return { kind: 'askLocation', text: `Quick check — did you mean ${names}?` };
  }

  if (loc.type === 'unknown') {
    return {
      kind: 'askLocation',
      text: "Which area are you focused on? I cover Austin and San Antonio plus surrounding metros — e.g. East Austin, Mueller, Round Rock, Cedar Park, Alamo Heights, Stone Oak, Boerne, New Braunfels.",
    };
  }

  return {
    kind: 'results',
    url: buildPropertiesUrl(loc, filters),
    text: summarize(loc, filters),
  };
}

// ============================================================================
// 8. INTENT ROUTER
// ============================================================================

function classifyIntent(userMessage) {
  const t = String(userMessage || '').toLowerCase();
  if (/\b(home|house|property|listing|condo|townhome|bed|bath|zip|neighborhood|area)\b/.test(t)) {
    return 'search';
  }
  if (/\b(agent|broker|contact|email|call|schedule|tour|showing)\b/.test(t)) {
    return 'lead';
  }
  return 'smalltalk';
}

function handleLeadTurn() {
  return {
    kind: 'leadForm',
    text: "Happy to connect you with an agent — what's the best email or phone for the intro?",
  };
}

function handleSmalltalkTurn() {
  return {
    kind: 'message',
    text: "I'm Dalton — Devora Realty's search assistant. Tell me an area and a budget and I'll pull live listings.",
  };
}

// ============================================================================
// 9. VERCEL HANDLER
// ============================================================================

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const message = (body && body.message) ? String(body.message) : '';
  if (!message.trim()) { res.status(400).json({ error: 'Empty message' }); return; }

  const intent = classifyIntent(message);
  let result;
  if      (intent === 'search') result = handleSearchTurn(message);
  else if (intent === 'lead')   result = handleLeadTurn();
  else                          result = handleSmalltalkTurn();

  res.status(200).json(result);
};

// Exported for tests
module.exports.resolveLocation    = resolveLocation;
module.exports.parseFilters       = parseFilters;
module.exports.buildPropertiesUrl = buildPropertiesUrl;
module.exports.handleSearchTurn   = handleSearchTurn;
module.exports.classifyIntent     = classifyIntent;
