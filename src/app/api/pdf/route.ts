import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser } from 'puppeteer-core';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;

  try {
    const { html, fileName } = await req.json();

    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const baseUrl = basePath ? `${origin}${basePath}` : origin;
    const htmlWithBase = html.replace('<head>', `<head><base href="${baseUrl}/">`);

    const isLocal = process.env.NODE_ENV === 'development';
    
    if (isLocal) {
      // In locale usa il Chrome preinstallato su Windows
      browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
    } else {
      // Su Vercel usa Browserless.io tramite WebSocket API
      const API_KEY = process.env.BROWSERLESS_API_KEY;
      if (!API_KEY) {
         throw new Error('BROWSERLESS_API_KEY non configurata nelle variabili d\'ambiente di Vercel.');
      }
      browser = await puppeteer.connect({
        browserWSEndpoint: `wss://chrome.browserless.io?token=${API_KEY}`,
      });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(htmlWithBase, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      timeout: 30000,
    });

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF Generation Error:', message);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: message },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch((e) => console.error('Browser close error:', e));
    }
  }
}
