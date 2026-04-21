// lib/config.js
// Centralized, lightweight configuration for the DALTON API.
// Keep this file tiny and dependency-free so it can be imported from any
// Next.js route (Node or Edge) without side effects.
//
// Design rules:
//   - No network calls, no filesystem access.
//   - Safe defaults for local dev; strict for production.
//   - Never throw at module load for *optional* values.

'use strict';

// Where the public site lives (also the only origin allowed to hit the API
// via CORS). Overridable via env so preview deploys can be tested from
// different origins without a code change.
const SITE_ORIGIN =
    process.env.DALTON_SITE_ORIGIN || 'https://devorarealty.com';

// Explicit CORS allowlist. Keeping this narrow is intentional; the DALTON
// widget is embedded on exactly one public origin today.
const ALLOWED_ORIGINS = new Set([SITE_ORIGIN]);

// Body size cap for API routes. Keeps a malformed giant payload from tying
// up a serverless invocation.
const MAX_BODY_BYTES = 8 * 1024; // 8 KB

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Fail-fast accessor for *required* environment variables.
 * Use this only when a missing value should abort the request, not the build.
 * Returns the value or throws an Error with a clear message.
 *
 * Example:
 *   const key = requireEnv('OPENAI_API_KEY');
 */
function requireEnv(name) {
    const value = process.env[name];
    if (typeof value !== 'string' || value.length === 0) {
          throw new Error(
                  `Missing required environment variable: ${name}. ` +
                    `Set it in Vercel Project Settings > Environment Variables.`
                );
    }
    return value;
}

/**
 * Soft accessor for optional env vars with a default.
 */
function optionalEnv(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Returns true if the given Origin header value is allowed to call the API.
 * Falsy / missing origins are allowed (server-to-server, curl).
 */
function isOriginAllowed(origin) {
    if (!origin) return true;
    return ALLOWED_ORIGINS.has(origin);
}

module.exports = {
    SITE_ORIGIN,
    ALLOWED_ORIGINS,
    MAX_BODY_BYTES,
    IS_PRODUCTION,
    requireEnv,
    optionalEnv,
    isOriginAllowed,
};
