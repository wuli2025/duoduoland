const recorded = Symbol('recordedError');
const defaultLogger = entry => console.log(JSON.stringify(entry));
function logError(error, { logger = defaultLogger, correlationId, operation, started }) {
  const code = /^[A-Z_]+$/.test(error?.code || '') ? error.code : 'REQUEST_FAILED';
  if (error?.[recorded] === correlationId) return error;
  const safe = Object.assign(new Error(code), { code });
  safe.correlationId = correlationId;
  if (Number.isInteger(error?.httpStatus)) safe.httpStatus = error.httpStatus;
  if (/^[A-Z0-9_]+$/.test(error?.causeCode || '')) safe.causeCode = error.causeCode;
  logger({ correlationId, operation, status: 'error', code,
    durationMs: Math.max(0, Date.now() - started),
    ...(safe.httpStatus === undefined ? {} : { httpStatus: safe.httpStatus }),
    ...(safe.causeCode === undefined ? {} : { causeCode: safe.causeCode }) });
  safe[recorded] = correlationId;
  return safe;
}
module.exports = { logError, defaultLogger };
