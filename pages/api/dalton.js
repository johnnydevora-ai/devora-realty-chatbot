// pages/api/dalton.js
// Devora Realty - Dalton V2 (Central + South Texas Routing Engine)
//
// Lease upgrade (feature/dalton-lease-routing):
// - classifyIntent now detects lease/commercial tokens
// - parseFilters extracts transactionType, propertyClass, rentMax, SF range,
//   pricePerSfMax, useType, leaseType, subleaseOnly
// - buildSearchUrl dispatches to /properties/, /lease/, /commercial/,
//   or /commercial-lease/ as appropriate
// - handleSearchTurn asks "buy or lease?" when ambiguous
//
// Hardening notes (harden/dalton-api):
// - module.exports + module.exports.default shape for Next.js 13.5
// - Handler is wrapped in lib/http/apiRoute.js (CORS, method allowlist, JSON parsing, 500 shaping)

'use strict';

const { apiRoute } = require('../../lib/http/apiRoute');

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
LEASE VS SALE: detect transaction type early. Words like "lease", "for lease", "rent", "rental", "sublease", "NNN" mean lease intent. Words like "buy", "purchase", "for sale" mean sale intent. If both or neither are present on a commercial query, ask exactly once: "Are you looking to buy or lease?" Never ask twice.
RESIDENTIAL LEASE: track beds, baths, and monthly rent budget. Bare dollar amounts at or under 15,000 are treated as monthly rent when lease intent is set.
COMMERCIAL: capture use type (office, retail, warehouse, flex, industrial, medical office), SF range, and price per SF. For lease, also capture NNN / modified gross / FSG and sublease.
SEARCH BEHAVIOR: when ready, reply with a 1-sentence message only. The backend handles the URL.
INTENT OVERRIDE: "show me options" / "what do you have" / "just send listings" -> run the search.
AFTER RESULTS (sale): follow up with "Want me to save this search and alert you when something better hits?"
AFTER RESULTS (commercial lease): follow up with "Want me to set a lease alert for new listings that match these specs - SF, use type, and PPSF?"
FINAL RULE: if about to ask a 3rd question, don't. Run the search.
`;

// ============================================================================
// 1. NEIGHBORHOOD / SUBURB DICTIONARIES
// ============================================================================
const AUSTIN = {
  east_austin: ['78702', '78721', '78722', '78723', '78741'],
  downtown: ['78701', '78703'],
  south_congress: ['78704'],
  south_lamar: ['78704', '78745'],
  east_riverside: ['78741', '78744'],
  far_south: ['78744', '78745', '78748'],
  southwest: ['78735', '78749'],
  westlake: ['78746'],
  tarrytown: ['78703'],
  hyde_park: ['78751', '78756'],
  mueller: ['78723'],
  allandale: ['78756', '78757'],
  northwest_hills: ['78731', '78759'],
  north_austin: ['78727', '78729', '78758', '78759'],
  northeast: ['78752', '78753', '78754'],
  southeast: ['78744', '78747'],
  lake_travis: ['78732', '78733', '78734', '78738'],
};
const SAN_ANTONIO = {
  alamo_heights: ['78209'],
  terrell_hills: ['78209'],
  olmos_park: ['78212'],
  monte_vista: ['78212'],
  king_william: ['78204'],
  pearl: ['78215'],
  downtown_sa: ['78205', '78215'],
  stone_oak: ['78258', '78259'],
  the_dominion: ['78257'],
  shavano_park: ['78231', '78249'],
  alamo_ranch: ['78253'],
  northwest_sa: ['78227', '78238', '78240', '78250'],
  northeast_sa: ['78217', '78218', '78233', '78247'],
  west_sa: ['78207', '78227', '78228'],
  south_sa: ['78211', '78214', '78221', '78223', '78224'],
};
const AUSTIN_SUBURBS = {
  round_rock: { city: 'Round Rock', zips: ['78664', '78665', '78681'] },
  pflugerville: { city: 'Pflugerville', zips: ['78660', '78691'] },
  cedar_park: { city: 'Cedar Park', zips: ['78613'] },
  leander: { city: 'Leander', zips: ['78641', '78645'] },
  georgetown: { city: 'Georgetown', zips: ['78626', '78628', '78633'] },
  hutto: { city: 'Hutto', zips: ['78634'] },
  kyle: { city: 'Kyle', zips: ['78640'] },
  buda: { city: 'Buda', zips: ['78610'] },
  manor: { city: 'Manor', zips: ['78653'] },
  bee_cave: { city: 'Bee Cave', zips: ['78738'] },
  lakeway: { city: 'Lakeway', zips: ['78734', '78738'] },
  dripping_springs: { city: 'Dripping Springs', zips: ['78620'] },
};
const SA_SUBURBS = {
  boerne: { city: 'Boerne', zips: ['78006', '78015'] },
  new_braunfels: { city: 'New Braunfels', zips: ['78130', '78132'] },
  schertz: { city: 'Schertz', zips: ['78154'] },
  cibolo: { city: 'Cibolo', zips: ['78108'] },
  converse: { city: 'Converse', zips: ['78109'] },
  universal_city: { city: 'Universal City', zips: ['78148'] },
  helotes: { city: 'Helotes', zips: ['78023'] },
  live_oak: { city: 'Live Oak', zips: ['78233'] },
  selma: { city: 'Selma', zips: ['78154'] },
  bulverde: { city: 'Bulverde', zips: ['78163'] },
};
const CITY_DICTS = { 'Austin': AUSTIN, 'San Antonio': SAN_ANTONIO };
const SUBURB_DICTS = { ...AUSTIN_SUBURBS, ...SA_SUBURBS };
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
function zipsFor(key) {
  if (AUSTIN[key]) return AUSTIN[key];
  if (SAN_ANTONIO[key]) return SAN_ANTONIO[key];
  if (SUBURB_DICTS[key]) return SUBURB_DICTS[key].zips;
  return [];
}

// ============================================================================
// 2. ALIAS TABLE
// ============================================================================
const ALIASES = {
  'east austin': 'east_austin', 'east side': 'east_austin', 'eastside': 'east_austin', 'east atx': 'east_austin',
  'downtown': 'downtown', 'downtown austin': 'downtown', 'dt austin': 'downtown',
  'south congress': 'south_congress', 'soco': 'south_congress',
  'south lamar': 'south_lamar', 'sola': 'south_lamar',
  'east riverside': 'east_riverside', 'riverside': 'east_riverside',
  'far south': 'far_south', 'far south austin': 'far_south',
  'southwest austin': 'southwest', 'sw austin': 'southwest',
  'westlake': 'westlake', 'west lake hills': 'westlake', 'rollingwood': 'westlake',
  'tarrytown': 'tarrytown',
  'hyde park': 'hyde_park',
  'mueller': 'mueller',
  'allandale': 'allandale',
  'northwest hills': 'northwest_hills', 'nw hills': 'northwest_hills',
  'north austin': 'north_austin', 'north atx': 'north_austin',
  'northeast austin': 'northeast', 'ne austin': 'northeast',
  'southeast austin': 'southeast', 'se austin': 'southeast',
  'lake travis': 'lake_travis',
  'alamo heights': 'alamo_heights', '09er': 'alamo_heights',
  'terrell hills': 'terrell_hills',
  'olmos park': 'olmos_park',
  'monte vista': 'monte_vista',
  'king william': 'king_william',
  'pearl': 'pearl', 'the pearl': 'pearl',
  'downtown san antonio': 'downtown_sa', 'dt sa': 'downtown_sa',
  'stone oak': 'stone_oak',
  'the dominion': 'the_dominion', 'dominion': 'the_dominion',
  'shavano park': 'shavano_park', 'shavano': 'shavano_park',
  'alamo ranch': 'alamo_ranch',
  'northwest san antonio': 'northwest_sa', 'nw san antonio': 'northwest_sa',
  'northeast san antonio': 'northeast_sa', 'ne san antonio': 'northeast_sa',
  'west san antonio': 'west_sa',
  'south san antonio': 'south_sa',
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
  'boerne': 'boerne',
  'new braunfels': 'new_braunfels', 'nb': 'new_braunfels',
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

function resolveLocation(text) {
  const t = normalize(text);
  if (!t) return { type: 'unknown' };
  const zipMatches = t.match(/\b7[0-9]{4}\b/g);
  if (zipMatches && zipMatches.length) {
    return { type: 'zipOnly', zips: Array.from(new Set(zipMatches)) };
  }
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
// 4. FILTER PARSER (lease-aware)
// ============================================================================
const TX_SALE = 'sale';
const TX_LEASE = 'lease';

const LEASE_RES_RE = /\b(for\s+lease|for\s+rent|lease|leasing|rent|rental|renting|to\s+rent)\b/;
const COMMERCIAL_USE_RE = /\b(office|retail|warehouse|industrial|flex|flex\s*space|medical\s*office|cold\s*storage|distribution|showroom|shell\s*space|co-?work(?:ing)?|executive\s*suite)\b/;
const COMMERCIAL_LEASE_RE = /\b(sublease|sub-?lease|nnn|triple\s*net|modified\s*gross|full\s*service\s*gross|fsg|cam|psf|per\s*sf|\/sf)\b/;
const SALE_RE = /\b(buy|buying|purchase|for\s*sale|ownership|listed\s+for\s+sale)\b/;

const SF_RANGE_RE  = /(\d{3,6})\s*(?:-|to)\s*(\d{3,6})\s*(?:sq\s*ft|sqft|sf)\b/;
const SF_SINGLE_RE = /(\d{3,6})\s*(?:sq\s*ft|sqft|sf)\b/;
const PPSF_RE      = /\$?\s*(\d+(?:\.\d+)?)\s*(?:\/|\s*per\s*)\s*(?:sq\s*ft|sqft|sf)\b/;
const MONTHLY_RE   = /\$?\s*(\d{3,5})\s*(?:\/mo|per\s*month|a\s*month|\bmonth\b)/;

const KEYWORD_FEATURES = new Set([
  'pool', 'pools', 'view', 'views', 'hill country views',
  'wine cellar', 'wine room', 'guest house', 'casita',
  'acreage', 'acre', 'acres', 'waterfront', 'lakefront',
  'new construction', 'workshop', 'shop', 'adu',
]);

function toDollars(num, unit) {
  const n = parseFloat(num);
  if (!unit) return n >= 1000 ? Math.round(n) : Math.round(n * 1000);
  const u = unit.toLowerCase();
  if (u === 'k' || u === 'thousand') return Math.round(n * 1000);
  if (u === 'm' || u === 'million') return Math.round(n * 1000000);
  return Math.round(n);
}

function detectTransactionType(t) {
  const leaseHit = LEASE_RES_RE.test(t) || COMMERCIAL_LEASE_RE.test(t);
  const saleHit  = SALE_RE.test(t);
  if (leaseHit && !saleHit) return TX_LEASE;
  if (saleHit && !leaseHit) return TX_SALE;
  if (leaseHit && saleHit)  return 'ambiguous';
  return null;
}

function detectPropertyClass(t) {
  if (COMMERCIAL_USE_RE.test(t) || COMMERCIAL_LEASE_RE.test(t)) return 'commercial';
  return 'residential';
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

  const sqft = t.match(/(\d{3,5})\s*(?:sq\s*ft|sqft|square feet)(?!\s*(?:to|-))/);
  if (sqft) f.sqftMin = parseInt(sqft[1], 10);

  for (const kw of KEYWORD_FEATURES) {
    if (t.includes(kw)) f.features.push(kw);
  }
  f.features = Array.from(new Set(f.features));

  // Transaction + class
  f.transactionType = detectTransactionType(t);
  f.propertyClass   = detectPropertyClass(t);

  // Monthly rent (explicit)
  const monthly = t.match(MONTHLY_RE);
  if (monthly) f.rentMax = parseInt(monthly[1], 10);

  // Residential lease: reinterpret small priceMax as monthly rent
  if (f.transactionType === TX_LEASE && f.propertyClass === 'residential'
      && f.priceMax && f.priceMax <= 15000 && !f.rentMax) {
    f.rentMax = f.priceMax;
    delete f.priceMax;
  }

  // Commercial SF
  const sfRange = t.match(SF_RANGE_RE);
  if (sfRange) {
    f.sfMin = parseInt(sfRange[1], 10);
    f.sfMax = parseInt(sfRange[2], 10);
  } else {
    const sfOne = t.match(SF_SINGLE_RE);
    if (sfOne) f.sfMin = parseInt(sfOne[1], 10);
  }

  // Price per SF
  const ppsf = t.match(PPSF_RE);
  if (ppsf) f.pricePerSfMax = parseFloat(ppsf[1]);

  // Commercial use type
  if (f.propertyClass === 'commercial') {
    const m = t.match(COMMERCIAL_USE_RE);
    if (m) f.useType = m[1].replace(/\s+/g, '_').toLowerCase();
  }

  // Lease sub-type
  if (/\bnnn\b|\btriple\s*net\b/.test(t)) f.leaseType = 'nnn';
  else if (/\bmodified\s*gross\b/.test(t)) f.leaseType = 'modified_gross';
  else if (/\bfull\s*service\s*gross\b|\bfsg\b/.test(t)) f.leaseType = 'fsg';
  if (/\bsublease\b|\bsub-?lease\b/.test(t)) f.subleaseOnly = true;

  return f;
}

// ============================================================================
// 5. URL BUILDER (lease-aware dispatcher)
// ============================================================================
const SITE = 'https://devorarealty.com';

function buildSegments(loc) {
  const segments = [];
  if (loc.type === 'zip' || loc.type === 'city') segments.push(`city-${loc.city}, TX`);
  if (loc.type === 'zip' || loc.type === 'zipOnly') for (const z of loc.zips) segments.push(`zip-${z}`);
  if (!segments.length) segments.push('state-TX');
  return segments.join('|');
}

function buildSearchUrl(loc, f) {
  const seg = buildSegments(loc);
  const isLease = f.transactionType === TX_LEASE;
  const isComm  = f.propertyClass === 'commercial';

  let base;
  if (isComm && isLease)  base = `/commercial-lease/${seg}/`;
  else if (isComm)        base = `/commercial/${seg}/`;
  else if (isLease)       base = `/lease/${seg}/`;
  else                    base = `/properties/${seg}/`;

  const qs = new URLSearchParams();

  if (f.bedsMin)  qs.set('bedsMin',  String(f.bedsMin));
  if (f.bathsMin) qs.set('bathsMin', String(f.bathsMin));

  if (isLease && !isComm) {
    // Residential lease
    if (f.rentMax) qs.set('rentMax', String(f.rentMax));
    if (f.rentMin) qs.set('rentMin', String(f.rentMin));
    if (f.propertyType) qs.set('propertyType', f.propertyType);
  } else if (isComm) {
    // Commercial
    if (f.sfMin)         qs.set('sfMin',         String(f.sfMin));
    if (f.sfMax)         qs.set('sfMax',         String(f.sfMax));
    if (f.pricePerSfMax) qs.set('pricePerSfMax', String(f.pricePerSfMax));
    if (f.useType)       qs.set('useType',       f.useType);
    if (isLease) {
      if (f.leaseType)    qs.set('leaseType', f.leaseType);
      if (f.subleaseOnly) qs.set('sublease', '1');
    } else {
      if (f.priceMin) qs.set('priceMin', String(f.priceMin));
      if (f.priceMax) qs.set('priceMax', String(f.priceMax));
    }
  } else {
    // Residential sale (original behavior)
    if (f.priceMin) qs.set('priceMin', String(f.priceMin));
    if (f.priceMax) qs.set('priceMax', String(f.priceMax));
    if (f.sqftMin)  qs.set('sqftMin',  String(f.sqftMin));
    if (f.propertyType) qs.set('propertyType', f.propertyType);
  }

  // Keyword features (residential only)
  if (!isComm) {
    const kw = (f.features || [])
      .map(x => String(x).toLowerCase().trim())
      .filter(x => KEYWORD_FEATURES.has(x));
    if (kw.length) qs.set('keyword', kw.join(' '));
  }

  const q = qs.toString();
  return `${SITE}${base}${q ? '?' + q : ''}`;
}

// Backward-compatible alias (existing tests/imports expect buildPropertiesUrl)
function buildPropertiesUrl(loc, f) { return buildSearchUrl(loc, f); }

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
  if (f.rentMax)  parts.push(`under $${f.rentMax}/mo`);
  if (f.priceMax) parts.push(`under $${(f.priceMax / 1000).toFixed(0)}k`);
  if (f.priceMin) parts.push(`over $${(f.priceMin / 1000).toFixed(0)}k`);
  if (f.sfMin && f.sfMax)  parts.push(`${f.sfMin}-${f.sfMax} SF`);
  else if (f.sfMin)         parts.push(`${f.sfMin}+ SF`);
  if (f.pricePerSfMax)      parts.push(`under $${f.pricePerSfMax}/SF`);
  if (f.useType)            parts.push(f.useType.replace(/_/g, ' '));
  if (f.leaseType)          parts.push(f.leaseType.toUpperCase());
  if (f.subleaseOnly)       parts.push('sublease');
  if (f.features && f.features.length) parts.push(`with ${f.features.join(', ')}`);

  const where =
    loc.type === 'zip'     ? `${pretty(loc.key)} (${loc.city})` :
    loc.type === 'city'    ? loc.city :
    loc.type === 'zipOnly' ? `ZIP ${loc.zips.join(', ')}` :
                             'Texas';

  const verb =
    f.propertyClass === 'commercial'
      ? (f.transactionType === TX_LEASE ? 'Pulling commercial space for lease' : 'Pulling commercial listings')
      : (f.transactionType === TX_LEASE ? 'Pulling rentals' : 'Pulling matching homes');

  return `${verb}${parts.length ? ' ' + parts.join(', ') : ''} in ${where}.`;
}

// ============================================================================
// 7. TURN HANDLER
// ============================================================================
function handleSearchTurn(userMessage) {
  const loc = resolveLocation(userMessage);
  const filters = parseFilters(userMessage);

  // Ambiguous transaction type: user used both buy + lease language
  if (filters.transactionType === 'ambiguous') {
    return {
      kind: 'askTransactionType',
      text: 'Quick check - are you looking to buy or lease?',
    };
  }

  // Commercial with no transaction signal -> ask once
  if (!filters.transactionType && filters.propertyClass === 'commercial') {
    return {
      kind: 'askTransactionType',
      text: 'Got it - are you looking to buy or lease this space?',
    };
  }

  // Default residential with no signal: assume sale (preserves existing behavior)
  if (!filters.transactionType) filters.transactionType = TX_SALE;

  // Sufficiency check by class/tx
  const hasResSaleFilter  = filters.priceMax || filters.priceMin || filters.bedsMin;
  const hasResLeaseFilter = filters.rentMax  || filters.rentMin  || filters.bedsMin;
  const hasCommFilter     = filters.sfMin    || filters.sfMax    || filters.useType || filters.pricePerSfMax;

  const enough =
    filters.propertyClass === 'commercial' ? hasCommFilter
    : filters.transactionType === TX_LEASE ? hasResLeaseFilter
    : hasResSaleFilter;

  if (!enough) {
    const ask =
      filters.propertyClass === 'commercial'
        ? 'What size space are you targeting - SF range and use type (office, retail, warehouse, flex)?'
        : filters.transactionType === TX_LEASE
          ? "What's your monthly rent ceiling or minimum bedrooms? I'll narrow from there."
          : "Got it - what's your target budget or minimum bedroom count? That helps me trim to homes that actually fit.";
    return { kind: 'askFilter', text: ask };
  }

  if (loc.type === 'ambiguous') {
    const names = loc.candidates.map(c => `${pretty(c.key)} (${c.city})`).join(' or ');
    return { kind: 'askLocation', text: `Quick check - did you mean ${names}?` };
  }

  if (loc.type === 'unknown') {
    const austinDefault = { type: 'city', city: 'Austin' };
    return {
      kind: 'results',
      url: buildSearchUrl(austinDefault, filters),
      text: summarize(austinDefault, filters) + ' (Austin metro by default - say a neighborhood to narrow.)',
    };
  }

  return {
    kind: 'results',
    url: buildSearchUrl(loc, filters),
    text: summarize(loc, filters),
  };
}

// ============================================================================
// 8. INTENT ROUTER
// ============================================================================
function classifyIntent(userMessage) {
  const t = String(userMessage || '').toLowerCase();

  // Search keywords (residential + commercial + lease + sale)
  const SEARCH_RE = /\b(homes?|houses?|propert(?:y|ies)|listings?|condos?|townhomes?|apartments?|lofts?|ranches?|farms?|land|lots?|acres?|bed(?:room)?s?|bath(?:room)?s?|sqft|sq\s*ft|sf|psf|zip|neighborhood|area|market|buy|browse|show\s+me|find|search|pull|pulling|looking|lease|leasing|rent|rental|renting|sublease|nnn|office|retail|warehouse|industrial|flex|flex\s*space|medical\s*office)\b/;

  const ZIP_RE = /\b7[0-9]{4}\b/;
  const BUDGET_RE = /(\$|\bunder\b|\bmax\b|\bup\s+to\b|\bless\s+than\b|\bover\b|\bmin\b)\s*[0-9]|\b[0-9]+(?:\.[0-9]+)?\s*[km]\b/;
  const LOC_RE = /\b(austin|atx|san\s*antonio|sa\b|boerne|pflugerville|cedar\s*park|leander|round\s*rock|kyle|buda|manor|new\s*braunfels|schertz|cibolo|georgetown|hutto|lakeway|westlake|mueller|tarrytown|downtown|soco|eanes|isd)\b/;

  if (SEARCH_RE.test(t)) return 'search';
  if (ZIP_RE.test(t))    return 'search';
  if (BUDGET_RE.test(t)) return 'search';
  if (LOC_RE.test(t))    return 'search';

  if (/\b(agent|broker|contact|email|call|schedule|tour|showing|appointment|meet)\b/.test(t)) {
    return 'lead';
  }

  return 'smalltalk';
}

function handleLeadTurn() {
  return {
    kind: 'leadForm',
    text: "Happy to connect you with an agent - what's the best email or phone for the intro?",
  };
}
function handleSmalltalkTurn() {
  return {
    kind: 'message',
    text: "I'm Dalton - Devora Realty's search assistant. Tell me an area and a budget (or rent / SF target) and I'll pull live listings.",
  };
}

// ============================================================================
// 9. NEXT.JS API HANDLER (hardened via lib/http/apiRoute)
// ============================================================================
const handler = apiRoute(async (req, res) => {
  const body = req.jsonBody || {};
  const message = typeof body.message === 'string' ? body.message : '';
  if (!message.trim()) {
    res.status(400);
    return res.json({ error: 'Empty message' });
  }

  const intent = classifyIntent(message);
  const result =
    intent === 'search' ? handleSearchTurn(message) :
    intent === 'lead'   ? handleLeadTurn() :
                          handleSmalltalkTurn();

  // Widget-contract aliases
  if (result && typeof result === 'object') {
    if (result.text && !result.reply) result.reply = result.text;
    if (result.url  && !result.searchUrl) result.searchUrl = result.url;
  }

  res.status(200);
  return res.json(result);
}, { methods: ['POST'] });

// Next.js 13.5 default export shape
module.exports = handler;
module.exports.default = handler;

// Named exports for tests and internal reuse.
module.exports.resolveLocation       = resolveLocation;
module.exports.parseFilters          = parseFilters;
module.exports.buildPropertiesUrl    = buildPropertiesUrl;
module.exports.buildSearchUrl        = buildSearchUrl;
module.exports.handleSearchTurn      = handleSearchTurn;
module.exports.classifyIntent        = classifyIntent;
module.exports.detectTransactionType = detectTransactionType;
module.exports.detectPropertyClass   = detectPropertyClass;
module.exports.DALTON_SYSTEM_PROMPT  = DALTON_SYSTEM_PROMPT;
