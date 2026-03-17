/**
 * AGENTIC QA TESTER — Autonomous headless browser testing agent
 * Autonomously: Logs in → Explores → Extracts APIs → Tests everything → Generates report
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'https://dev.valueup.jumpiq.com';
const CREDS = { username: 'bruce', password: 'JumpUser@2024!' };
const OUT = path.resolve('artifacts/agentic-run');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const results = [];
const apis = [];
const pages = [];
let tid = 0;
const startTime = Date.now();

function test(suite, name, fn) {
  return async () => {
    tid++;
    const t0 = Date.now();
    try {
      const detail = await fn();
      const dur = Date.now() - t0;
      results.push({ id: tid, suite, name, status: 'PASS', detail: detail || '', duration: dur });
      console.log(`  ✅ [${suite}] ${name} ${detail ? '— ' + detail : ''} (${dur}ms)`);
    } catch (e) {
      const dur = Date.now() - t0;
      results.push({ id: tid, suite, name, status: 'FAIL', detail: e.message.slice(0, 200), duration: dur });
      console.log(`  ❌ [${suite}] ${name} — ${e.message.slice(0, 120)} (${dur}ms)`);
    }
  };
}

async function main() {
  console.log('\n🤖 AGENTIC QA TESTER — Headless Chromium\n');
  console.log(`Target: ${BASE}`);
  console.log(`User: ${CREDS.username}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Intercept APIs
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/api/') || u.includes('/trpc/')) {
      let body = null;
      try { body = await r.json(); } catch { body = '[non-json]'; }
      apis.push({ url: u, method: r.request().method(), status: r.status(), body: JSON.stringify(body).slice(0, 800), ts: new Date().toISOString() });
    }
  });

  // ────────────────── PHASE 1: LOGIN ──────────────────
  console.log('━━━ PHASE 1: LOGIN ━━━');

  await test('Login', 'Page loads', async () => {
    await page.goto(`${BASE}/login?callbackUrl=%2Fdashboard%2Fhome`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, '01_login.png'), fullPage: true });
    return `Title: "${await page.title()}"`;
  })();

  await test('Login', 'Form structure', async () => {
    const inputs = await page.$$eval('input', els => els.map(e => ({ type: e.type, name: e.name, id: e.id })));
    fs.writeFileSync(path.join(OUT, 'login_form.json'), JSON.stringify(inputs, null, 2));
    return `${inputs.length} inputs: ${inputs.map(i => i.type).join(', ')}`;
  })();

  await test('Login', 'Valid credentials', async () => {
    await page.locator('input[type="text"]').first().fill(CREDS.username);
    await page.locator('input[type="password"]').first().fill(CREDS.password);
    const cb = page.locator('input[type="checkbox"]');
    if (await cb.count() > 0) await cb.first().check().catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('button[type="submit"]').first().click({ force: true });
    await page.waitForURL('**/dashboard/**', { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, '02_after_login.png'), fullPage: true });
    const url = page.url();
    if (!url.includes('dashboard')) throw new Error('Not on dashboard: ' + url);
    return `Redirected to ${url}`;
  })();

  // ────────────────── PHASE 2: DASHBOARD EXPLORATION ──────────────────
  console.log('\n━━━ PHASE 2: DASHBOARD EXPLORATION ━━━');

  let navLinks = [];
  await test('Dashboard', 'DOM extraction', async () => {
    await page.waitForTimeout(2000);
    const dom = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
        text: a.textContent.trim().slice(0, 50), href: a.getAttribute('href')
      })).filter(a => a.href && !a.href.startsWith('#') && !a.href.startsWith('javascript'));
      const unique = [...new Map(links.map(l => [l.href, l])).values()];
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h => h.textContent.trim().slice(0, 60));
      const tables = document.querySelectorAll('table').length;
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 30)).filter(Boolean);
      return { links: unique, headings, tables, buttons: buttons.slice(0, 20), bodyText: document.body.innerText.slice(0, 5000) };
    });
    navLinks = dom.links;
    fs.writeFileSync(path.join(OUT, 'dashboard_dom.json'), JSON.stringify(dom, null, 2));
    return `${dom.links.length} links, ${dom.headings.length} headings, ${dom.tables} tables`;
  })();

  // ────────────────── PHASE 3: PAGE-BY-PAGE NAVIGATION ──────────────────
  console.log('\n━━━ PHASE 3: SITE NAVIGATION ━━━');

  const internal = navLinks.filter(l => l.href?.startsWith('/')).map(l => l.href);
  const uniquePaths = [...new Set(internal)].slice(0, 20);

  for (const p of uniquePaths) {
    await test('Navigation', p, async () => {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1200);
      const d = await page.evaluate(() => ({
        title: document.title, h: document.querySelectorAll('h1,h2,h3').length,
        tbl: document.querySelectorAll('table').length, inp: document.querySelectorAll('input,select,textarea').length,
      }));
      const safe = p.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
      await page.screenshot({ path: path.join(OUT, `page_${safe}.png`), fullPage: true });
      pages.push({ path: p, ...d });
      return `${d.h} headings, ${d.tbl} tables, ${d.inp} inputs`;
    })();
  }

  // ────────────────── PHASE 4: DP VIE ──────────────────
  console.log('\n━━━ PHASE 4: DP VIE ━━━');

  const dpCandidates = [...navLinks.filter(l => /dp|vie|dealer/i.test(l.href || '') || /dp|vie|dealer/i.test(l.text || '')).map(l => l.href),
    '/dp-vie', '/dashboard/dp-vie', '/dashboard/dpvie'];

  let dpFound = false;
  for (const dp of [...new Set(dpCandidates)]) {
    await test('DP VIE', `Navigate: ${dp}`, async () => {
      const url = dp.startsWith('http') ? dp : `${BASE}${dp}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      if (page.url().includes('login') || page.url().includes('404')) throw new Error('Redirected away: ' + page.url());
      dpFound = true;
      await page.screenshot({ path: path.join(OUT, 'dp_vie.png'), fullPage: true });
      return `Found at ${page.url()}`;
    })();
    if (dpFound) break;
  }

  await test('DP VIE', 'Extract dealer data', async () => {
    const data = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table')).map((t, i) => {
        const headers = Array.from(t.querySelectorAll('thead th, thead td')).map(th => th.textContent.trim());
        const rows = Array.from(t.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
        return { idx: i, headers, rows: rows.slice(0, 100), total: rows.length };
      });
      const metrics = Array.from(document.querySelectorAll('[class*="metric" i],[class*="stat" i],[class*="kpi" i]')).map(e => e.textContent.trim().slice(0, 80)).filter(Boolean);
      const charts = document.querySelectorAll('canvas,svg[class*="chart" i],[class*="recharts" i]').length;
      return { tables, metrics, charts, text: document.body.innerText.slice(0, 8000) };
    });
    fs.writeFileSync(path.join(OUT, 'dp_vie_data.json'), JSON.stringify(data, null, 2));
    let detail = `${data.tables.length} tables, ${data.charts} charts, ${data.metrics.length} metrics`;
    data.tables.forEach(t => { detail += ` | Tbl${t.idx}: [${t.headers.join(', ')}] (${t.total} rows)`; });
    return detail;
  })();

  await test('DP VIE', 'Data discrepancy check', async () => {
    const raw = fs.readFileSync(path.join(OUT, 'dp_vie_data.json'), 'utf8');
    const data = JSON.parse(raw);
    const issues = [];
    for (const t of data.tables) {
      for (let r = 0; r < t.rows.length; r++) {
        if (t.rows[r].length !== t.headers.length && t.headers.length > 0) issues.push(`Tbl${t.idx} row${r}: col mismatch (${t.rows[r].length} vs ${t.headers.length})`);
        const empty = t.rows[r].filter(c => !c || c === '-' || c === 'N/A').length;
        if (empty > t.rows[r].length * 0.5 && t.rows[r].length > 0) issues.push(`Tbl${t.idx} row${r}: >50% empty`);
      }
      const dupes = t.rows.length - new Set(t.rows.map(r => r.join('|'))).size;
      if (dupes > 0) issues.push(`Tbl${t.idx}: ${dupes} duplicate rows`);
    }
    fs.writeFileSync(path.join(OUT, 'discrepancies.json'), JSON.stringify(issues, null, 2));
    if (issues.length > 0) throw new Error(`${issues.length} issues: ${issues.slice(0, 3).join('; ')}`);
    return 'No discrepancies';
  })();

  // ────────────────── PHASE 5: API REGRESSION ──────────────────
  console.log('\n━━━ PHASE 5: API REGRESSION ━━━');

  await test('API', 'Intercepted endpoints', async () => {
    fs.writeFileSync(path.join(OUT, 'all_apis.json'), JSON.stringify(apis, null, 2));
    const unique = [...new Set(apis.map(a => `${a.method} ${new URL(a.url).pathname}`))];
    return `${apis.length} calls, ${unique.length} unique: ${unique.slice(0, 8).join(', ')}`;
  })();

  await test('API', 'No server errors (5xx)', async () => {
    const errors = apis.filter(a => a.status >= 500);
    if (errors.length > 0) throw new Error(`${errors.length} server errors: ${errors.map(e => `${e.status} ${new URL(e.url).pathname}`).join(', ')}`);
    return `All ${apis.length} responses < 500`;
  })();

  await test('API', 'Response consistency re-test', async () => {
    const cookies = await ctx.cookies();
    const ch = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const gets = [...new Map(apis.filter(a => a.method === 'GET').map(a => [a.url.split('?')[0], a])).values()].slice(0, 15);
    let ok = 0, changed = 0;
    for (const api of gets) {
      try {
        const r = await page.request.get(api.url, { headers: { Cookie: ch }, timeout: 8000 });
        r.status() === api.status ? ok++ : changed++;
      } catch { changed++; }
    }
    return `${ok}/${gets.length} consistent, ${changed} changed`;
  })();

  // ────────────────── PHASE 6: UI REGRESSION ──────────────────
  console.log('\n━━━ PHASE 6: UI REGRESSION ━━━');

  await page.goto(`${BASE}/dashboard/home`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await test('UI', 'No console errors', async () => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    fs.writeFileSync(path.join(OUT, 'console_errors.json'), JSON.stringify(errs, null, 2));
    if (errs.length > 0) throw new Error(`${errs.length} errors`);
    return 'Clean console';
  })();

  await test('UI', 'No horizontal overflow', async () => {
    const of = await page.evaluate(() => Array.from(document.querySelectorAll('*')).filter(el => el.getBoundingClientRect().right > window.innerWidth + 10).length);
    if (of > 0) throw new Error(`${of} elements overflow`);
    return '0 overflow';
  })();

  await test('UI', 'All images loaded', async () => {
    const broken = await page.evaluate(() => Array.from(document.querySelectorAll('img')).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
    if (broken.length > 0) throw new Error(`${broken.length} broken: ${broken[0]}`);
    return 'All images OK';
  })();

  await test('UI', 'Accessibility: all inputs labelled', async () => {
    const unlabelled = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input:not([type="hidden"]),select,textarea')).filter(el => {
        const id = el.id; const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder');
        return !label && !ariaLabel && !el.closest('label');
      }).length;
    });
    if (unlabelled > 0) throw new Error(`${unlabelled} unlabelled inputs`);
    return 'All inputs labelled';
  })();

  await browser.close();

  // ────────────────── GENERATE REPORT ──────────────────
  console.log('\n━━━ GENERATING REPORT ━━━\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const passRate = ((passed / total) * 100).toFixed(1);

  const summary = { total, passed, failed, passRate: passRate + '%', duration: duration + 's', apis: apis.length, pages: pages.length, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ summary, results }, null, 2));

  // Generate HTML report
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QA Agentic Test Report</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f9fafb;padding:32px}
.container{max-width:900px;margin:0 auto}.header{text-align:center;margin-bottom:32px}
h1{font-size:24px;font-weight:700;color:#111827}h2{font-size:18px;font-weight:600;margin:24px 0 12px;color:#1f2937}
.subtitle{color:#6b7280;margin-top:4px;font-size:14px}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:20px 0}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center}
.stat-num{font-size:28px;font-weight:700}.stat-label{font-size:12px;color:#6b7280;margin-top:4px}
.green{color:#059669}.red{color:#dc2626}.blue{color:#2563eb}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:16px}
th{background:#f9fafb;padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb}
td{padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:13px}
.pass{color:#059669;font-weight:600}.fail{color:#dc2626;font-weight:600}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600}
.badge-pass{background:#d1fae5;color:#065f46}.badge-fail{background:#fee2e2;color:#991b1b}
.api-row td{font-family:monospace;font-size:12px}
</style></head><body><div class="container">
<div class="header"><h1>🤖 Agentic QA Test Report</h1><p class="subtitle">ValueUp JumpIQ — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>Target: ${BASE} | User: ${CREDS.username} | Mode: Headless Chromium</p></div>
<div class="stats">
<div class="stat"><div class="stat-num green">${passed}</div><div class="stat-label">Passed</div></div>
<div class="stat"><div class="stat-num red">${failed}</div><div class="stat-label">Failed</div></div>
<div class="stat"><div class="stat-num">${total}</div><div class="stat-label">Total</div></div>
<div class="stat"><div class="stat-num ${+passRate>=80?'green':'red'}">${passRate}%</div><div class="stat-label">Pass Rate</div></div>
<div class="stat"><div class="stat-num blue">${duration}s</div><div class="stat-label">Duration</div></div>
</div>
<h2>Test Results</h2><table><tr><th>#</th><th>Suite</th><th>Test</th><th>Status</th><th>Details</th><th>Time</th></tr>
${results.map(r => `<tr><td>${r.id}</td><td>${r.suite}</td><td>${r.name}</td><td><span class="badge badge-${r.status === 'PASS' ? 'pass' : 'fail'}">${r.status}</span></td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.detail}</td><td>${r.duration}ms</td></tr>`).join('')}
</table>
<h2>Intercepted APIs (${apis.length})</h2><table><tr><th>Method</th><th>Endpoint</th><th>Status</th><th>Preview</th></tr>
${[...new Map(apis.map(a => [a.url.split('?')[0], a])).values()].slice(0, 25).map(a => {
  let p; try { p = new URL(a.url).pathname; } catch { p = a.url; }
  return `<tr class="api-row"><td>${a.method}</td><td>${p}</td><td>${a.status}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.body.slice(0,100)}</td></tr>`;
}).join('')}
</table>
<h2>Pages Explored (${pages.length})</h2><table><tr><th>Path</th><th>Title</th><th>Headings</th><th>Tables</th><th>Inputs</th></tr>
${pages.map(p => `<tr><td>${p.path}</td><td>${p.title||''}</td><td>${p.h}</td><td>${p.tbl}</td><td>${p.inp}</td></tr>`).join('')}
</table>
<p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:32px">Generated by Ankur QA Automation Suite — Agentic Tester v2.0</p>
</div></body></html>`;

  const reportPath = path.join(OUT, 'report.html');
  fs.writeFileSync(reportPath, html);

  console.log('═'.repeat(55));
  console.log('  📊 AGENTIC TEST REPORT');
  console.log('═'.repeat(55));
  console.log(`  Total:      ${total}`);
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  Pass rate:  ${passRate}%`);
  console.log(`  Duration:   ${duration}s`);
  console.log(`  APIs:       ${apis.length} intercepted`);
  console.log(`  Pages:      ${pages.length} explored`);
  console.log(`\n  📄 HTML Report: ${reportPath}`);
  console.log(`  📁 Artifacts:   ${OUT}/`);
  console.log('═'.repeat(55));
}

main().catch(e => { console.error('💥 Agent crashed:', e); process.exit(1); });
