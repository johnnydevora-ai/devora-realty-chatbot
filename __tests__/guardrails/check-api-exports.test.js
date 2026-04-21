'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { run, checkFile, analyze } = require('../../scripts/check-api-exports');

describe('check-api-exports guardrail', () => {
  test('analyze() detects an ES module with export default', () => {
    const r = analyze('export default function handler(req, res) {}');
    expect(r.hasEsDefault).toBe(true);
  });

  test('analyze() flags bare module.exports without module.exports.default', () => {
    const r = analyze('module.exports = async function handler(req, res) {};');
    expect(r.hasBareModuleExports).toBe(true);
    expect(r.hasModuleExportsDefault).toBe(false);
    expect(r.hasEsDefault).toBe(false);
  });

  test('analyze() accepts module.exports + module.exports.default pair', () => {
    const src = [
      'const handler = async (req, res) => {};',
      'module.exports = handler;',
      'module.exports.default = handler;'
    ].join('\n');
    const r = analyze(src);
    expect(r.hasBareModuleExports).toBe(true);
    expect(r.hasModuleExportsDefault).toBe(true);
  });

  test('analyze() ignores module.exports that appears only inside comments/strings', () => {
    const src = [
      '// module.exports = handler;',
      "const s = 'module.exports = handler';",
      'export default function handler(req, res) {}'
    ].join('\n');
    const r = analyze(src);
    expect(r.hasEsDefault).toBe(true);
    expect(r.hasBareModuleExports).toBe(false);
  });

  test('run() passes on the real pages/api tree', () => {
    const { files, failures } = run();
    expect(files.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  test('run() fails on a synthetic bad file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrail-'));
    fs.writeFileSync(path.join(tmp, 'bad.js'), 'module.exports = async (req, res) => {};');
    const { files, failures } = run(tmp);
    expect(files.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].err).toMatch(/default/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
