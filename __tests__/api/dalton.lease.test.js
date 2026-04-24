'use strict';

// Lease + commercial routing tests for DALTON. Jest suite.

const dalton = require('../../pages/api/dalton');
const {
  handleSearchTurn,
  classifyIntent,
  detectTransactionType,
  detectPropertyClass,
} = dalton;

function expectUrlToContain(url, needles) {
  for (const n of needles) {
    expect(url).toEqual(expect.stringContaining(n));
  }
}

describe('DALTON intent classification (lease/commercial)', () => {
  test.each([
    'office space for lease Austin 2000 sf',
    'home for rent in Alamo Heights',
    'sublease Stone Oak',
    'retail for lease South Lamar',
    'warehouse for lease Schertz NNN',
  ])('classifyIntent("%s") === "search"', (msg) => {
    expect(classifyIntent(msg)).toBe('search');
  });
});

describe('DALTON transaction type detection', () => {
  test('lease wording', () => {
    expect(detectTransactionType('condo for lease downtown')).toBe('lease');
    expect(detectTransactionType('house for rent in kyle')).toBe('lease');
    expect(detectTransactionType('sublease in stone oak')).toBe('lease');
  });
  test('sale wording', () => {
    expect(detectTransactionType('3 bed home for sale mueller')).toBe('sale');
    expect(detectTransactionType('buy a condo downtown')).toBe('sale');
  });
  test('ambiguous (buy or lease)', () => {
    expect(detectTransactionType('buy or lease office space')).toBe('ambiguous');
  });
});

describe('DALTON property class detection', () => {
  test('commercial use types', () => {
    expect(detectPropertyClass('office for lease austin')).toBe('commercial');
    expect(detectPropertyClass('retail space south lamar')).toBe('commercial');
    expect(detectPropertyClass('warehouse schertz 10000 sf')).toBe('commercial');
    expect(detectPropertyClass('flex space cedar park')).toBe('commercial');
  });
  test('residential default', () => {
    expect(detectPropertyClass('3 bed home for rent')).toBe('residential');
    expect(detectPropertyClass('condo downtown austin')).toBe('residential');
  });
});

describe('Residential lease URL routing', () => {
  test('2 bed condo downtown Austin for lease under 3000', () => {
    const r = handleSearchTurn('2 bed condo downtown Austin for lease under 3000');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/lease/', 'bedsMin=2', 'rentMax=3000']);
  });

  test('house for rent in Alamo Heights 3 bed under 4500', () => {
    const r = handleSearchTurn('house for rent in Alamo Heights 3 bed under 4500');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/lease/', 'bedsMin=3', 'rentMax=4500']);
  });

  test('rental in Mueller 2 bed 2 bath', () => {
    const r = handleSearchTurn('rental in Mueller 2 bed 2 bath');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/lease/', 'bedsMin=2', 'bathsMin=2']);
  });

  test('condo for lease 78704 under 2800', () => {
    const r = handleSearchTurn('condo for lease 78704 under 2800');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/lease/', 'zip-78704', 'rentMax=2800']);
  });
});

describe('Commercial lease URL routing', () => {
  test('office space for lease Austin 2000 sf', () => {
    const r = handleSearchTurn('office space for lease Austin 2000 sf');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/commercial-lease/', 'useType=office', 'sfMin=2000']);
  });

  test('retail for lease South Lamar (sufficient via useType)', () => {
    const r = handleSearchTurn('retail for lease South Lamar');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/commercial-lease/', 'useType=retail']);
  });

  test('warehouse for lease Schertz 10000 to 25000 sqft NNN', () => {
    const r = handleSearchTurn('warehouse for lease Schertz 10000 to 25000 sqft NNN');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, [
      '/commercial-lease/',
      'useType=warehouse',
      'sfMin=10000',
      'sfMax=25000',
      'leaseType=nnn',
    ]);
  });

  test('flex space for lease Cedar Park', () => {
    const r = handleSearchTurn('flex space for lease Cedar Park');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/commercial-lease/', 'useType=flex']);
  });

  test('sublease office Stone Oak 1500 sf', () => {
    const r = handleSearchTurn('sublease office Stone Oak 1500 sf');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, [
      '/commercial-lease/',
      'useType=office',
      'sfMin=1500',
      'sublease=1',
    ]);
  });

  test('medical office for lease Boerne $28/sf', () => {
    const r = handleSearchTurn('medical office for lease Boerne $28/sf');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/commercial-lease/', 'pricePerSfMax=28']);
  });
});

describe('Ambiguity / clarifier turn', () => {
  test('"looking at office space South Congress" -> askTransactionType', () => {
    const r = handleSearchTurn('looking at office space South Congress');
    expect(r.kind).toBe('askTransactionType');
  });
  test('"buy or lease a condo downtown" -> askTransactionType', () => {
    const r = handleSearchTurn('buy or lease a condo downtown');
    expect(r.kind).toBe('askTransactionType');
  });
});

describe('Sale path regression', () => {
  test('3 bed home in Mueller under 800k -> /properties/', () => {
    const r = handleSearchTurn('3 bed home in Mueller under 800k');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/properties/', 'bedsMin=3', 'priceMax=800000']);
  });

  test('buy retail building Austin 5000 sf -> /commercial/', () => {
    const r = handleSearchTurn('buy retail building Austin 5000 sf');
    expect(r.kind).toBe('results');
    expectUrlToContain(r.url, ['/commercial/', 'useType=retail']);
  });
});
