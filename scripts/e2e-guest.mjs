// End-to-end check of the guest flow against a running local stack + `next start`.
// Usage: NODE_PATH=/tmp/pw/node_modules node scripts/e2e-guest.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

try {
  // 1. Home: no account needed
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  check('home renders', (await page.title()).includes('JUST NEED SOME SPACE.'));
  const enterHref = await page.locator('a:has-text("Enter the universe")').first().getAttribute('href');
  check('home CTA goes to /universe (no signup gate)', enterHref === '/universe', enterHref);
  await page.screenshot({ path: `${OUT}/01-home.png` });

  // 2. Enter universe as a guest -> /enter -> anonymous session -> onboarding
  await page.click('a:has-text("Enter the universe")');
  await page.waitForURL(/\/onboarding/, { timeout: 30000 });
  check('guest entry lands on onboarding', page.url().includes('/onboarding'), page.url());
  await page.screenshot({ path: `${OUT}/02-onboarding-guest.png` });
  check('onboarding mentions guest', (await page.textContent('body')).includes('guest'));

  // 3. Onboarding
  const uname = 'guest_' + Math.random().toString(36).slice(2, 8);
  await page.fill('#planet', 'Somewhere Quiet');
  await page.fill('#username', uname);
  await page.click('button[type=submit]');
  await page.waitForSelector('button:has-text("The Long Way Round")', { timeout: 20000 });
  await page.click('button:has-text("The Long Way Round")');
  await page.click('button[role=radio]:has-text("Barrel")');
  await page.click('button:has-text("ESCAPE ROUTE CALCULATED")');
  await page.waitForURL(/\/universe/, { timeout: 30000 });
  check('onboarded guest reaches universe', page.url().includes('/universe'));
  await page.waitForSelector('g.sysnode', { timeout: 20000 });
  await page.screenshot({ path: `${OUT}/03-universe.png` });
  check('nav shows Guest tag', (await page.locator('header.nav .tag:has-text("Guest")').count()) > 0);
  check('nav has Customize link', (await page.locator('nav a[href="/customize"]').count()) > 0);

  // 4. Customize
  await page.goto(BASE + '/customize', { waitUntil: 'networkidle' });
  check('customize heading', (await page.locator('h1').first().textContent()).trim() === 'CUSTOMIZE YOURSELF');
  const swatchCount = await page.locator('button.swatch').count();
  check('swatch groups present (5 rocket + 4 suit) x 8', swatchCount === 9 * 8, String(swatchCount));
  check('swatches are radios with aria-checked', (await page.locator('button.swatch[role=radio][aria-checked="true"]').count()) === 9);
  await page.screenshot({ path: `${OUT}/04-customize-desktop.png` });

  await page.click('[aria-label="Engine colour"] button.swatch:has-text("Electric Aqua")');
  await page.click('[aria-label="Fin colour"] button.swatch:has-text("Cream")');
  await page.click('[aria-label="Suit primary"] button.swatch:has-text("Teal")');
  await page.fill('input[maxlength="32"]', 'Captain Quiet');
  await page.click('button[role=tab]:has-text("Astronaut")');
  check('astronaut tab selected', (await page.locator('button[role=tab][aria-selected="true"]').textContent()).trim() === 'Astronaut');
  await page.screenshot({ path: `${OUT}/05-customize-astronaut.png` });
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector('.toast:has-text("CONFIGURATION SAVED.")', { timeout: 15000 });
  check('save confirmed by DB -> CONFIGURATION SAVED.', true);
  await page.screenshot({ path: `${OUT}/06-customize-saved.png` });

  await page.reload({ waitUntil: 'networkidle' });
  const eng = await page.locator('[aria-label="Engine colour"] button.swatch[aria-checked="true"]').textContent();
  const nameVal = await page.inputValue('input[maxlength="32"]');
  check('customization persisted after reload', eng.includes("Electric Aqua") && nameVal === 'Captain Quiet', `${eng.trim()} / ${nameVal}`);

  const bad = await page.evaluate(async () => {
    const r = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save_customization', displayName: 'x\u0007y', rocket: { body: 'stub', engine: 'single', fins: 'swept', color: 'purple', accent: 'slate', decal: 'none' }, suit: { primary: 'cream', secondary: 'slate', visor: 'sky', pack: 'navy' } }) });
    return { status: r.status, body: await r.text() };
  });
  check('server rejects invalid colour / control chars', bad.status === 400, `${bad.status} ${bad.body.slice(0, 80)}`);
  const blank = await page.evaluate(async () => {
    const r = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save_customization', displayName: '   ', rocket: { body: 'stub', engine: 'single', fins: 'swept', color: 'cream', accent: 'slate', decal: 'none' }, suit: { primary: 'cream', secondary: 'slate', visor: 'sky', pack: 'navy' } }) });
    return r.status;
  });
  check('server rejects blank name', blank === 400, String(blank));

  // 5. System + planet
  await page.goto(BASE + '/universe', { waitUntil: 'networkidle' });
  await page.click('g.sysnode >> nth=0');
  await page.click('aside button.btn-primary');
  await page.waitForURL(/\/system\//, { timeout: 30000 });
  await page.waitForSelector('.planet-row', { timeout: 20000 });
  await page.screenshot({ path: `${OUT}/07-system.png` });
  check('system map reached', true);
  await page.click('.planet-row >> nth=0');
  await page.click('aside button.btn-primary');
  await page.waitForURL(/\/planet\//, { timeout: 30000 });
  await page.waitForSelector('.explore-frame canvas', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/08-planet.png` });
  check('planet surface reached', true);

  // 6. Mobile stack
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE + '/customize', { waitUntil: 'networkidle' });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check('mobile customize has no horizontal overflow', !overflow);
  const order = await m.evaluate(() => {
    const prev = document.querySelector('.custom-preview');
    const ctrl = document.querySelector('.custom-controls');
    return prev && ctrl ? prev.getBoundingClientRect().top < ctrl.getBoundingClientRect().top : null;
  });
  check('mobile: preview stacked above controls', order === true, String(order));
  await m.screenshot({ path: `${OUT}/09-customize-mobile.png`, fullPage: true });
  await m.close();

  // 7. Guest logout warning
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
  check('settings shows keep-explorer panel for guests', (await page.textContent('body')).includes('Keep this explorer'));
  await page.click('main button:has-text("Log out")');
  await page.waitForSelector('[role=dialog]', { timeout: 5000 });
  check('guest logout asks first', (await page.textContent('[role=dialog]')).length > 10);
  await page.screenshot({ path: `${OUT}/10-guest-logout-warning.png` });
} catch (e) {
  check('flow threw', false, String(e).slice(0, 400));
  await page.screenshot({ path: `${OUT}/zz-failure.png` }).catch(() => undefined);
}
console.log('page errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
