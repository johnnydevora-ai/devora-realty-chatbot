'use strict';

// Lease + commercial routing tests for DALTON.
// Run with the same harness as __tests__/api/guardrails/*.test.js

const dalton = require('../../pages/api/dalton');
const { handleSearchTurn, parseFilters, buildSearchUrl, resolveLocation, classifyIntent, detectTransactionType, detectPropertyClass } = dalton;

function expectHas(url, needles) {
  for (const n of needles) {
    if (!url.includes(n)) {
      throw new Error('Expected URL to include ' + JSON.stringify(n) + ' but got ' + url);
    }
  }
}

function run(label, fn) {
  try { fn(); console.log('ok  -', label); }
  catch (e) { console.error('FAIL -', label, '\n    ', e.message); process.exitCode = 1; }
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------
run('classifyIntent: "office space for lease Austin 2000 sf" -> search', () => {
  if (classifyIntent('office space for lease Austin 2000 sf') !== 'search')
    throw new Error('expected search');
});
run('classifyIntent: "home for rent in Alamo Heights" -> search', () => {
  if (classifyIntent('home for rent in Alamo Heights') !== 'search')
    throw new Error('expected search');
});
run('classifyIntent: "sublease Stone Oak" -> search', () => {
  if (classifyIntent('sublease Stone Oak') !== 'search')
    throw new Error('expected search');
});

// ---------------------------------------------------------------------------
// Transaction + class detection
// ---------------------------------------------------------------------------
run('detectTransactionType: lease wording', () => {
  if (detectTransactionType('condo for lease downtown') !== 'lease') throw new Error('fail');
  if (detectTransactionType('house for rent in kyle')   !== 'lease') throw new Error('fail');
  if (detectTransactionType('sublease in stone oak')    !== 'lease') throw new Error('fail');
});
run('detectTransactionType: sale wording', () => {
  if (detectTransactionType('3 bed home for sale mueller') !== 'sale') throw new Error('fail');
  if (detectTransactionType('buy a condo downtown')        !== 'sale') throw new Error('fail');
});
run('detectTransactionType: ambiguous (buy or lease)', () => {
  if (detectTransactionType('buy or lease office space') !== 'ambiguous') throw new Error('fail');
});
run('detectPropertyClass: commercial use types', () => {
  if (detectPropertyClass('office for lease austin')     !== 'commercial') throw new Error('office');
  if (detectPropertyClass('retail space south lamar')    !== 'commercial') throw new Error('retail');
  if (detectPropertyClass('warehouse schertz 10000 sf')  !== 'commercial') throw new Error('warehouse');
  if (detectPropertyClass('flex space cedar park')       !== 'commercial') throw new Error('flex');
});
run('detectPropertyClass: residential default', () => {
  if (detectPropertyClass('3 bed home for rent')  !== 'residential') throw new Error('fail');
  if (detectPropertyClass('condo downtown austin') !== 'residential') throw new Error('fail');
});

// ---------------------------------------------------------------------------
// Residential lease URL routing
// ---------------------------------------------------------------------------
run('residential lease: 2 bed condo downtown Austin for lease under 3000', () => {
  const r = handleSearchTurn('2 bed condo downtown Austin for lease under 3000');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/lease/', 'city-Austin, TX', 'bedsMin=2', 'rentMax=3000']);
});
run('residential lease: house for rent in Alamo Heights 3 bed under 4500', () => {
  const r = handleSearchTurn('house for rent in Alamo Heights 3 bed under 4500');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/lease/', 'city-San+Antonio%2C+TX'.replace('%2C',',').replace('+',' '), 'bedsMin=3', 'rentMax=4500']);
});
run('residential lease: rental in Mueller 2 bed 2 bath', () => {
  const r = handleSearchTurn('rental in Mueller 2 bed 2 bath');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/lease/', 'bedsMin=2', 'bathsMin=2']);
});
run('residential lease: condo for lease 78704 under 2800', () => {
  const r = handleSearchTurn('condo for lease 78704 under 2800');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/lease/', 'zip-78704', 'rentMax=2800']);
});

// ---------------------------------------------------------------------------
// Commercial lease URL routing
// ---------------------------------------------------------------------------
run('commercial lease: office space for lease Austin 2000 sf', () => {
  const r = handleSearchTurn('office space for lease Austin 2000 sf');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/commercial-lease/', 'useType=office', 'sfMin=2000']);
});
run('commercial lease: retail for lease South Lamar', () => {
  const r = handleSearchTurn('retail for lease South Lamar');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/commercial-lease/', 'useType=retail']);
});
run('commercial lease: warehouse for lease Schertz 10000 to 25000 sqft NNN', () => {
  const r = handleSearchTurn('warehouse for lease Schertz 10000 to 25000 sqft NNN');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/commercial-lease/', 'useType=warehouse', 'sfMin=10000', 'sfMax=25000', 'leaseType=nnn']);
});
run('commercial lease: flex space for lease Cedar Park', () => {
  const r = handleSearchTurn('flex space for lease Cedar Park');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/commercial-lease/', 'useType=flex']);
});
run('commercial lease: sublease office Stone Oak 1500 sf', () => {
  const r = handleSearchTurn('sublease office Stone Oak 1500 sf');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/commercial-lease/', 'useType=office', 'sfMin=1500', 'sublease=1']);
});
run('commercial lease: medical office for lease Boerne $28/sf', () => {
  const r = handleSearchTurn('medical office for lease Boerne $28/sf');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/commercial-lease/', 'pricePerSfMax=28']);
});

// ---------------------------------------------------------------------------
// Ambiguity / clarifier
// ---------------------------------------------------------------------------
run('ambiguity: "looking at office space South Congress" -> askTransactionType', () => {
  const r = handleSearchTurn('looking at office space South Congress');
  if (r.kind !== 'askTransactionType') throw new Error('kind=' + r.kind);
});
run('ambiguity: "buy or lease a condo downtown" -> askTransactionType', () => {
  const r = handleSearchTurn('buy or lease a condo downtown');
  if (r.kind !== 'askTransactionType') throw new Error('kind=' + r.kind);
});

// ---------------------------------------------------------------------------
// Regression: sale paths unchanged
// ---------------------------------------------------------------------------
run('sale regression: 3 bed home in Mueller under 800k', () => {
  const r = handleSearchTurn('3 bed home in Mueller under 800k');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/properties/', 'bedsMin=3', 'priceMax=800000']);
});
run('sale regression: commercial sale -> /commercial/', () => {
  const r = handleSearchTurn('buy retail building Austin 5000 sf');
  if (r.kind !== 'results') throw new Error('kind=' + r.kind);
  expectHas(r.url, ['/commercial/', 'useType=retail']);
});

console.log('dalton.lease.test: done');
