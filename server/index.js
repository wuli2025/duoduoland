const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { config: readConfig } = require('./config.js');
const { createLLM } = require('./llm.js');
const { logError, defaultLogger } = require('./error-log.js');
// Snapshot at process startup: a later static-file update must not relabel old code.
const appVersion = require('../src/config/llm').appVersion;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
function createServer({ config = readConfig(), logger = defaultLogger, llm = createLLM({ config, logger }) } = {}) {
  return http.createServer(async (req, res) => {
    const correlationId = crypto.randomUUID();
    const started = Date.now();
    let operation = 'http';
    const context = () => ({ logger, correlationId, operation, started });
    function json(res, status, body, error) {
      if (status >= 400) logError(error || { code: body.error }, context());
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ...body, correlationId }));
    }
    res.setHeader('X-Request-Id', correlationId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const expectedHost = '127.0.0.1:' + (res.socket.localPort);
    if (req.headers.host !== expectedHost) return json(res, 403, { error: 'INVALID_HOST', correlationId });
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://' + expectedHost).pathname); }
    catch (_) { return json(res, 400, { error: 'INVALID_PATH', correlationId }); }
    if (pathname === '/api/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, configured: !!(config.key && config.baseUrl && config.model),
        model: config.model || '', timeoutMs: config.timeout, appVersion });
    }
    if (pathname.startsWith('/api/')) {
      const kind = pathname === '/api/llm/rerank' ? 'rerank' : pathname === '/api/llm/intent' ? 'intent' : '';
      operation = kind || 'http';
      if (!kind || req.method !== 'POST') return json(res, 404, { error: 'NOT_FOUND', correlationId });
      if (req.headers.origin && req.headers.origin !== 'http://' + expectedHost) return json(res, 403, { error: 'INVALID_ORIGIN', correlationId });
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'JSON_REQUIRED', correlationId });
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 100000) return json(res, 413, { error: 'BODY_TOO_LARGE', correlationId });
          chunks.push(chunk);
        }
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { return json(res, 400, { error: 'INVALID_JSON', correlationId }); }
        const controller = new AbortController();
        const disconnect = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', disconnect);
        try {
          const result = await llm[kind](input, correlationId, { signal: controller.signal });
          if (!res.destroyed) return json(res, 200, { ...result, correlationId });
        } finally { res.removeListener('close', disconnect); }
      } catch (error) {
        const safe = logError(error, context());
        const code = safe.code;
        if (!res.destroyed) return json(res, code === 'LLM_TIMEOUT' ? 504 : code === 'LLM_BUSY' ? 429 : 502,
          { error: code, correlationId }, safe);
      }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    // Only public assets may be served: never .env, server source, prompts, or docs.
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!/^(?:index\.html|(?:src|assets)\/[a-zA-Z0-9_./-]+)$/.test(relative) || relative.split('/').some(p => p.startsWith('.'))) {
      return json(res, 404, { error: 'NOT_FOUND' });
    }
    const target = path.resolve(config.root, relative);
    if (!target.startsWith(config.root + path.sep) || !types[path.extname(target)]) return json(res, 404, { error: 'NOT_FOUND' });
    try {
      const contents = await fs.promises.readFile(target);
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] + (target.endsWith('.js') ? '; charset=utf-8' : '') });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (_) { json(res, 404, { error: 'NOT_FOUND' }); }
  });
}
if (require.main === module) {
  const config = readConfig();
  require('./listen').listen(createServer({ config }), config, { open: process.argv.includes('--open') })
    .catch(error => {
      logError(error, { correlationId: error.correlationId || crypto.randomUUID(), operation: 'listen', started: Date.now() });
      process.exitCode = 1;
    });
}
module.exports = { createServer };
