import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\NALINI ARUN\\.gemini\\antigravity\\brain\\a35c6780-9084-4b73-a762-442dfd329f0e';

async function testFullFlow(url, name) {
  console.log(`\n========================================`);
  console.log(`TESTING FLOW: ${url}`);
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
    console.log(`1. Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Click Instant Demo button
    console.log('2. Clicking "⚡ Instant Demo / Judge Mode"...');
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Judge Mode') || b.innerText.includes('Instant Demo'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log('Button clicked:', clicked);
    if (clicked) {
      console.log('Waiting for workspace hydration and Firestore seed...');
      await new Promise((r) => setTimeout(r, 6000));

      const appScreenshotPath = path.join(ARTIFACT_DIR, `${name}_workspace.png`);
      await page.screenshot({ path: appScreenshotPath, fullPage: true });
      console.log(`Workspace screenshot saved to: ${appScreenshotPath}`);

      const domSummary = await page.evaluate(() => {
        return {
          title: document.title,
          hasSidebar: !!document.querySelector('.sidebar') || !!document.querySelector('aside'),
          hasFloatingNav: !!document.querySelector('.floating-nav'),
          hasComposer: !!document.querySelector('textarea') || !!document.querySelector('.composer'),
          bodyTextPreview: document.body.innerText.slice(0, 500),
        };
      });

      console.log('\n--- WORKSPACE DOM INSPECTION ---');
      console.log(JSON.stringify(domSummary, null, 2));

      // Also navigate to /dashboard
      console.log('3. Clicking or navigating to Dashboard...');
      const dashBtnClicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('button, a'));
        const dBtn = links.find(el => el.innerText.includes('Dashboard') || el.innerText.includes('Patterns'));
        if (dBtn) {
          dBtn.click();
          return true;
        }
        return false;
      });

      console.log('Dashboard button clicked:', dashBtnClicked);
      await new Promise((r) => setTimeout(r, 5000));

      const dashScreenshotPath = path.join(ARTIFACT_DIR, `${name}_dashboard.png`);
      await page.screenshot({ path: dashScreenshotPath, fullPage: true });
      console.log(`Dashboard screenshot saved to: ${dashScreenshotPath}`);
    }

  } catch (err) {
    console.error('Flow failed:', err.message);
  } finally {
    console.log('\n--- RECENT CONSOLE LOGS ---');
    consoleLogs.slice(-10).forEach((l) => console.log(' ', l));

    console.log('\n--- PAGE ERRORS ---');
    if (pageErrors.length === 0) console.log('(none)');
    else pageErrors.forEach((e) => console.error('  ERROR:', e));

    await browser.close();
  }
}

async function run() {
  await testFullFlow('https://arunachalamvenkatachalapathy-dev.github.io/tendril/', 'github_pages');
}

run();
