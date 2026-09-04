import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\NALINI ARUN\\.gemini\\antigravity\\brain\\a35c6780-9084-4b73-a762-442dfd329f0e';

async function inspect(url, name) {
  console.log(`\n========================================`);
  console.log(`INSPECTING: ${url}`);
  console.log(`========================================`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleLogs = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.toString());
  });

  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText || 'Failed'}`);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise((r) => setTimeout(r, 4000));

    const rootHtml = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        exists: !!root,
        innerHTML: root ? root.innerHTML.slice(0, 500) : null,
        innerText: root ? root.innerText.slice(0, 300) : null,
        bodyBg: window.getComputedStyle(document.body).backgroundColor,
      };
    });

    console.log('\n--- DOM ROOT STATE ---');
    console.log('Root element exists:', rootHtml.exists);
    console.log('Body background color:', rootHtml.bodyBg);
    console.log('Root innerText length:', rootHtml.innerText?.length || 0);
    console.log('Root innerText preview:', rootHtml.innerText || '(EMPTY)');
    console.log('Root innerHTML preview:', rootHtml.innerHTML || '(EMPTY)');

    const screenshotPath = path.join(ARTIFACT_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

  } catch (err) {
    console.error('Inspection failed:', err.message);
  } finally {
    console.log('\n--- BROWSER CONSOLE LOGS ---');
    if (consoleLogs.length === 0) console.log('(none)');
    else consoleLogs.forEach((l) => console.log(' ', l));

    console.log('\n--- PAGE ERRORS (EXCEPTIONS) ---');
    if (pageErrors.length === 0) console.log('(none)');
    else pageErrors.forEach((e) => console.error('  ERROR:', e));

    console.log('\n--- FAILED NETWORK REQUESTS ---');
    if (failedRequests.length === 0) console.log('(none)');
    else failedRequests.forEach((r) => console.warn('  FAILED:', r));

    await browser.close();
  }
}

async function run() {
  await inspect('https://arunachalamvenkatachalapathy-dev.github.io/tendril/', 'github_pages_live');
  await inspect('https://tendril-74291.web.app/', 'firebase_hosting_live');
}

run();
