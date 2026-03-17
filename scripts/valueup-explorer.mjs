/**
 * ValueUp JumpIQ Full Site Explorer & Regression Test Runner
 * - Logs in via headless Chromium
 * - Intercepts ALL API calls
 * - Extracts DOM structure from every reachable page
 * - Navigates to DP VIE and extracts dealer data
 * - Generates full regression test results
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'https://dev.valueup.jumpiq.com';
const CREDS = { username: 'bruce', password: 'JumpUser@2024!' };
const OUT_DIR = path.resolve('artifacts/valueup-exploration');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const apiCalls = [];
const pageSnapshots = [];
const testResults = [];
let testIndex = 0;

function record(suite, name, status, details = '', duration = 0) {
  testIndex++;
  const r = { id: testIndex, suite, name, status, details, duration, timestamp: new Date().toISOString() };
  testResults.push(r);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} [${suite}] ${name} ${details ? '— ' + details : ''} (${duration}ms)`);
  return r;
}

async function run() {
  console.log('\n🚀 ValueUp JumpIQ Explorer — Headless Chromium\n');
  const startTime = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ─── Intercept ALL API calls ───────────────────────────────────────
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('/trpc/') || url.includes('graphql')) {
      let body = null;
      try { body = await response.json(); } catch { body = '[non-JSON]'; }
      apiCalls.push({
        url,
        method: response.request().method(),
        status: response.status(),
        timestamp: new Date().toISOString(),
        bodyPreview: JSON.stringify(body).slice(0, 500),
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: LOGIN
  // ═══════════════════════════════════════════════════════════════════
  console.log('📋 PHASE 1: Login\n');
  let t0 = Date.now();

  try {
    await page.goto(`${BASE}/login?callbackUrl=%2Fdashboard%2Fhome`, { waitUntil: 'networkidle', timeout: 30000 });
    record('Login', 'Login page loads', 'PASS', `Title: ${await page.title()}`, Date.now() - t0);
  } catch (e) {
    record('Login', 'Login page loads', 'FAIL', e.message, Date.now() - t0);
  }

  // Take screenshot of login page
  await page.screenshot({ path: path.join(OUT_DIR, '01_login_page.png'), fullPage: true });

  // Extract login form DOM
  t0 = Date.now();
  const loginDOM = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, required: i.required
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent.trim(), type: b.type, disabled: b.disabled
    }));
    return { inputs, buttons, formCount: document.querySelectorAll('form').length };
  });
  record('Login', 'Login form DOM extracted', 'PASS', `${loginDOM.inputs.length} inputs, ${loginDOM.buttons.length} buttons`, Date.now() - t0);

  // Fill credentials and submit
  t0 = Date.now();
  try {
    // Try common selectors for username/password
    const usernameInput = await page.$('input[name="username"], input[id="username"], input[type="text"], input[placeholder*="user" i], input[placeholder*="name" i]');
    const passwordInput = await page.$('input[name="password"], input[id="password"], input[type="password"]');

    if (usernameInput && passwordInput) {
      await usernameInput.fill(CREDS.username);
      await passwordInput.fill(CREDS.password);
      record('Login', 'Credentials filled', 'PASS', `username: ${CREDS.username}`, Date.now() - t0);

      t0 = Date.now();
      const submitBtn = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForURL('**/dashboard/**', { timeout: 20000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      }

      const postLoginUrl = page.url();
      if (postLoginUrl.includes('dashboard')) {
        record('Login', 'Login successful', 'PASS', `Redirected to: ${postLoginUrl}`, Date.now() - t0);
      } else {
        record('Login', 'Login redirect', 'WARN', `URL after login: ${postLoginUrl}`, Date.now() - t0);
      }
    } else {
      record('Login', 'Find login inputs', 'FAIL', `Username found: ${!!usernameInput}, Password found: ${!!passwordInput}`, Date.now() - t0);
    }
  } catch (e) {
    record('Login', 'Login flow', 'FAIL', e.message, Date.now() - t0);
  }

  await page.screenshot({ path: path.join(OUT_DIR, '02_after_login.png'), fullPage: true });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: DASHBOARD EXPLORATION
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📋 PHASE 2: Dashboard Exploration\n');

  t0 = Date.now();
  const dashboardDOM = await page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/dashboard"]')).map(a => ({
      text: a.textContent.trim().slice(0, 50),
      href: a.getAttribute('href'),
    })).filter(a => a.href && a.text);

    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim().slice(0, 60));
    const tables = document.querySelectorAll('table').length;
    const cards = document.querySelectorAll('[class*="card" i], [class*="Card" i]').length;
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 40)).filter(Boolean);
    const selects = Array.from(document.querySelectorAll('select, [role="combobox"], [role="listbox"]')).length;
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
      text: a.textContent.trim().slice(0, 40), href: a.getAttribute('href')
    })).filter(a => a.href && !a.href.startsWith('#') && !a.href.startsWith('javascript'));

    return {
      title: document.title,
      url: window.location.href,
      nav: [...new Map(nav.map(n => [n.href, n])).values()],
      headings,
      tables,
      cards,
      buttons: buttons.slice(0, 30),
      selects,
      allLinks: [...new Map(links.map(l => [l.href, l])).values()],
      bodyText: document.body.innerText.slice(0, 3000),
    };
  });

  record('Dashboard', 'DOM structure extracted', 'PASS',
    `${dashboardDOM.nav.length} nav links, ${dashboardDOM.headings.length} headings, ${dashboardDOM.tables} tables, ${dashboardDOM.cards} cards`,
    Date.now() - t0);

  pageSnapshots.push({ page: 'dashboard', ...dashboardDOM });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: NAVIGATE ALL SIDEBAR/NAV LINKS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📋 PHASE 3: Site-wide Navigation Exploration\n');

  const internalLinks = dashboardDOM.allLinks
    .filter(l => l.href && (l.href.startsWith('/') || l.href.includes('valueup.jumpiq.com')))
    .map(l => l.href.startsWith('/') ? l.href : new URL(l.href).pathname);

  const uniquePaths = [...new Set(internalLinks)].slice(0, 20); // Cap at 20 pages

  for (const linkPath of uniquePaths) {
    t0 = Date.now();
    try {
      await page.goto(`${BASE}${linkPath}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      const pageData = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim().slice(0, 60)),
        tables: document.querySelectorAll('table').length,
        cards: document.querySelectorAll('[class*="card" i], [class*="Card" i]').length,
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 40)).filter(Boolean).slice(0, 15),
        inputFields: document.querySelectorAll('input, select, textarea').length,
        bodyTextPreview: document.body.innerText.slice(0, 1500),
      }));

      const safeName = linkPath.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
      await page.screenshot({ path: path.join(OUT_DIR, `page_${safeName}.png`), fullPage: true });

      pageSnapshots.push({ page: linkPath, ...pageData });
      record('Navigation', `Page: ${linkPath}`, 'PASS',
        `${pageData.headings.length} headings, ${pageData.tables} tables, ${pageData.inputFields} inputs`,
        Date.now() - t0);
    } catch (e) {
      record('Navigation', `Page: ${linkPath}`, 'FAIL', e.message.slice(0, 100), Date.now() - t0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: DP VIE — DEALER PERFORMANCE VIEW
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📋 PHASE 4: DP VIE (Dealer Performance)\n');

  // Try navigating to DP VIE
  const dpViePaths = ['/dashboard/dp-vie', '/dashboard/dpvie', '/dp-vie', '/dashboard/dealer-performance'];
  let dpVieFound = false;

  // Also check if any nav link contains "dp" or "vie" or "dealer"
  const dpLinks = dashboardDOM.allLinks.filter(l =>
    l.href?.toLowerCase().includes('dp') ||
    l.href?.toLowerCase().includes('vie') ||
    l.href?.toLowerCase().includes('dealer') ||
    l.text?.toLowerCase().includes('dp') ||
    l.text?.toLowerCase().includes('vie') ||
    l.text?.toLowerCase().includes('dealer')
  );

  if (dpLinks.length > 0) {
    dpViePaths.unshift(...dpLinks.map(l => l.href.startsWith('/') ? l.href : new URL(l.href).pathname));
  }

  for (const dpPath of [...new Set(dpViePaths)]) {
    t0 = Date.now();
    try {
      await page.goto(`${BASE}${dpPath}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);

      const url = page.url();
      if (!url.includes('login') && !url.includes('404')) {
        dpVieFound = true;

        await page.screenshot({ path: path.join(OUT_DIR, 'dp_vie_main.png'), fullPage: true });

        // Extract all data from DP VIE page
        const dpData = await page.evaluate(() => {
          // Get all table data
          const tables = Array.from(document.querySelectorAll('table')).map((table, idx) => {
            const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(th => th.textContent.trim());
            const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
              Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
            );
            return { tableIndex: idx, headers, rows: rows.slice(0, 100), totalRows: rows.length };
          });

          // Get all visible text with dealer names
          const allText = document.body.innerText;
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim());

          // Get dropdowns/filters
          const selects = Array.from(document.querySelectorAll('select')).map(s => ({
            name: s.name || s.id,
            options: Array.from(s.options).map(o => o.textContent.trim()),
          }));

          // Get custom dropdowns (common in React apps)
          const customDropdowns = Array.from(document.querySelectorAll('[role="combobox"], [class*="select" i], [class*="dropdown" i], [class*="filter" i]'))
            .map(el => ({ text: el.textContent.trim().slice(0, 80), className: (el.className || '').toString().slice(0, 60) }));

          // Get all data cards/metrics
          const metrics = Array.from(document.querySelectorAll('[class*="metric" i], [class*="stat" i], [class*="kpi" i], [class*="value" i]'))
            .map(el => el.textContent.trim().slice(0, 80)).filter(Boolean);

          // Get chart elements
          const charts = document.querySelectorAll('canvas, svg[class*="chart" i], [class*="chart" i], [class*="recharts" i], [class*="apexcharts" i]').length;

          return { tables, headings, selects, customDropdowns, metrics, charts, allText: allText.slice(0, 5000) };
        });

        record('DP VIE', `DP VIE page loaded`, 'PASS',
          `${dpData.tables.length} tables, ${dpData.charts} charts, ${dpData.headings.length} headings`,
          Date.now() - t0);

        // Save dealer data
        if (dpData.tables.length > 0) {
          for (const table of dpData.tables) {
            record('DP VIE Data', `Table ${table.tableIndex}`, 'PASS',
              `${table.headers.length} columns, ${table.totalRows} rows. Headers: ${table.headers.join(', ').slice(0, 100)}`);
          }
        }

        fs.writeFileSync(path.join(OUT_DIR, 'dp_vie_data.json'), JSON.stringify(dpData, null, 2));
        break;
      }
    } catch (e) {
      record('DP VIE', `Navigate to ${dpPath}`, 'FAIL', e.message.slice(0, 100), Date.now() - t0);
    }
  }

  if (!dpVieFound) {
    record('DP VIE', 'Find DP VIE page', 'WARN', `Tried paths: ${dpViePaths.join(', ')}. Check nav links.`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: API REGRESSION TESTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📋 PHASE 5: API Regression Tests\n');

  // Get cookies for authenticated API calls
  const cookies = await context.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Test discovered API endpoints
  const uniqueApis = [...new Map(apiCalls.map(a => [a.url.split('?')[0], a])).values()];

  for (const api of uniqueApis.slice(0, 30)) {
    if (api.method !== 'GET') continue; // Only re-test GET endpoints
    t0 = Date.now();
    try {
      const resp = await page.request.get(api.url, { headers: { 'Cookie': cookieHeader } });
      const status = resp.status();
      if (status >= 200 && status < 400) {
        record('API Regression', `${api.method} ${new URL(api.url).pathname.slice(0, 60)}`, 'PASS',
          `Status: ${status}`, Date.now() - t0);
      } else {
        record('API Regression', `${api.method} ${new URL(api.url).pathname.slice(0, 60)}`, 'FAIL',
          `Status: ${status}`, Date.now() - t0);
      }
    } catch (e) {
      record('API Regression', `${api.method} ${new URL(api.url).pathname.slice(0, 60)}`, 'FAIL',
        e.message.slice(0, 80), Date.now() - t0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 6: UI REGRESSION TESTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📋 PHASE 6: UI Regression Tests\n');

  // Go back to dashboard for UI tests
  await page.goto(`${BASE}/dashboard/home`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Test: page has no console errors
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  record('UI Regression', 'Console errors on dashboard', consoleErrors.length === 0 ? 'PASS' : 'WARN',
    consoleErrors.length === 0 ? 'No errors' : `${consoleErrors.length} errors found`);

  // Test: page responsive elements
  t0 = Date.now();
  const responsiveCheck = await page.evaluate(() => {
    const overflowing = Array.from(document.querySelectorAll('*')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.right > window.innerWidth + 10;
    }).length;
    return { overflowing, viewportWidth: window.innerWidth };
  });
  record('UI Regression', 'No horizontal overflow', responsiveCheck.overflowing === 0 ? 'PASS' : 'WARN',
    `${responsiveCheck.overflowing} elements overflow at ${responsiveCheck.viewportWidth}px`, Date.now() - t0);

  // Test: all images load
  t0 = Date.now();
  const brokenImages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
  });
  record('UI Regression', 'All images load', brokenImages.length === 0 ? 'PASS' : 'FAIL',
    brokenImages.length === 0 ? 'All images OK' : `${brokenImages.length} broken: ${brokenImages.slice(0, 3).join(', ')}`, Date.now() - t0);

  // Test: no broken links (sample)
  t0 = Date.now();
  const sampleLinks = dashboardDOM.allLinks.filter(l => l.href?.startsWith('/')).slice(0, 10);
  let brokenLinkCount = 0;
  for (const link of sampleLinks) {
    try {
      const resp = await page.request.get(`${BASE}${link.href}`, { timeout: 10000 });
      if (resp.status() >= 400) brokenLinkCount++;
    } catch { brokenLinkCount++; }
  }
  record('UI Regression', 'No broken internal links', brokenLinkCount === 0 ? 'PASS' : 'FAIL',
    `${sampleLinks.length - brokenLinkCount}/${sampleLinks.length} links OK`, Date.now() - t0);

  // ═══════════════════════════════════════════════════════════════════
  // SAVE ALL RESULTS
  // ═══════════════════════════════════════════════════════════════════
  const totalDuration = Date.now() - startTime;
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const warned = testResults.filter(r => r.status === 'WARN').length;

  const summary = {
    totalTests: testResults.length,
    passed, failed, warned,
    passRate: ((passed / testResults.length) * 100).toFixed(1) + '%',
    totalDuration: totalDuration + 'ms',
    timestamp: new Date().toISOString(),
    apiCallsIntercepted: apiCalls.length,
    pagesExplored: pageSnapshots.length,
  };

  // Save everything
  fs.writeFileSync(path.join(OUT_DIR, 'test_results.json'), JSON.stringify({ summary, results: testResults }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'api_calls.json'), JSON.stringify(apiCalls, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'page_snapshots.json'), JSON.stringify(pageSnapshots, null, 2));

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 REGRESSION TEST SUMMARY`);
  console.log('═'.repeat(60));
  console.log(`  Total tests:     ${summary.totalTests}`);
  console.log(`  ✅ Passed:       ${passed}`);
  console.log(`  ❌ Failed:       ${failed}`);
  console.log(`  ⚠️  Warnings:    ${warned}`);
  console.log(`  Pass rate:       ${summary.passRate}`);
  console.log(`  Duration:        ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  APIs captured:   ${apiCalls.length}`);
  console.log(`  Pages explored:  ${pageSnapshots.length}`);
  console.log(`\n  Artifacts: ${OUT_DIR}/`);
  console.log('═'.repeat(60));

  await browser.close();
}

run().catch(console.error);
