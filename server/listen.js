const { execFile } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { logError } = require('./error-log');
async function listen(server, { port = 8787, portAttempts = 10 } = {}, {
  logger = entry => console.log(JSON.stringify(entry)), open = false,
  openBrowser = url => execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true },
    error => { if (error) logger({ event: 'browser_error', code: 'BROWSER_OPEN_FAILED' }); }),
} = {}) {
  const started = Date.now();
  const correlationId = randomUUID();
  const failure = (code, port, causeCode) => logError({ code, causeCode }, {
    logger: entry => logger({ event: 'listen_error', ...(port === undefined ? {} : { port }), ...entry }),
    correlationId, operation: 'listen', started });
  const attempts = Math.max(1, Math.min(100, Math.floor(portAttempts)));
  for (let offset = 0; offset < attempts && port + offset <= 65535; offset++) {
    const current = port === 0 ? 0 : port + offset;
    try {
      await new Promise((resolve, reject) => {
        const fail = error => { server.removeListener('listening', ready); reject(error); };
        const ready = () => { server.removeListener('error', fail); resolve(); };
        server.once('error', fail);
        server.once('listening', ready);
        server.listen(current, '127.0.0.1');
      });
    } catch (error) {
      const code = error.code === 'EADDRINUSE' ? 'PORT_IN_USE' : 'LISTEN_FAILED';
      const safe = failure(code, current, error.code);
      if (code === 'PORT_IN_USE') continue;
      throw safe;
    }
    server.on('error', error => failure('LISTEN_FAILED', current, error.code));
    const url = 'http://127.0.0.1:' + server.address().port;
    logger({ event: 'listening', url });
    if (open) openBrowser(url);
    return { server, url };
  }
  throw failure('PORT_RANGE_EXHAUSTED');
}
module.exports = { listen };
