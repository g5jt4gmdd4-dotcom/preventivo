import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(req: NextRequest) {
  try {
    const { html, fileName } = await req.json();

    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // Add base tag so /logo.png and subfolder paths resolve correctly
    const origin = new URL(req.url).origin;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const baseUrl = basePath ? `${origin}${basePath}` : origin;
    const htmlWithBase = html.replace('<head>', `<head><base href="${baseUrl}/">`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set viewport to A4 size at 96 DPI
    await page.setViewport({ width: 794, height: 1123 });
    
    // Set content and wait for images/fonts to load
    await page.setContent(htmlWithBase, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: true
    });

    await browser.close();

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
      },
    });
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF', details: error.message }, { status: 500 });
  }
}
