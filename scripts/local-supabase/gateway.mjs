// Minimal gateway that gives the local stack Supabase's URL layout:
//   /auth/v1/*  -> GoTrue
//   /rest/v1/*  -> PostgREST
// supabase-js only ever needs these two prefixes for this app. Realtime is not available locally;
// the app's presence layer polls through its own API routes instead (see src/lib/presence).
import http from 'node:http';

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH_PORT = Number(process.env.AUTH_PORT ?? 54324);
const REST_PORT = Number(process.env.REST_PORT ?? 54323);

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  let target = null;
  let path = url;
  if (url.startsWith('/auth/v1')) {
    target = AUTH_PORT;
    path = url.slice('/auth/v1'.length) || '/';
  } else if (url.startsWith('/rest/v1')) {
    target = REST_PORT;
    path = url.slice('/rest/v1'.length) || '/';
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    res.end();
    return;
  }
  if (!target) {
    res.writeHead(404, { 'content-type': 'application/json', ...cors() });
    res.end(JSON.stringify({ message: 'not found' }));
    return;
  }
  const headers = { ...req.headers, host: `127.0.0.1:${target}` };
  // GoTrue builds absolute links from these; keep them pointing back at the gateway.
  headers['x-forwarded-host'] = req.headers.host ?? `127.0.0.1:${GATEWAY_PORT}`;
  headers['x-forwarded-proto'] = 'http';
  const upstream = http.request({ host: '127.0.0.1', port: target, method: req.method, path, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors() });
    up.pipe(res);
  });
  upstream.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json', ...cors() });
    res.end(JSON.stringify({ message: 'upstream unavailable', detail: String(err.message) }));
  });
  req.pipe(upstream);
});

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, apikey, content-type, prefer, x-client-info, x-supabase-api-version, accept, range, accept-profile, content-profile',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-expose-headers': 'content-range, range',
  };
}

server.listen(GATEWAY_PORT, '127.0.0.1', () => {
  console.log(`gateway listening on http://127.0.0.1:${GATEWAY_PORT} (auth -> :${AUTH_PORT}, rest -> :${REST_PORT})`);
});
