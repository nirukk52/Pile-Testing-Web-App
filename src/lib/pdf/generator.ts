/**
 * Serverless PDF Generator
 * Why: Uses Browserless.io in production for reliable PDF generation.
 * Browserless handles Chrome hosting, avoiding Vercel's serverless limitations.
 * Falls back to local Chrome for development.
 */

import puppeteer, { type Browser, type Page } from 'puppeteer-core';

/**
 * Check if Browserless is configured.
 * Why: Use Browserless in production, local Chrome for development.
 */
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const BROWSERLESS_ENDPOINT = `wss://production-sfo.browserless.io?token=${BROWSERLESS_API_KEY}`;

/**
 * Helper to add timeout to a promise.
 * Why: Fail fast if Browserless connection hangs.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Get a browser instance.
 * Why: Connects to Browserless.io in production for reliable PDF generation.
 * Uses local Chrome for development. Does NOT reuse connections to avoid stale sessions.
 */
async function getBrowser(): Promise<Browser> {
  // High-quality viewport for crisp PDF rendering
  const highQualityViewport = { 
    width: 794,  // A4 width at 96 DPI
    height: 1123, // A4 height at 96 DPI
    deviceScaleFactor: 2 
  };

  if (BROWSERLESS_API_KEY) {
    // Production: Connect to Browserless.io hosted Chrome
    console.log('[PDF Generator] Connecting to Browserless.io...');
    console.log('[PDF Generator] API Key present:', BROWSERLESS_API_KEY ? 'Yes (length: ' + BROWSERLESS_API_KEY.length + ')' : 'No');
    
    try {
      const browser = await withTimeout(
        puppeteer.connect({
          browserWSEndpoint: BROWSERLESS_ENDPOINT,
        }),
        15000, // 15 second timeout for connection
        'Browserless connection timed out after 15 seconds'
      );
      console.log('[PDF Generator] Successfully connected to Browserless.io');
      return browser;
    } catch (error) {
      console.error('[PDF Generator] Failed to connect to Browserless:', error);
      throw new Error(`Browserless connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Local development: Use local Chrome
  console.log('[PDF Generator] Using local Chrome...');
  const possiblePaths = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  let executablePath: string | undefined;
  
  for (const path of possiblePaths) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(path)) {
        executablePath = path;
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  if (!executablePath) {
    throw new Error(
      'Chrome not found. Install Chrome or set BROWSERLESS_API_KEY for production.'
    );
  }

  return await puppeteer.launch({
    headless: true,
    executablePath,
    defaultViewport: highQualityViewport,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

/**
 * Close the browser instance.
 * Why: Clean up resources when done. Critical for Browserless to avoid hitting concurrency limits.
 */
export async function closeBrowser(browser: Browser | null): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      console.error('[PDF Generator] Error closing browser:', error);
    }
  }
}

/**
 * Options for PDF generation.
 */
export interface PDFGeneratorOptions {
  /** HTML content to render */
  html: string;
  /** Output filename (without path) */
  filename?: string;
  /** Page format */
  format?: 'A4' | 'Letter';
  /** Print background colors and images */
  printBackground?: boolean;
  /** Page margins */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  /** Header template HTML */
  headerTemplate?: string;
  /** Footer template HTML */
  footerTemplate?: string;
  /** Display header and footer */
  displayHeaderFooter?: boolean;
}

/**
 * Generate PDF from HTML content.
 * Why: Main function to convert HTML report templates to PDF documents.
 * Always closes browser after use to avoid Browserless concurrency limits.
 */
export async function generatePDF(options: PDFGeneratorOptions): Promise<Buffer> {
  const {
    html,
    format = 'A4',
    printBackground = true,
    margin = {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm',
    },
    headerTemplate,
    footerTemplate,
    displayHeaderFooter = false,
  } = options;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await getBrowser();
    page = await browser.newPage();

    // Set viewport for high-quality rendering
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    // Set content with longer timeout for serverless environments
    // Use 'domcontentloaded' first, then wait for images separately
    console.log('[PDF Generator] Setting page content...');
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 45000, // 45 seconds for initial content load
    });
    
    // Wait for any remaining network requests (images, fonts) with a shorter timeout
    // This is more lenient than networkidle0 which can hang indefinitely
    console.log('[PDF Generator] Waiting for network to settle...');
    try {
      await page.waitForNetworkIdle({ timeout: 10000, idleTime: 500 });
    } catch {
      console.log('[PDF Generator] Network did not fully settle, proceeding anyway...');
    }

    // Wait for Chart.js to fully render (if present)
    console.log('[PDF Generator] Waiting for charts to render...');
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        setTimeout(resolve, 1500);
      });
    });

    // Generate high-quality PDF
    const pdfBuffer = await page.pdf({
      format,
      printBackground,
      margin,
      displayHeaderFooter,
      headerTemplate: headerTemplate || '',
      footerTemplate: footerTemplate || '',
      scale: 1,
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    // Always close page and browser to free Browserless resources
    if (page) {
      try {
        await page.close();
      } catch {
        // Page may already be closed
      }
    }
    await closeBrowser(browser);
  }
}

/**
 * Generate PDF with page numbers in footer.
 * Why: Professional reports need page numbers.
 */
export async function generatePDFWithPageNumbers(
  html: string,
  options?: Partial<PDFGeneratorOptions>
): Promise<Buffer> {
  const footerTemplate = `
    <div style="width: 100%; font-size: 9px; padding: 8px 40px; display: flex; justify-content: space-between; align-items: center; color: #64748b; border-top: 1px solid #e2e8f0;">
      <span style="flex: 1; text-align: left;">IVPLT Report - IS 2911 (Part 4) - 2013</span>
      <span style="flex: 1; text-align: center; font-weight: 600;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      <span style="flex: 1; text-align: right;"></span>
    </div>
  `;

  return generatePDF({
    html,
    displayHeaderFooter: true,
    footerTemplate,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '22mm', // Space for footer
      left: '15mm',
    },
    ...options,
  });
}
