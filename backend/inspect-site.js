import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\NALINI ARUN\\.gemini\\antigravity\\brain\\a35c6780-9084-4b73-a762-442dfd329f0e';

async function testSite(url, name) {
  console.log(`\n========================================`);
  console.log(`INSPECTING LIVE URL: ${url}`);
  console.log(`========================================`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', (msg) => consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(err.toString()));

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Click Instant Demo button if on login page
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Judge Mode') || b.innerText.includes('Instant Demo'));
      if (btn) btn.click();
    });

    console.log('Waiting for workspace hydration...');
    await new Promise((r) => setTimeout(r, 4000));

    const screenshotPath = path.join(ARTIFACT_DIR, `${name}_canvas.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Canvas screenshot saved to: ${screenshotPath}`);

    const domInfo = await page.evaluate(() => {
      return {
        title: document.title,
        bodyPreview: document.body.innerText.slice(0, 300),
        hasVoiceToggle: !!document.querySelector('button[title*="Voice replies"]'),
        hasMicButton: !!document.querySelector('button[title*="voice"]'),
        hasNotice: !!document.querySelector('.composer-canvas div[style*="7dd3fc"]'),
      };
    });

    console.log('DOM info:', JSON.stringify(domInfo, null, 2));

  } catch (err) {
    console.error('Inspection failed:', err.message);
  } finally {
    console.log('\n--- CONSOLE LOGS ---');
    consoleLogs.slice(-8).forEach((l) => console.log(' ', l));

    console.log('\n--- PAGE ERRORS ---');
    if (pageErrors.length === 0) console.log('(none)');
    else pageErrors.forEach((e) => console.error('  ERROR:', e));

    await browser.close();
  }
}

async function run() {
  await testSite('https://tendril-74291.web.app/', 'firebase_unified');
  await testSite('https://arunachalamvenkatachalapathy-dev.github.io/tendril/', 'github_unified');
}

run();
