// lib/http/apiRoute.js
// Reusable wrapper for Next.js Pages Router API routes.
//
// Responsibilities:
//   - enforce an allowed-method allowlist with a clean 405 response
//   - apply CORS headers (OPTIONS preflight answered with 204)
//   - provide a global try/catch so handler errors become shaped JSON 500s
//     instead of Next.js platform 500s
//   - defensively parse JSON bodies and cap their size
//   - expose small JSON helpers on res
//
// The wrapper is exported as CommonJS so importing files can use either
// module system. Route files should do:
//
//   const { apiRoute } = require('../../lib/http/apiRoute');
//   module.exports = apiRoute(handler, { methods: ['POST'] });
//   module.exports.default = module.exports;
//
// The `module.exports.default = module.exports` line is what keeps
// Next.js from throwing "does not export a default function" under
// strict ESM interop in Next 13.5+.

'use strict';

const { SITE_ORIGIN, MAX_BODY_BYTES } = require('../config');

const DEFAULT_METHODS = ['POST', 'OPTIONS'];

function applyCors(res, origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

function sendJson(res, status, payload) {
    res.status(status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

function parseBody(req) {
    const raw = req.body;
    if (raw == null) return {};
    if (typeof raw === 'string') {
          if (raw.length === 0) return {};
          if (raw.length > MAX_BODY_BYTES) {
                  const err = new Error('Payload too large');
                  err.statusCode = 413;
                  throw err;
          }
          try {
                  return JSON.parse(raw);
          } catch {
                  const err = new Error('Invalid JSON body');
                  err.statusCode = 400;
                  throw err;
          }
    }
    if (typeof raw === 'object') return raw;
    return {};
}

function apiRoute(handler, options = {}) {
    const methods = (options.methods || DEFAULT_METHODS).map((m) =>
          String(m).toUpperCase()
                                                               );
    const origin = (options.cors && options.cors.origin) || SITE_ORIGIN;

  const wrapped = async function apiRouteHandler(req, res) {
        applyCors(res, origin);

        if (req.method === 'OPTIONS') {
                res.status(204).end();
                return;
        }

        if (!methods.includes(req.method)) {
                res.setHeader('Allow', methods.join(', '));
                sendJson(res, 405, { error: 'Method Not Allowed' });
                return;
        }

        try {
                req.jsonBody = parseBody(req);
        } catch (err) {
                const status = err && err.statusCode ? err.statusCode : 400;
                sendJson(res, status, { error: err.message || 'Bad Request' });
                return;
        }

        res.json = (payload) => {
                sendJson(res, res.statusCode || 200, payload);
                return res;
        };

        try {
                await handler(req, res);
        } catch (err) {
                console.error('apiRoute handler error:', err);
                if (!res.headersSent) {
                          sendJson(res, 500, { error: 'Internal error' });
                }
        }
  };

  return wrapped;
}

module.exports = {
    apiRoute,
    sendJson,
    applyCors,
    parseBody,
};
