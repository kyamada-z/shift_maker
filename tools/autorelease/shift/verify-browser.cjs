'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const helperDir = __dirname;
const [sourcePath, baselinePath, outputPath, vendorPath, cssPath, playwrightPath, chromiumPath] = process.argv.slice(2);
assert.ok(sourcePath && baselinePath && outputPath && vendorPath && cssPath && playwrightPath && chromiumPath, 'Usage: node verify-browser.cjs SOURCE_HTML BASELINE_HTML OUT_DIR VENDOR_DIR CSS_FILE PLAYWRIGHT_MODULE CHROMIUM_EXECUTABLE');
const dir = path.resolve(outputPath); fs.mkdirSync(dir, { recursive: true });
const vendorDir = path.resolve(vendorPath);
const { chromium } = require(path.resolve(playwrightPath));
const source = fs.readFileSync(path.resolve(sourcePath), 'utf8');
const previous = fs.readFileSync(path.resolve(baselinePath), 'utf8');
assert.equal((source.match(/const apiKey = "";/g) || []).length, 1);
assert.ok(source.includes('gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}'));
const css = fs.readFileSync(path.resolve(cssPath), 'utf8');
assert.equal(crypto.createHash('sha256').update(css).digest('hex'), '41c480e8f9b70f50da54ce464b8300aa7fd22dc6f32ede389850044225de89e0');
const result = { passed: false, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), realAiCalls: 0, unexpectedOutbound: [], pageErrors: [], consoleErrors: [], expectedFailureConsole: [], cases: [], layouts: [], requests: 0, workerRequests: 0, mockAiCalls: 0, stylingFixture: { sourceUrl: 'https://kyamada-z.github.io/shift_maker/', bytes: Buffer.byteLength(css), sha256: '41c480e8f9b70f50da54ce464b8300aa7fd22dc6f32ede389850044225de89e0', kind: 'existing production initial DOM Tailwind style; no blocked endpoint access', fontCss: 'empty fixture; no font/network availability claim', dynamicResultStylingVerified: false } };
function pdfVersion(html) {
  const found = [...html.matchAll(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/(4\.\d+\.\d+)\/pdf(?:\.worker)?\.min\.mjs/g)];
  assert.equal(found.length, 2); assert.equal(found[0][1], found[1][1]); return found[0][1];
}
const candidateVersion = pdfVersion(source), baselineVersion = pdfVersion(previous);
let browser, server, base, stage = 'success', failedImage;
async function waitIdle(page) { await page.locator('#start-btn:not(.hidden)').waitFor(); await page.locator('#loading-spinner').waitFor({ state: 'hidden' }); }
async function run() {
  server = http.createServer((req, res) => {
    let html = req.url === '/baseline' ? previous : source;
    if (req.url === '/configured' || req.url === '/baseline') html = html.replace('const apiKey = "";', 'const apiKey = "synthetic-fixture-not-a-real-key";');
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url()); result.requests++;
    if (u.origin === base) return route.continue();
    const assets = { 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js': ['jszip.min.js', 'text/javascript'] };
    for (const version of new Set([candidateVersion, baselineVersion])) {
      for (const filename of ['pdf.min.mjs', 'pdf.worker.min.mjs']) assets[`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/${filename}`] = [`pdfjs/${version}/${filename}`, 'text/javascript'];
    }
    if (assets[u.href]) { const [name, type] = assets[u.href]; if (name.endsWith('pdf.worker.min.mjs')) result.workerRequests++; return route.fulfill({ status: 200, contentType: type, headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(vendorDir, name)) }); }
    if (u.href === 'https://cdn.tailwindcss.com/') return route.fulfill({ status: 200, contentType: 'text/javascript', body: 'const s=document.createElement("style");s.textContent=' + JSON.stringify(css) + ';document.head.append(s);' });
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.hostname === 'generativelanguage.googleapis.com') {
      result.mockAiCalls++;
      assert.equal(u.searchParams.get('key'), 'synthetic-fixture-not-a-real-key');
      const payload = req.postDataJSON(), image = payload.contents[0].parts[1].inlineData.data;
      if (stage === 'partial' && !failedImage) failedImage = image;
      if (stage === 'failure' || (stage === 'partial' && image === failedImage)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"synthetic failure"}}' });
      const data = { period: '2026年10月', client: '架空派遣先', workplace: '合成検証施設', staff_name: '架空職員', staff_no: 'TEST', daily_records: Array.from({ length: 5 }, (_, i) => ({ date: String(i + 1), day: '月', category: '勤務', start_time: '09:00', end_time: '18:00', break_time: '01:00' })) };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }) });
    }
    result.unexpectedOutbound.push({ origin: u.origin, path: u.pathname }); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => result.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') (stage === 'success' ? result.consoleErrors : result.expectedFailureConsole).push(m.text()); });
  for (const route of ['/baseline', '/empty']) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 960 }); await page.goto(base + route, { waitUntil: 'networkidle' });
      const layout = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, background: getComputedStyle(document.body).backgroundColor, titleFontSize: getComputedStyle(document.querySelector('h1')).fontSize }));
      assert.equal(layout.scrollWidth, width); assert.equal(layout.background, 'rgb(249, 250, 251)'); assert.equal(layout.titleFontSize, '30px');
      result.layouts.push({ route, ...layout });
      if (route === '/empty') await page.screenshot({ path: path.join(dir, width === 390 ? 'mobile-config-needed.png' : 'desktop-config-needed.png') });
    }
  }
  assert.match(await page.locator('#status-text').innerText(), /接続設定が未完了/); assert.equal(await page.locator('#start-btn').isDisabled(), true);
  await page.locator('#pdf-input').setInputFiles(path.join(helperDir, 'synthetic-two-page.pdf')); assert.equal(await page.locator('#start-btn').isDisabled(), true); assert.equal(result.mockAiCalls, 0);
  result.cases.push({ case: 'empty-key visibly blocked before/after upload', passed: true, aiCalls: 0 });
  await page.setViewportSize({ width: 1280, height: 960 }); await page.goto(base + '/configured', { waitUntil: 'networkidle' });
  await page.locator('#pdf-input').setInputFiles(path.join(helperDir, 'synthetic-two-page.pdf')); assert.equal(await page.locator('#start-btn').isEnabled(), true);
  await page.locator('#start-btn').click(); await page.locator('#status-text').filter({ hasText: /^解析完了$/ }).waitFor({ timeout: 30000 }); await waitIdle(page);
  assert.equal(await page.locator('#results-list table').count(), 2); assert.equal(await page.locator('#results-list tbody tr').count(), 10); assert.equal(await page.locator('#progress-percent').innerText(), '100%');
  const downloadWait = page.waitForEvent('download'); await page.locator('#download-zip-btn').click(); const download = await downloadWait; await download.saveAs(path.join(dir, 'all-pages.zip'));
  const JSZip = require(path.join(vendorDir, 'jszip.min.js')); const zip = await JSZip.loadAsync(fs.readFileSync(path.join(dir, 'all-pages.zip'))); const files = Object.values(zip.files).filter(f => !f.dir);
  assert.equal(files.length, 2); assert.ok(files.some(f => /_PAGE_2\.csv$/.test(f.name))); for (const file of files) { const content = await file.async('nodebuffer'); assert.equal(content.subarray(0, 3).toString('hex'), 'efbbbf'); assert.match(content.toString('utf8'), /対象期間/); assert.match(content.toString('utf8'), /09:00/); }
  result.cases.push({ case: 'all-page PDF worker, successful tables and BOM CSV ZIP', passed: true, pages: 2, rows: 10, zipEntries: files.length });
  await page.locator('#analysis-mode').selectOption('select'); await page.locator('#page-range').fill('1-2, 2'); let before = result.mockAiCalls;
  await page.locator('#start-btn').click(); await page.locator('#status-text').filter({ hasText: /^解析完了$/ }).waitFor({ timeout: 30000 }); await waitIdle(page); assert.equal(result.mockAiCalls - before, 2); assert.equal(await page.locator('#results-list table').count(), 2);
  result.cases.push({ case: 'inclusive range plus duplicate page deduplication', passed: true, input: '1-2, 2', aiCalls: 2 });
  for (const value of ['', '0', '3', '2-1', '1,', '1x', '1-3', '999999999999999999', '1,,2']) {
    before = result.mockAiCalls; await page.locator('#page-range').fill(value); await page.locator('#start-btn').click(); await page.locator('#status-text').filter({ hasText: /ページ番号は/ }).waitFor({ timeout: 10000 }); await waitIdle(page);
    assert.equal(result.mockAiCalls, before); assert.equal(await page.locator('#progress-percent').innerText(), '0%'); assert.equal(await page.locator('#results-list table').count(), 0);
    result.cases.push({ case: 'invalid/range out-of-bounds rejected before AI', input: value, passed: true, aiCalls: 0 });
  }
  stage = 'partial'; failedImage = undefined; await page.locator('#analysis-mode').selectOption('all'); await page.locator('#start-btn').click(); await page.locator('#status-text').filter({ hasText: /解析できなかったページ/ }).waitFor({ timeout: 30000 }); await waitIdle(page);
  assert.match(await page.locator('#status-text').innerText(), /成功 1 \/ 2 ページ/); assert.equal(await page.locator('#progress-percent').innerText(), '50%'); assert.equal(await page.locator('#results-list table').count(), 1); assert.equal(await page.locator('#download-zip-btn').isVisible(), true);
  result.cases.push({ case: 'one failed page reports partial success and 50%', passed: true });
  stage = 'failure'; await page.locator('#analysis-mode').selectOption('select'); await page.locator('#page-range').fill('2'); await page.locator('#start-btn').click(); await page.locator('#status-text').filter({ hasText: /解析できなかったページ/ }).waitFor({ timeout: 30000 }); await waitIdle(page);
  assert.match(await page.locator('#status-text').innerText(), /成功 0 \/ 1 ページ/); assert.equal(await page.locator('#progress-percent').innerText(), '0%'); assert.equal(await page.locator('#results-list table').count(), 0); assert.equal(await page.locator('#download-zip-btn').isVisible(), false);
  result.cases.push({ case: 'all failed pages show failure, 0%, no empty ZIP', passed: true });
  stage = 'success'; before = result.mockAiCalls; await page.locator('#pdf-input').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') }); await page.locator('#start-btn').click(); await page.locator('#status-text').filter({ hasText: /PDFを開けませんでした/ }).waitFor({ timeout: 10000 }); await waitIdle(page); assert.equal(result.mockAiCalls, before); assert.equal(await page.locator('#progress-percent').innerText(), '0%');
  result.cases.push({ case: 'malformed PDF shows user-visible error without AI', passed: true, aiCalls: 0 });
  assert.ok(result.workerRequests > 0); assert.deepEqual(result.unexpectedOutbound, []); assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.consoleErrors, []); result.passed = true;
}
run().catch(e => { result.failure = e.stack; process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) await new Promise(r => server.close(r)); fs.writeFileSync(path.join(dir, 'browser-result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result)); });
