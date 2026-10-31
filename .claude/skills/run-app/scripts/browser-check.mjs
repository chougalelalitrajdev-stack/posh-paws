// Template driver script — copy/adapt, don't run in place as-is.
// Usage: node browser-check.mjs (from a scratch dir where `npm install playwright` was run)
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4200';
const SCREENSHOT_PATH = '/tmp/pw-check/screenshot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(BASE_URL, { waitUntil: 'networkidle' });

// Example interaction — adapt the selector/text to what you're verifying.
await page.getByRole('button', { name: 'Book now' }).click();
await page.getByText('What would you like to book?').waitFor({ state: 'visible', timeout: 5000 });

await page.screenshot({ path: SCREENSHOT_PATH });

console.log('Screenshot saved to', SCREENSHOT_PATH);
console.log(consoleErrors.length ? `Console errors:\n${consoleErrors.join('\n')}` : 'No console errors.');

await browser.close();
