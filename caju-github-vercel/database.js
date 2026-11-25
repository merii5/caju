const { mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

function storageError(code, message) {
  return Object.assign(new Error(message), { code, storageUnavailable: true });
}

function openRemoteDatabase(url, token) {
  let endpoint;
  try {
    endpoint = new URL(url.replace(/^libsql:\/\//, 'https://'));
  } catch {
    throw storageError('TURSO_URL_INVALID', 'TURSO_DATABASE_URL must be a valid libsql or HTTPS URL.');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
    throw storageError('TURSO_URL_INVALID', 'TURSO_DATABASE_URL must contain only the database origin.');
  }
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + '/v2/pipeline';

  async function pipeline(request) {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [request, { type: 'close' }] }),
        signal: AbortSignal.timeout(12000)
      });
    } catch {
      throw storageError('TURSO_CONNECTION_FAILED', 'Could not connect to the configured Turso database.');
    }
    if (!response.ok) {
      throw storageError(`TURSO_HTTP_${response.status}`, 'The configured Turso database rejected the request.');
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw storageError('TURSO_RESPONSE_INVALID', 'Turso did not return a valid pipeline response.');
    }
    const { results } = data || {};
    if (results?.[0]?.type !== 'ok') {
      const upstreamCode = results?.[0]?.error?.code;
      const code = typeof upstreamCode === 'string' && /^[A-Z][A-Z_0-9]{0,60}$/.test(upstreamCode) ? upstreamCode : 'STATEMENT_FAILED';
      throw storageError(`TURSO_${code}`, 'The remote database could not execute a statement.');
    }
    return results[0].response;
  }

  function encode(value) {
    if (value === null) return { type: 'null' };
    if (typeof value === 'number' && Number.isSafeInteger(value)) return { type: 'integer', value: String(value) };
    if (typeof value === 'string') return { type: 'text', value };
    throw new TypeError('Unsupported SQL parameter.');
  }

  function decode(cell) {
    if (cell.type === 'null') return null;
    if (cell.type === 'integer') return Number(cell.value);
    return cell.value;
  }

  return {
    async exec(sql) {
      await pipeline({ type: 'sequence', sql });
    },
    prepare(sql) {
      async function execute(args, rows) {
        const { result } = await pipeline({ type: 'execute', stmt: { sql, args: args.map(encode), want_rows: rows } });
        return result;
      }
      async function all(...args) {
        const { cols, rows } = await execute(args, true);
        return rows.map(row => Object.fromEntries(cols.map(({ name }, index) => [name, decode(row[index])])));
      }
      return {
        all,
        get: async (...args) => (await all(...args))[0],
        run: async (...args) => ({ changes: (await execute(args, false)).affected_row_count })
      };
    }
  };
}

function openDatabase() {
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, VERCEL } = process.env;
  if (TURSO_DATABASE_URL || TURSO_AUTH_TOKEN || VERCEL) {
    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
      throw storageError('TURSO_CONFIG_MISSING', 'Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for hosted storage.');
    }
    return openRemoteDatabase(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN);
  }

  const { DatabaseSync } = require('node:sqlite');
  const path = resolve(process.env.DATABASE_PATH || 'data/caju.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

module.exports = { openDatabase };
