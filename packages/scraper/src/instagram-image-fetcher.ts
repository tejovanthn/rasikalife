import { existsSync } from 'node:fs';
import chromium from '@sparticuz/chromium';
import { addExtra } from 'puppeteer-extra';
import puppeteerCore from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

type FetchResult =
  | { ok: true; imageBase64: string; contentType: string; altText?: string }
  | { ok: false; error: string };

const puppeteer = addExtra(puppeteerCore as Parameters<typeof addExtra>[0]);
puppeteer.use(StealthPlugin());

const MAC_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const LINUX_CHROME_PATHS = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];

function findSystemChrome(): string {
  if (process.env.LOCAL_CHROMIUM_PATH) return process.env.LOCAL_CHROMIUM_PATH;
  const candidates = process.platform === 'darwin' ? MAC_CHROME_PATHS : LINUX_CHROME_PATHS;
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error('No local Chrome found. Set LOCAL_CHROMIUM_PATH or install Chrome.');
  return found;
}

async function fetchImageData(postUrl: string): Promise<FetchResult> {
  const isLocal = !!process.env.SST_DEV;
  const executablePath = isLocal ? findSystemChrome() : await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: isLocal ? [] : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Visit homepage first so Instagram sets session cookies — arriving with zero
    // cookies triggers a bot-detection redirect on the post URL.
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await new Promise(r => setTimeout(r, 1_500));

    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30_000 });

    // Dismiss the "sign up to follow" modal that appears over public posts
    const closeBtn = await page.$('[aria-label="Close"]');
    if (closeBtn) await closeBtn.click().catch(() => {});

    await page.evaluate(() => { window.scrollBy(0, 300); });
    await new Promise(r => setTimeout(r, 2_000));

    const { imgSrc, altText } = await page.evaluate(() => {
      // Alt text selector works for logged-in sessions; falls back to first large
      // non-profile image (which is always the post image in document order).
      const img =
        document.querySelector<HTMLImageElement>('article img[alt*="Photo shared by"]') ??
        document.querySelector<HTMLImageElement>('article img[alt*="Image shared"]') ??
        Array.from(document.querySelectorAll<HTMLImageElement>('img'))
          .find(i => i.complete && i.naturalWidth > 400 && !i.alt.includes('profile picture')) ??
        null;
      if (!img) return { imgSrc: null as string | null, altText: null as string | null };
      return { imgSrc: img.currentSrc || img.src || null, altText: img.alt || null };
    });

    if (!imgSrc) throw new Error('No post image found on Instagram page');

    // Fetch inside the browser so CDN signed cookies are included
    const { base64, contentType } = await page.evaluate(async (src: string) => {
      const res = await fetch(src);
      const blob = await res.blob();
      const ct = blob.type || 'image/jpeg';
      const ab = await blob.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return { base64: btoa(binary), contentType: ct };
    }, imgSrc);

    return { ok: true, imageBase64: base64, contentType, altText: altText ?? undefined };
  } finally {
    await browser.close();
  }
}

export async function handler(event: { postUrl: string }): Promise<FetchResult> {
  try {
    return await fetchImageData(event.postUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[instagram-image-fetcher] error:', message);
    return { ok: false, error: message };
  }
}
