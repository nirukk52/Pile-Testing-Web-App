/**
 * Playwright PDF Generator
 * Why: Uses Playwright to render HTML templates as professional PDF reports.
 */

import { chromium, type Browser, type Page } from 'playwright';

let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance.
 * Why: Reuse browser for better performance across multiple PDF generations.
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
      waitUntil: 'networkidle',
    });

    // Wait for any images to load
    await page.waitForLoadState('domcontentloaded');

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      printBackground,
      margin,
      displayHeaderFooter,
      headerTemplate: headerTemplate || '',
      footerTemplate: footerTemplate || '',
    });

    return pdfBuffer;
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


