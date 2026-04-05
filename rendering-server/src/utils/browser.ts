import puppeteer, { type Browser, type Page } from 'puppeteer';

let browser: Browser | null = null;
let activePages = 0;
const MAX_PAGES = 3;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  if (activePages >= MAX_PAGES) {
    throw new Error('Too many concurrent renders. Try again shortly.');
  }
  const b = await getBrowser();
  const page = await b.newPage();
  activePages++;
  try {
    return await fn(page);
  } finally {
    activePages--;
    await page.close().catch(() => {});
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
