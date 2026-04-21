#!/usr/bin/env node
/**
 * Guardrail: ensure every file under pages/api/** exports a handler that
 * Next.js 13.5+ will accept as a default export.
 *
 * Fails CI if a file:
 *   - has no default export at all, OR
 *   - uses CommonJS `module.exports = X` without also setting
 *     `module.exports.default = X` (the exact bug that took DALTON down).
 *
 * Zero dependencies. Static source scan only — we never require() the files.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(process.cwd(), 'pages', 'api');
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (EXTS.has(path.extname(name))) {
      out.push(full);
    }
  }
  return out;
}

function stripCommentsAndStrings(src) {
  // Cheap scrub so export-pattern regexes don't match inside comments/strings.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1')    // line comments (leave http:// alone)
    .replace(/`(?:\\.|[^`\\])*`/g, '``')  // template literals
    .replace(/'(?:\\.|[^'\\])*'/g, "''")  // single-quoted
    .replace(/"(?:\\.|[^"\\])*"/g, '""'); // double-quoted
}

function analyze(src) {
  const s = stripCommentsAndStrings(src);

  const hasEsDefault =
    /\bexport\s+default\b/.test(s) ||
    /\bexport\s*\{[^}]*\bdefault\b[^}]*\}/.test(s);

  const hasBareModuleExports =
    /(^|[^.\w])module\.exports\s*=[^=]/.test(s);

  const hasModuleExportsDefault =
    /(^|[^.\w])module\.exports\.default\s*=/.test(s) ||
    /(^|[^.\w])exports\.default\s*=/.test(s);

  return { hasEsDefault, hasBareModuleExports, hasModuleExportsDefault };
}

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const { hasEsDefault, hasBareModuleExports, hasModuleExportsDefault } = analyze(src);

  if (hasEsDefault) return null;

  if (hasBareModuleExports && !hasModuleExportsDefault) {
    return 'uses `module.exports = <handler>` without `module.exports.default = <handler>`; Next.js 13.5+ requires the default form';
  }

  if (!hasBareModuleExports && !hasModuleExportsDefault) {
    return 'no default export found (neither `export default` nor `module.exports(.default) =`)';
  }

  return null;
}

function run(rootDir) {
  const dir = rootDir || API_DIR;
  const files = walk(dir);
  const failures = [];
  for (const f of files) {
    const err = checkFile(f);
    if (err) failures.push({ file: path.relative(process.cwd(), f), err });
  }
  return { files, failures };
}

if (require.main === module) {
  const { files, failures } = run();
  if (!files.length) {
    console.log('check-api-exports: no pages/api files found, skipping.');
    process.exit(0);
  }
  if (failures.length) {
    console.error('check-api-exports: default-export guardrail FAILED');
    for (const { file, err } of failures) console.error('  - ' + file + ': ' + err);
    process.exit(1);
  }
  console.log('check-api-exports: OK (' + files.length + ' files verified)');
  process.exit(0);
}

module.exports = { run, checkFile, analyze, walk };
