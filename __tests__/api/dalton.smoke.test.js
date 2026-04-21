// __tests__/api/dalton.smoke.test.js
// Lean smoke tests for the DALTON API route.
//
// These are explicitly the shape that would have caught the original
// production outage (route shipped without an exported handler). They
// run against the real route file with an in-memory req/res pair.

const httpMocks = require('node-mocks-http');

const daltonModule = require('../../pages/api/dalton');
const handler =
    typeof daltonModule === 'function'
    ? daltonModule
      : daltonModule && daltonModule.default;

function invoke({ method = 'POST', body = {} } = {}) {
    const req = httpMocks.createRequest({
          method,
          url: '/api/dalton',
          headers: { 'content-type': 'application/json' },
          body,
    });
    const res = httpMocks.createResponse();
    return Promise.resolve(handler(req, res)).then(() => res);
}

describe('/api/dalton', () => {
    test('exports a callable default handler', () => {
          expect(typeof handler).toBe('function');
    });

           test('GET returns 405 with Allow header', async () => {
                 const res = await invoke({ method: 'GET' });
                 expect(res.statusCode).toBe(405);
                 expect(String(res.getHeader('Allow') || '')).toContain('POST');
           });

           test('OPTIONS preflight returns 204 with CORS headers', async () => {
                 const res = await invoke({ method: 'OPTIONS' });
                 expect(res.statusCode).toBe(204);
                 expect(res.getHeader('Access-Control-Allow-Methods')).toMatch(/POST/i);
           });

           test('POST with empty body returns 400 (not 500)', async () => {
                 const res = await invoke({ method: 'POST', body: {} });
                 expect(res.statusCode).toBe(400);
                 const data = JSON.parse(res._getData());
                 expect(data.error).toBeDefined();
           });

           test('POST with a valid search message returns a structured 200', async () => {
                 const res = await invoke({
                         method: 'POST',
                         body: { message: '3 bed house in East Austin under 750k' },
                 });
                 expect(res.statusCode).toBe(200);
                 const data = JSON.parse(res._getData());
                 expect(data.kind).toBe('results');
                 expect(typeof data.url).toBe('string');
                 expect(data.url).toContain('city-Austin');
           });

           test('POST with smalltalk returns a message envelope', async () => {
                 const res = await invoke({
                         method: 'POST',
                         body: { message: 'hello there' },
                 });
                 expect(res.statusCode).toBe(200);
                 const data = JSON.parse(res._getData());
                 expect(data.kind).toBe('message');
           });
});
