/**
 * PDF generation via puppeteer-core + @sparticuz/chromium.
 *
 * Strategy:
 *  - On Vercel/Lambda (process.env.VERCEL set): use @sparticuz/chromium serverless binary.
 *  - Locally on dev machine: fall back to system Chrome (Windows / macOS / Linux paths).
 *
 * Callers pass an HTML string; we return a PDF Buffer.
 */
import puppeteer, { Browser } from 'puppeteer-core';

const LOCAL_CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
];

async function getLocalChromeExecutable(): Promise<string> {
    const fs = await import('fs');
    for (const p of LOCAL_CHROME_PATHS) {
        try {
            if (fs.existsSync(p)) return p;
        } catch { /* ignore */ }
    }
    throw new Error('Chrome tidak ditemukan di system. Install Google Chrome dulu.');
}

export async function htmlToPdf(html: string): Promise<Buffer> {
    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

    let browser: Browser;
    if (isServerless) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const chromium = (await import('@sparticuz/chromium')).default;
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        });
    } else {
        browser = await puppeteer.launch({
            executablePath: await getLocalChromeExecutable(),
            headless: true,
        });
    }

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        });
        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}
