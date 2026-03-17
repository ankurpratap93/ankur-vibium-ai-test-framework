/**
 * 🤖 Agentic QA Test Runner — ValueUp JumpIQ
 * Autonomous headless Chromium agent that:
 *   1. Logs in
 *   2. Discovers all navigation routes
 *   3. Intercepts every API call
 *   4. Explores each page and extracts DOM
 *   5. Finds DP VIE and extracts dealer data
 *   6. Runs regression checks (data discrepancies, broken links, UI issues)
 *   7. Generates JSON + HTML report
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// ═══ CONFIG ═══
const BASE = 'https://dev.valueup.jumpiq.com';
const CREDS = { username: 'bruce', password: 'JumpUser@2024!' };
const OUT = path.resolve('artifacts/reports');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const SHOTS = path.resolve('artifacts/screenshots/agent');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

// ═══ STATE ═══
const results = [];
const apis = [];
const pages = [];
let tid = 0;
const ts = () => new Date().toISOString();
const t0map = {};
const tick = (id) => { t0map[id] = Date.now(); };
const tock = (id) => Date.now() - (t0map[id] || Date.now());

function test(suite, name, status, detail = '', dur = 0) {
  tid++;
  const icon = { PASS: '✅', FAIL: '❌', WARN: '⚠️', SKIP: '⏭️' }[status] || '❓';
  console.log(`  ${icon} [${suite}] ${name}${detail ? ' — ' + detail : ''} (${dur}ms)`);
  results.push({ id: tid, suite, name, status, detail, duration: dur, ts: ts() });
}

// ═══ MAIN ═══
async function main() {
  console.log('\n🤖 ValueUp Agentic QA Runner');
  console.log('═'.repeat(50));
  console.log(`  Target:  ${BASE}`);
  console.log(`  User:    ${CREDS.username}`);
  console.log(`  Mode:    Headless Chromium`);
  console.log('═'.repeat(50) + '\n');

  const runStart = Date.now();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ── API interceptor ──
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/api/') || u.includes('/trpc/') || u.includes('graphql') || u.includes('_next/data')) {
      let body = null;
      try { body = await r.json(); } catch { body = '[non-JSON]'; }
      apis.push({ url: u, method: r.request().method(), status: r.status(), size: JSON.stringify(body).length, ts: ts() });
    }
  });

  // ═══════════════════════════════════════════════
  // PHASE 1: LOGIN
  // ═══════════════════════════════════════════════
  console.log('📋 Phase 1: Login\n');
  tick('login-page');
  await page.goto(`${BASE}/login?callbackUrl=%2Fdashboard%2Fhome`, { waitUntil: 'networkidle', timeout: 30000 });
  test('Login', 'Login page loads', 'PASS', await page.title(), tock('login-page'));
  await page.screenshot({ path: path.join(SHOTS, '01_login.png'), fullPage: true });

  // Fill form
  tick('login-fill');
  const userEl = page.locator('input[type="text"]').first();
  const passEl = page.locator('input[type="password"]').first();
  await userEl.fill(CREDS.username);
  await passEl.fill(CREDS.password);
  const chk = page.locator('input[type="checkbox"]').first();
  if (await chk.count() > 0) await chk.check().catch(() => {});
  test('Login', 'Credentials filled', 'PASS', '', tock('login-fill'));

  tick('login-submit');
  await page.waitForTimeout(800);
  const btn = page.locator('button[type="submit"]').first();
  await btn.click({ force: true });
  await page.waitForURL('**/dashboard/**', { timeout: 25000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  const postUrl = page.url();
  test('Login', 'Login submit', postUrl.includes('dashboard') ? 'PASS' : 'FAIL', postUrl, tock('login-submit'));
  await page.screenshot({ path: path.join(SHOTS, '02_dashboard.png'), fullPage: true });

  // ═══════════════════════════════════════════════
  // PHASE 2: AUTONOMOUS DISCOVERY
  // ═══════════════════════════════════════════════
  console.log('\n📋 Phase 2: Autonomous Site Discovery\n');
  tick('discover');
  const navData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent?.trim().slice(0, 60) || '', href: a.getAttribute('href') || '' }))
      .filter(l => l.href && !l.href.startsWith('#') && !l.href.startsWith('javascript') && !l.href.startsWith('mailto'));
    const unique = [...new Map(links.map(l => [l.href, l])).values()];
    const sidebar = Array.from(document.querySelectorAll('nav *, aside *, [class*="sidebar" i] *, [class*="menu" i] *'))
      .filter(el => el.tagName === 'A' && el.getAttribute('href'))
      .map(a => ({ text: a.textContent?.trim().slice(0, 60) || '', href: a.getAttribute('href') || '' }));
    return { all: unique, sidebar: [...new Map(sidebar.map(s => [s.href, s])).values()], bodyText: document.body.innerText.slice(0, 5000) };
  });
  test('Discovery', 'Links extracted', 'PASS', `${navData.all.length} total, ${navData.sidebar.length} sidebar`, tock('discover'));

  console.log('    Sidebar routes:');
  navData.sidebar.forEach(s => console.log(`      ${s.text} → ${s.href}`));

  // ═══════════════════════════════════════════════
  // PHASE 3: EXPLORE EACH PAGE
  // ═══════════════════════════════════════════════
  console.log('\n📋 Phase 3: Page-by-Page Exploration\n');
  const internal = navData.all
    .map(l => l.href.startsWith('/') ? l.href : (l.href.includes(BASE) ? new URL(l.href).pathname : null))
    .filter(Boolean);
  const uniquePaths = [...new Set(internal)].filter(p => !p.includes('logout') && !p.includes('_next')).slice(0, 30);

  for (const pth of uniquePaths) {
    tick('page-' + pth);
    try {
      await page.goto(`${BASE}${pth}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);
      const pd = await page.evaluate(() => ({
        title: document.title, url: location.href,
        h: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent?.trim().slice(0, 60)),
        tables: document.querySelectorAll('table').length,
        cards: document.querySelectorAll('[class*="card" i]').length,
        inputs: document.querySelectorAll('input,select,textarea').length,
        charts: document.querySelectorAll('canvas,[class*="chart" i],[class*="recharts" i]').length,
        btns: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().slice(0, 30)).filter(Boolean).slice(0, 10),
      }));
      const slug = pth.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
      await page.screenshot({ path: path.join(SHOTS, `page_${slug}.png`), fullPage: true });
      pages.push({ path: pth, ...pd });
      test('Pages', pth, 'PASS', `${pd.tables}T ${pd.charts}C ${pd.cards}K ${pd.inputs}I`, tock('page-' + pth));
    } catch (e) {
      test('Pages', pth, 'FAIL', e.message.slice(0, 80), tock('page-' + pth));
    }
  }

  // ═══════════════════════════════════════════════
  // PHASE 4: DP VIE — DEALER DATA
  // ═══════════════════════════════════════════════
  console.log('\n📋 Phase 4: DP VIE Dealer Performance\n');

  // Find DP VIE link from discovered routes
  const dpCandidates = [
    ...navData.all.filter(l => /dp|vie|dealer/i.test(l.href + l.text)).map(l => l.href),
    '/dp-vie', '/dashboard/dp-vie', '/dashboard/dpvie'
  ];
  let dpFound = false;

  for (const dp of [...new Set(dpCandidates)]) {
    tick('dpvie');
    try {
      const url = dp.startsWith('http') ? dp : `${BASE}${dp}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2500);
      if (!page.url().includes('login') && !page.url().includes('404')) {
        dpFound = true;
        test('DP VIE', 'Page loaded', 'PASS', page.url(), tock('dpvie'));
        await page.screenshot({ path: path.join(SHOTS, 'dpvie_main.png'), fullPage: true });

        // Extract ALL table data
        tick('dpvie-data');
        const dpData = await page.evaluate(() => {
          const tables = Array.from(document.querySelectorAll('table')).map((t, i) => {
            const hdr = Array.from(t.querySelectorAll('thead th, thead td')).map(h => h.textContent?.trim());
            const rows = Array.from(t.querySelectorAll('tbody tr')).map(tr =>
              Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim())
            );
            return { idx: i, headers: hdr, rows, count: rows.length };
          });
          const metrics = Array.from(document.querySelectorAll('[class*="metric" i],[class*="stat" i],[class*="kpi" i],[class*="value" i]'))
            .map(el => el.textContent?.trim().slice(0, 80)).filter(Boolean);
          const charts = document.querySelectorAll('canvas,[class*="chart" i],[class*="recharts" i]').length;
          const filters = Array.from(document.querySelectorAll('select,[role="combobox"],[class*="filter" i],[class*="select" i]'))
            .map(el => el.textContent?.trim().slice(0, 60));
          return { tables, metrics, charts, filters, body: document.body.innerText.slice(0, 10000) };
        });
        test('DP VIE', 'Data extracted', 'PASS', `${dpData.tables.length} tables, ${dpData.charts} charts, ${dpData.metrics.length} metrics`, tock('dpvie-data'));

        // Data discrepancy checks
        let discrepancies = 0;
        for (const tbl of dpData.tables) {
          test('DP VIE', `Table ${tbl.idx}: ${tbl.headers.join(', ').slice(0, 80)}`, 'PASS', `${tbl.count} rows, ${tbl.headers.length} cols`);
          // Check column count consistency
          for (let r = 0; r < tbl.rows.length; r++) {
            if (tbl.headers.length > 0 && tbl.rows[r].length !== tbl.headers.length) {
              discrepancies++;
              test('Data Check', `Table ${tbl.idx} Row ${r}: col mismatch`, 'WARN', `${tbl.rows[r].length} cols vs ${tbl.headers.length} headers`);
            }
          }
          // Check for empty rows
          const emptyRows = tbl.rows.filter(r => r.every(c => !c || c === '-' || c === 'N/A'));
          if (emptyRows.length > 0) {
            discrepancies++;
            test('Data Check', `Table ${tbl.idx}: empty rows`, 'WARN', `${emptyRows.length} fully empty rows`);
          }
          // Check duplicates
          const strs = tbl.rows.map(r => r.join('|'));
          const dupes = strs.length - new Set(strs).size;
          if (dupes > 0) {
            discrepancies++;
            test('Data Check', `Table ${tbl.idx}: duplicates`, 'WARN', `${dupes} duplicate rows`);
          }
        }
        if (discrepancies === 0) test('Data Check', 'No discrepancies', 'PASS', 'All dealer data consistent');

        fs.writeFileSync(path.join(OUT, 'dpvie_dealer_data.json'), JSON.stringify(dpData, null, 2));
        break;
      }
    } catch (e) {
      test('DP VIE', dp, 'FAIL', e.message.slice(0, 80), tock('dpvie'));
    }
  }
  if (!dpFound) test('DP VIE', 'Find page', 'WARN', 'Could not locate DP VIE page');

  // ═══════════════════════════════════════════════
  // PHASE 5: API REGRESSION
  // ═══════════════════════════════════════════════
  console.log('\n📋 Phase 5: API Regression\n');
  test('API', 'Total intercepted', 'PASS', `${apis.length} calls captured`);

  const uniqueEndpoints = [...new Map(apis.map(a => [`${a.method} ${new URL(a.url).pathname}`, a])).values()];
  console.log(`    Unique endpoints: ${uniqueEndpoints.length}`);
  uniqueEndpoints.forEach(a => {
    const p = new URL(a.url).pathname;
    test('API', `${a.method} ${p.slice(0, 60)}`, a.status < 400 ? 'PASS' : 'FAIL', `Status ${a.status}, ${(a.size/1024).toFixed(1)}KB`);
  });

  const errorApis = apis.filter(a => a.status >= 400);
  test('API', 'Error rate', errorApis.length === 0 ? 'PASS' : 'WARN', `${errorApis.length}/${apis.length} errors (${((1 - errorApis.length/Math.max(apis.length,1))*100).toFixed(1)}% success)`);

  // Re-test GETs for consistency
  const cookies = await ctx.cookies();
  const cookieH = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const getApis = uniqueEndpoints.filter(a => a.method === 'GET').slice(0, 15);
  let consistent = 0;
  for (const api of getApis) {
    try {
      const r = await page.request.get(api.url, { headers: { Cookie: cookieH }, timeout: 8000 });
      if (r.status() === api.status) consistent++;
      else test('API Retest', new URL(api.url).pathname.slice(0, 50), 'WARN', `Was ${api.status}, now ${r.status()}`);
    } catch {}
  }
  test('API Retest', 'Consistency', consistent === getApis.length ? 'PASS' : 'WARN', `${consistent}/${getApis.length} stable`);

  // ═══════════════════════════════════════════════
  // PHASE 6: UI REGRESSION
  // ═══════════════════════════════════════════════
  console.log('\n📋 Phase 6: UI Regression\n');
  await page.goto(`${BASE}/dashboard/home`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Console errors
  const consoleErrs = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(3000);
  test('UI', 'Console errors', consoleErrs.length === 0 ? 'PASS' : 'WARN', `${consoleErrs.length} errors`);

  // Overflow
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*')).filter(el => el.getBoundingClientRect().right > window.innerWidth + 10).length
  );
  test('UI', 'No horizontal overflow', overflow === 0 ? 'PASS' : 'FAIL', `${overflow} elements overflow`);

  // Broken images
  const broken = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)
  );
  test('UI', 'Images loaded', broken.length === 0 ? 'PASS' : 'FAIL', `${broken.length} broken`);

  // Broken internal links
  const checkLinks = navData.all.filter(l => l.href.startsWith('/')).slice(0, 15);
  let brokenLinks = 0;
  for (const l of checkLinks) {
    try {
      const r = await page.request.get(`${BASE}${l.href}`, { timeout: 8000 });
      if (r.status() >= 400) brokenLinks++;
    } catch { brokenLinks++; }
  }
  test('UI', 'Internal links', brokenLinks === 0 ? 'PASS' : 'FAIL', `${checkLinks.length - brokenLinks}/${checkLinks.length} OK`);

  // ═══════════════════════════════════════════════
  // GENERATE REPORT
  // ═══════════════════════════════════════════════
  const dur = Date.now() - runStart;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const summary = { total: results.length, passed, failed, warned, passRate: ((passed/results.length)*100).toFixed(1)+'%', duration: dur, apis: apis.length, pages: pages.length, ts: ts() };

  // Save JSON
  fs.writeFileSync(path.join(OUT, 'agent_run.json'), JSON.stringify({ summary, results, apis, pages }, null, 2));

  // Save HTML report
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>QA Agent Report</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#f9fafb;color:#111;padding:40px}
.container{max-width:900px;margin:0 auto}.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden}
.card-h{padding:14px 20px;border-bottom:1px solid #e5e7eb;font-weight:600;font-size:15px;background:#f9fafb}
.row{padding:10px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;font-size:13px}
.row:last-child{border-bottom:none}.dot{width:8px;height:8px;border-radius:50%;margin-right:10px;flex-shrink:0}
.pass{background:#10b981}.fail{background:#ef4444}.warn{background:#f59e0b}
.badge{padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600;display:inline-block}
.badge-pass{background:#d1fae5;color:#065f46}.badge-fail{background:#fee2e2;color:#991b1b}.badge-warn{background:#fef3c7;color:#92400e}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.stat{text-align:center;padding:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px}
.stat b{font-size:28px;display:block}.stat span{font-size:12px;color:#6b7280}
h1{font-size:24px;margin-bottom:4px}p.sub{color:#6b7280;margin-bottom:24px;font-size:14px}
.flex{display:flex;justify-content:space-between;align-items:center}.mono{font-family:monospace;font-size:12px;color:#6b7280}
</style></head><body><div class="container">
<h1>🤖 ValueUp QA Agent Report</h1>
<p class="sub">Target: ${BASE} | User: ${CREDS.username} | ${new Date().toLocaleString()}</p>
<div class="stats">
<div class="stat"><b style="color:#10b981">${passed}</b><span>Passed</span></div>
<div class="stat"><b style="color:#ef4444">${failed}</b><span>Failed</span></div>
<div class="stat"><b style="color:#f59e0b">${warned}</b><span>Warnings</span></div>
<div class="stat"><b>${summary.passRate}</b><span>Pass Rate</span></div>
<div class="stat"><b style="font-size:20px">${(dur/1000).toFixed(1)}s</b><span>Duration</span></div>
</div>
<div class="stats" style="grid-template-columns:repeat(3,1fr)">
<div class="stat"><b>${results.length}</b><span>Tests Run</span></div>
<div class="stat"><b>${apis.length}</b><span>APIs Captured</span></div>
<div class="stat"><b>${pages.length}</b><span>Pages Explored</span></div>
</div>
${[...new Set(results.map(r=>r.suite))].map(suite => {
  const sr = results.filter(r=>r.suite===suite);
  const sp = sr.filter(r=>r.status==='PASS').length;
  return `<div class="card"><div class="card-h flex"><span>${suite}</span><span class="badge ${sp===sr.length?'badge-pass':'badge-warn'}">${sp}/${sr.length}</span></div>
${sr.map(r=>`<div class="row"><div class="dot ${r.status.toLowerCase()}"></div><div style="flex:1">${r.name}</div><div class="mono" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.detail}</div><span class="badge badge-${r.status.toLowerCase()}" style="margin-left:12px">${r.status}</span><span class="mono" style="margin-left:8px;min-width:50px;text-align:right">${r.duration}ms</span></div>`).join('')}</div>`;
}).join('')}
<div class="card"><div class="card-h">Intercepted APIs (${uniqueEndpoints.length} unique)</div>
${uniqueEndpoints.slice(0,25).map(a=>{const p=new URL(a.url).pathname;return `<div class="row"><span class="badge" style="background:${a.method==='GET'?'#dbeafe':'#d1fae5'};color:${a.method==='GET'?'#1e40af':'#065f46'};margin-right:8px">${a.method}</span><span class="mono" style="flex:1">${p}</span><span class="badge ${a.status<400?'badge-pass':'badge-fail'}">${a.status}</span></div>`;}).join('')}
</div></div></body></html>`;

  fs.writeFileSync(path.join(OUT, 'agent_report.html'), html);

  // ═══ SUMMARY ═══
  console.log('\n' + '═'.repeat(50));
  console.log('📊 AGENT RUN COMPLETE');
  console.log('═'.repeat(50));
  console.log(`  Tests:      ${passed}✅  ${failed}❌  ${warned}⚠️   (${summary.passRate})`);
  console.log(`  APIs:       ${apis.length} captured, ${uniqueEndpoints.length} unique`);
  console.log(`  Pages:      ${pages.length} explored`);
  console.log(`  Duration:   ${(dur/1000).toFixed(1)}s`);
  console.log(`  Report:     ${OUT}/agent_report.html`);
  console.log(`  Data:       ${OUT}/agent_run.json`);
  console.log(`  Screenshots: ${SHOTS}/`);
  console.log('═'.repeat(50) + '\n');

  await browser.close();
}

main().catch(e => { console.error('💥 Agent crashed:', e.message); process.exit(1); });
