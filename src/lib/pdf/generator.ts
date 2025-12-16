/**
 * Serverless PDF Generator
 * Why: Uses puppeteer-core with @sparticuz/chromium for Vercel serverless compatibility.
 * Previous Playwright approach didn't work on Vercel due to Chromium binary size limits.
 */

import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Check if running in serverless environment (Vercel).
 * Why: Different browser launch config needed for local vs serverless.
 */
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance.
 * Why: Reuse browser for better performance across multiple PDF generations.
 * Uses @sparticuz/chromium on serverless, system Chrome locally.
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  if (isServerless) {
    // Serverless environment (Vercel)
    // @sparticuz/chromium types may be incomplete, so we use type assertions
    const execPath = await chromium.executablePath();
    
    browserInstance = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: execPath,
      headless: true,
    });
  } else {
    // Local development - try to find Chrome
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
    
    // Try to find an existing Chrome installation
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
      // Fallback: use @sparticuz/chromium even locally
      executablePath = await chromium.executablePath();
    }

    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }

  return browserInstance;
}

/**
 * Close the browser instance.
 * Why: Clean up resources when done.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
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

  const browser = await getBrowser();
  const page: Page = await browser.newPage();

  try {
    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      printBackground,
      margin,
      displayHeaderFooter,
      headerTemplate: headerTemplate || '',
      footerTemplate: footerTemplate || '',
    });

    // Convert Uint8Array to Buffer for Node.js compatibility
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
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
    <div style="width: 100%; font-size: 10px; padding: 10px 20px; text-align: center; color: #666;">
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `;

  return generatePDF({
    html,
    displayHeaderFooter: true,
    footerTemplate,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '25mm', // Extra space for footer
      left: '15mm',
    },
    ...options,
  });
}
