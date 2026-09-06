// Security probes against a running server (spec 46.26).
// usage: node scripts/security-probes.mjs [baseUrl]   (defaults to http://127.0.0.1:3000, reads .env.local)
// Creates throwaway guest accounts on the configured backend. Never run against production data.
import { readFileSync } from 'node:fs';
const B = process.argv[2] ?? 'http://127.0.0.1:3000';
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const GW = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const COOKIE = 'jnss-auth'; // AUTH_COOKIE_OPTIONS.name in src/lib/supabase/cookies.ts
const results = [];
const check = (name, ok, detail='') => { results.push([ok, name, detail]); console.log(`${ok?'PASS':'FAIL'}  ${name}${detail?'  ['+detail+']':''}`); };

// --- create two guest sessions directly against GoTrue (same thing /enter does in the browser)
async function guest() {
  const r = await fetch(`${GW}/auth/v1/signup`, { method:'POST', headers:{ apikey: ANON, 'content-type':'application/json' }, body: '{}' });
  const j = await r.json();
  if (!j.access_token) throw new Error('anon signup failed: '+JSON.stringify(j).slice(0,200));
  // @supabase/ssr cookie format: base64url json of the session under the app's fixed cookie name. Use the chunked-less form.
  const session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user: j.user };
  const cookie = `${COOKIE}=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  return { id: j.user.id, cookie, token: j.access_token };
}
function api(path, { method='POST', body, cookie, origin=B, headers={} }={}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = h['content-type'] ?? 'application/json';
  if (origin) h.origin = origin;
  if (cookie) h.cookie = cookie;
  return fetch(B+path, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), redirect: 'manual' });
}
const A = await guest(); const Bu = await guest();
console.log('guests created');

// onboard both
async function onboard(u, name) {
  const r = await api('/api/profile', { cookie: u.cookie, body: { action:'onboard', username: name, displayName: name, planetName: 'Somewhere', rocketName: 'Probe', rocket: { body:'stub', engine:'single', fins:'swept', color:'navy', accent:'cream', decal:'none' } } });
  return r;
}
const ua = 'p' + A.id.slice(0,8).replace(/-/g,''); const ub = 'p' + Bu.id.slice(0,8).replace(/-/g,'');
check('onboard A', (await onboard(A, ua)).status === 200);
check('onboard B', (await onboard(Bu, ub)).status === 200);

// --- session validation
let r = await api('/api/game', { cookie: COOKIE+'=base64-'+Buffer.from(JSON.stringify({access_token:'garbage',refresh_token:'x',expires_at:9999999999,user:{id:'x'}})).toString('base64url'), body: { action:'progress', planetId:'planet:0:0' } });
check('garbage session cookie -> 401', r.status === 401, String(r.status));
{
  // expired: build a JWT with exp in the past signed with wrong key -> gotrue rejects
  const expired = { access_token: A.token.split('.').slice(0,2).join('.')+'.AAAA', refresh_token: 'nope', expires_at: 1, expires_in: 0, token_type:'bearer', user:{id:A.id} };
  r = await api('/api/game', { cookie: `${COOKIE}=base64-${Buffer.from(JSON.stringify(expired)).toString('base64url')}`, body: { action:'progress', planetId:'planet:0:0' } });
  check('tampered/expired session -> 401', r.status === 401, String(r.status));
}

// --- CSRF (46.15)
r = await api('/api/game', { cookie: A.cookie, origin: 'https://evil.example', body: { action:'progress', planetId:'planet:0:0' } });
check('cross-origin POST with valid cookie -> 403', r.status === 403, String(r.status));
r = await api('/api/game', { cookie: A.cookie, origin: null, body: { action:'progress', planetId:'planet:0:0' } });
check('POST with no Origin header -> 403', r.status === 403, String(r.status));
r = await api('/api/game', { cookie: A.cookie, origin: null, headers: { 'sec-fetch-site': 'same-origin' }, body: { action:'progress', planetId:'planet:0:0' } });
check('POST with Sec-Fetch-Site same-origin (no Origin) -> 200', r.status === 200, String(r.status));
r = await api('/api/game', { cookie: A.cookie, headers: { 'sec-fetch-site': 'cross-site' }, body: { action:'progress', planetId:'planet:0:0' } });
check('POST with Sec-Fetch-Site cross-site -> 403', r.status === 403, String(r.status));
r = await api('/api/presence', { method: 'DELETE', cookie: A.cookie, origin: 'https://evil.example' });
check('cross-origin DELETE -> 403', r.status === 403, String(r.status));

// --- wrong methods (46.24)
for (const [p, m] of [['/api/game','GET'],['/api/profile','GET'],['/api/presence','GET'],['/api/friends','PUT'],['/api/game','DELETE']]) {
  r = await api(p, { method: m, cookie: A.cookie });
  check(`${m} ${p} -> 405 + Allow`, r.status === 405 && !!r.headers.get('allow'), `${r.status} allow=${r.headers.get('allow')}`);
}

// --- input validation (46.9)
const bad = [
  ['malformed JSON', '{"action":', 400],
  ['JSON array body', '[1,2,3]', 400],
  ['JSON string body', '"hello"', 400],
  ['unknown action', { action: 'give_me_points', points: 9999 }, 400],
  ['unexpected field', { action:'progress', planetId:'planet:0:0', points: 9999 }, 400],
  ['bad planet id (sql-ish)', { action:'land', planetId: "planet:0:0' OR 1=1 --" }, 400],
  ['system id where planet expected', { action:'land', planetId: 'system:0' }, 400],
  ['negative index', { action:'scan_site', planetId:'planet:0:0', siteIndex: -1 }, 400],
  ['float index', { action:'scan_site', planetId:'planet:0:0', siteIndex: 1.5 }, 400],
  ['string index', { action:'scan_site', planetId:'planet:0:0', siteIndex: '1' }, 400],
  ['huge index', { action:'collect', planetId:'planet:0:0', nodeIndex: 999999 }, 400],
  ['out-of-range system', { action:'visit_system', systemId:'system:99' }, 404],
  ['non-existent planet', { action:'land', planetId:'planet:0:99' }, 404],
  ['object as id', { action:'land', planetId: { $ne: null } }, 400],
];
for (const [name, body, want] of bad) {
  r = await api('/api/game', { cookie: A.cookie, body });
  const j = await r.json().catch(()=>({}));
  check(`game: ${name} -> ${want}`, r.status === want && !/pg|postgres|relation|syntax|column|constraint|stack/i.test(JSON.stringify(j)), `${r.status} ${JSON.stringify(j).slice(0,90)}`);
}
r = await api('/api/game', { cookie: A.cookie, body: '{"action":"progress","planetId":"planet:0:0"}', headers: { 'content-type': 'text/plain' } });
check('wrong content-type -> 415', r.status === 415, String(r.status));
r = await api('/api/game', { cookie: A.cookie, body: JSON.stringify({ action:'progress', planetId:'planet:0:0', pad: 'x'.repeat(20000) }) });
check('oversized body (20 KB) -> 413', r.status === 413, String(r.status));

// profile validation
const badP = [
  ['username with quotes', { action:'onboard', username: "bob'; drop table player_profiles;--", displayName:'x', planetName:'y', rocketName:'z', rocket:{ body:'stub', engine:'single', fins:'swept', color:'navy', accent:'cream', decal:'none' } }, 400],
  ['display name too long', { action:'update', displayName: 'a'.repeat(33) }, 400],
  ['display name control chars', { action:'update', displayName: 'a\u0000b' }, 400],
  ['planet name Earth', { action:'update', planetName: 'Earth' }, 400],
  ['rocket with hex colour', { action:'save_rocket', rocketName:'x', rocket:{ body:'stub', engine:'single', fins:'swept', color:'#ff00ff', accent:'cream', decal:'none' } }, 400],
  ['rocket unknown part', { action:'save_rocket', rocketName:'x', rocket:{ body:'saucer', engine:'single', fins:'swept', color:'navy', accent:'cream', decal:'none' } }, 400],
  ['points smuggled in update', { action:'update', displayName:'ok', points: 99999 }, 400],
  ['empty update', { action:'update' }, 400],
  ['suit unknown colour', { action:'save_customization', displayName:'ok', rocket:{ body:'stub', engine:'single', fins:'swept', color:'navy', accent:'cream', decal:'none' }, suit:{ primary:'neon', secondary:'slate', visor:'sky', pack:'navy' } }, 400],
];
for (const [name, body, want] of badP) {
  r = await api('/api/profile', { cookie: A.cookie, body });
  const j = await r.json().catch(()=>({}));
  check(`profile: ${name} -> ${want}`, r.status === want && !/pg|postgres|relation|syntax|column|constraint|stack/i.test(JSON.stringify(j)), `${r.status} ${JSON.stringify(j).slice(0,90)}`);
}

// XSS payload stored + rendered safely (46.10)
const xss = '<img src=x onerror=alert(1)>"><script>alert(2)</script>';
r = await api('/api/profile', { cookie: A.cookie, body: { action:'update', displayName: xss.slice(0,32), planetName: '<b>Not</b> Earth' } });
check('XSS display name accepted as plain text (200)', r.status === 200, String(r.status));
{
  const html = await (await fetch(B+'/profile', { headers: { cookie: A.cookie } })).text();
  const rawTag = html.includes('<img src=x onerror') || html.includes('<script>alert(2)');
  const escaped = html.includes('&lt;img src=x onerror') || html.includes('&lt;script&gt;alert(2)');
  check('XSS payload rendered escaped on /profile', !rawTag && escaped, `raw=${rawTag} escaped=${escaped}`);
}
// presence carries display names to other players: check the JSON transport is plain (no HTML injected server-side)
r = await api('/api/presence', { cookie: Bu.cookie, body: { systemId: null, planetId: null, x: 0, y: 0, facing: 1 } });
check('presence heartbeat ok for B', r.status === 200, String(r.status));

// --- authorization (46.6 / 46.26)
// A tries to accept an invite B -> C? Use friendships: B invites A, then Bu (as requester) tries to accept its own invite -> 403; a third user tries to remove -> 404
r = await api('/api/friends', { cookie: Bu.cookie, body: { action:'invite', userId: A.id } });
check('B invites A -> 200', r.status === 200, String(r.status));
const list = await (await api('/api/friends', { method:'GET', cookie: A.cookie, origin: null })).json();
const inv = list.friendships?.find(f => f.otherId === Bu.id);
check('A sees the invite', !!inv, JSON.stringify(list).slice(0,100));
r = await api('/api/friends', { cookie: Bu.cookie, body: { action:'accept', id: inv.id } });
check('requester cannot accept own invite -> 403', r.status === 403, String(r.status));
const C = await guest(); await onboard(C, 'p' + C.id.slice(0,8).replace(/-/g,''));
r = await api('/api/friends', { cookie: C.cookie, body: { action:'remove', id: inv.id } });
check('third party cannot remove others\' friendship -> 404 (no oracle)', r.status === 404, String(r.status));
r = await api('/api/friends', { cookie: C.cookie, body: { action:'accept', id: inv.id } });
check('third party cannot accept others\' invite -> 404', r.status === 404, String(r.status));
r = await api('/api/friends', { cookie: A.cookie, body: { action:'invite', userId: 'not-a-uuid' } });
check('invite with non-uuid -> 400', r.status === 400, String(r.status));
r = await api('/api/friends', { cookie: A.cookie, body: { action:'invite', userId: `${Bu.id},receiver_id.eq.${A.id}` } });
check('invite with PostgREST filter injection -> 400', r.status === 400, String(r.status));
r = await api('/api/friends', { cookie: A.cookie, body: { action:'invite', userId: '00000000-0000-4000-8000-000000000000' } });
check('invite unknown player -> 404', r.status === 404, String(r.status));
r = await api('/api/friends', { cookie: A.cookie, body: { action:'accept', id: inv.id } });
check('receiver accepts -> 200', r.status === 200, String(r.status));

// self-award / cross-user writes through PostgREST with the user's own JWT (RLS + grants + trigger)
async function rest(u, path, method, body) {
  const r = await fetch(`${GW}/rest/v1/${path}`, { method, headers: { apikey: ANON, authorization: `Bearer ${u.token}`, 'content-type':'application/json', prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, text: (await r.text()).slice(0,120) };
}
let x = await rest(A, `player_profiles?user_id=eq.${A.id}`, 'PATCH', { points: 999999 });
check('self-award points via direct PATCH -> refused', x.status >= 400, `${x.status} ${x.text}`);
x = await rest(A, `player_profiles?user_id=eq.${Bu.id}`, 'PATCH', { display_name: 'hacked' });
const bProfile = await rest(A, `player_profiles?user_id=eq.${Bu.id}&select=display_name`, 'GET');
check('update another player\'s profile -> no row changed', !bProfile.text.includes('hacked'), `${x.status} ${bProfile.text}`);
x = await rest(A, `point_events`, 'POST', { player_id: A.id, event: 'planet_discovered', source_id: 'x', points: 5000 });
check('insert into point_events -> refused', x.status >= 400, `${x.status} ${x.text}`);
x = await rest(A, `inventory`, 'POST', { player_id: A.id, resource_id: 'brine', quantity: 9999 });
check('insert into inventory -> refused', x.status >= 400, `${x.status} ${x.text}`);
x = await rest(A, `discoveries?player_id=eq.${Bu.id}`, 'PATCH', { player_id: A.id });
check('re-own another player\'s discoveries -> refused/no-op', x.status >= 400 || x.text === '[]', `${x.status} ${x.text}`);
x = await rest(A, `rockets?owner_id=eq.${Bu.id}`, 'PATCH', { name: 'stolen' });
check('rename another player\'s rocket -> no row changed', x.text === '[]' || x.status >= 400, `${x.status} ${x.text}`);
x = await rest(A, `inventory?player_id=eq.${Bu.id}&select=*`, 'GET');
check('read another player\'s inventory -> empty', x.text === '[]', `${x.status} ${x.text}`);
x = await rest(A, `point_events?player_id=eq.${Bu.id}&select=*`, 'GET');
check('read another player\'s point ledger -> empty', x.text === '[]', `${x.status} ${x.text}`);
x = await rest(A, `rpc/award_points`, 'POST', { p_player: A.id, p_event: 'planet_discovered', p_source: 'x' });
check('call award_points RPC as player -> refused', x.status >= 400, `${x.status} ${x.text}`);
const anonRead = await fetch(`${GW}/rest/v1/player_profiles?select=username`, { headers: { apikey: ANON } });
check('anon (no session) reads player_profiles -> refused/empty', anonRead.status >= 400 || (await anonRead.text()) === '[]', String(anonRead.status));

// --- rate limiting (46.12)
{
  let got429 = false, first429 = 0;
  for (let i = 0; i < 70; i++) {
    const r = await api('/api/game', { cookie: C.cookie, body: { action:'progress', planetId:'planet:0:0' } });
    if (r.status === 429) { got429 = true; first429 = i+1; check('429 carries Retry-After + in-tone body', !!r.headers.get('retry-after') && (await r.json()).head === 'EASY THERE.', `retry-after=${r.headers.get('retry-after')}`); break; }
  }
  check('game actions rate limited (429 after 60/min)', got429 && first429 === 61, `first 429 at request ${first429}`);
}
{
  let got429 = false, first = 0;
  for (let i = 0; i < 15; i++) { const r = await api('/api/friends', { cookie: C.cookie, body: { action:'invite', userId: '00000000-0000-4000-8000-000000000000' } }); if (r.status === 429) { got429 = true; first = i+1; break; } }
  check('friend invites rate limited (429 after 10/10min)', got429 && first === 11, `first 429 at ${first}`);
}
// normal gameplay not blocked: fresh user does a realistic sequence
{
  const D = await guest(); await onboard(D, 'p' + D.id.slice(0,8).replace(/-/g,''));
  const seq = [ { action:'visit_system', systemId:'system:0' }, { action:'land', planetId:'planet:0:0' }, { action:'progress', planetId:'planet:0:0' } ];
  for (let i = 0; i < 6; i++) seq.push({ action:'scan_site', planetId:'planet:0:0', siteIndex: i });
  for (let i = 0; i < 6; i++) seq.push({ action:'collect', planetId:'planet:0:0', nodeIndex: i });
  let allOk = true, pts = 0;
  for (const b of seq) { const r = await api('/api/game', { cookie: D.cookie, body: b }); if (r.status !== 200 && r.status !== 404) { allOk = false; console.log('  seq fail', b, r.status, (await r.text()).slice(0,100)); } else if (r.status === 200) { const j = await r.json(); pts += j.points_awarded ?? 0; } }
  for (let i = 0; i < 15; i++) { const r = await api('/api/presence', { cookie: D.cookie, body: { systemId:'system:0', planetId:'planet:0:0', x: i, y: 0, facing: 1 } }); if (r.status !== 200) allOk = false; }
  check('normal play sequence (15 actions + 15 heartbeats) never limited', allOk, `points earned server-side: ${pts}`);
  // idempotency: repeat the same land -> 0 points second time
  const again = await (await api('/api/game', { cookie: D.cookie, body: { action:'land', planetId:'planet:0:0' } })).json();
  check('repeat discovery awards 0 points (idempotent)', again.points_awarded === 0 && again.newly_discovered === false, JSON.stringify(again));
}

// --- error shape: no internals (46.20/46.22): force a 500 by hitting presence with planet lacking system? (validated). Use health for shape only.
const h = await (await fetch(B+'/api/health')).json();
check('health discloses only mode + up flag', JSON.stringify(Object.keys(h)) === '["ok","backend","backendUp"]' && !JSON.stringify(h).includes('http') && h.ok === true && h.backendUp === true, JSON.stringify(h));

// --- auth callback open redirect (46.4)
for (const n of ['//evil.example', '/\\evil.example', 'https://evil.example', '/universe%0d%0aSet-Cookie:x=y']) {
  const r = await fetch(B+'/auth/callback?code=bogus&next='+encodeURIComponent(n), { redirect: 'manual' });
  const loc = r.headers.get('location') || '';
  check(`callback next=${n} -> stays on site`, loc.startsWith(B+'/') && !loc.includes('evil'), loc);
}

// --- cookie attributes on session refresh through middleware
{
  const r = await fetch(B+'/universe', { headers: { cookie: A.cookie }, redirect: 'manual' });
  const sc = r.headers.getSetCookie?.() ?? [];
  check('/universe serves for authenticated guest', r.status === 200, String(r.status));
  console.log('  set-cookie attrs (prod build over http):', sc.map(c => c.replace(/=[^;]+/, '=<v>')).join(' | ').slice(0,300) || '(none set this request)');
}

{
  // Force a refresh: expired access token + valid refresh token -> middleware refreshes and sets cookies.
  const E = await guest();
  const stale = { access_token: E.token, refresh_token: JSON.parse(Buffer.from(E.cookie.split('base64-')[1], 'base64url').toString()).refresh_token, expires_at: Math.floor(Date.now()/1000) - 100, expires_in: 0, token_type: 'bearer', user: { id: E.id } };
  const r = await fetch(B+'/universe', { headers: { cookie: `${COOKIE}=base64-${Buffer.from(JSON.stringify(stale)).toString('base64url')}` }, redirect: 'manual' });
  const sc = r.headers.getSetCookie?.() ?? [];
  const attrs = sc.map(c => c.split(';').slice(1).join(';').trim().toLowerCase());
  console.log('  refresh set-cookie attrs:', attrs.join(' | ').slice(0,300) || '(none)');
  check('refreshed session cookie is Secure + SameSite=None + Partitioned + Path=/', sc.length > 0 && attrs.every(a => a.includes('secure') && a.includes('samesite=none') && a.includes('partitioned') && a.includes('path=/')), String(sc.length));
}
const fails = results.filter(r => !r[0]);
console.log(`\n${results.length - fails.length}/${results.length} probes passed`);
if (fails.length) { console.log('FAILED:'); for (const f of fails) console.log(' -', f[1], f[2]); process.exit(1); }
