import puppeteer from 'puppeteer';

/**
 * Capture a full-page screenshot of a URL as a PNG buffer.
 * Returns { buffer, metadata }.
 */
export async function captureScreenshot(url, opts = {}) {
  const {
    width = 1280,
    height = 800,
    fullPage = true,
    waitUntil = 'networkidle2',
    timeout = 30000,
  } = opts;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil, timeout });
    await new Promise(r => setTimeout(r, 1500));

    const title = await page.title();
    const buffer = await page.screenshot({ fullPage, type: 'png' });

    return {
      buffer,
      metadata: {
        url,
        title,
        capturedAt: new Date().toISOString(),
        viewport: { width, height },
      },
    };
  } finally {
    await browser.close();
  }
}
