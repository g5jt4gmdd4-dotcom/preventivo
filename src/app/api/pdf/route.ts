import { NextRequest, NextResponse } from 'next/server';

// Workaround per Vercel Node 20: Sparticuz ha bisogno di sapere il runtime per caricare i binari corretti (inclusa libnss3.so)
if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
  process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x';
}

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Su Vercel la funzione può impiegare 20-40s (avvio Chromium + rendering). Serve maxDuration alto.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { html, fileName } = await req.json();

    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // Base tag per risolvere /logo.png e percorsi in sottocartella
    const origin = new URL(req.url).origin;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const baseUrl = basePath ? `${origin}${basePath}` : origin;
    const htmlWithBase = html.replace('<head>', `<head><base href="${baseUrl}/">`);

    const isLocal = process.env.NODE_ENV === 'development';
    let executablePath: string;
    
    if (isLocal) {
      // Eseguibile Chrome predefinito su Windows
      executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else {
      executablePath = await chromium.executablePath();
    }

    browser = await puppeteer.launch({
      args: isLocal 
        ? ['--no-sandbox', '--disable-setuid-sandbox'] 
        : [...chromium.args, '--disable-gpu', '--single-process', '--no-zygote', '--disable-dev-shm-usage'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: isLocal ? true : chromium.headless,
    } as any);

    const page = await browser.newPage();

    // Viewport A4 @ 96 DPI
    await page.setViewport({ width: 794, height: 1123 });

    // 'load' è più veloce di networkidle0 e di solito basta per immagini/font; timeout evita blocchi
    await page.setContent(htmlWithBase, {
      waitUntil: 'load',
      timeout: 20000,
    });

    // Breve attesa per eventuali immagini lazy
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
