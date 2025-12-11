/**
 * PDF Generation API Route.
 * Why: Server-side PDF generation using Playwright for high-fidelity
 * HTML-to-PDF rendering that matches the web dashboard design.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { generateReportHTML } from '@/lib/pdf/report-template';
import type { ReportData } from '@/types';

/**
 * POST /api/pdf - Generate PDF from report data.
 * Why: Accepts complete report data and returns a downloadable PDF.
 * Uses Playwright to render HTML with full CSS support.
 */
export async function POST(request: NextRequest) {
  let browser = null;

  try {
    // Parse report data from request body
    const reportData: ReportData = await request.json();

    // Validate required data
    if (!reportData.readings || reportData.readings.length === 0) {
      return NextResponse.json(
        { error: 'No readings data provided' },
        { status: 400 }
      );
    }

    if (!reportData.summary) {
      return NextResponse.json(
        { error: 'No summary data provided' },
        { status: 400 }
      );
    }

    // Generate HTML from report data
    const html = generateReportHTML(reportData);

    // Launch Playwright browser
    browser = await chromium.launch({
      headless: true,
    });

    const page = await browser.newPage();

    // Set content and wait for rendering
    await page.setContent(html, {
      waitUntil: 'networkidle',
    });

    // Generate PDF with A4 format
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        bottom: '1cm',
        left: '1cm',
        right: '1cm',
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 9px; width: 100%; text-align: center; color: #64748b;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
    });

    // Close browser
    await browser.close();
    browser = null;

    // Generate filename
    const testNo = reportData.projectInfo.testNo || 'Report';
    const testType = reportData.summary.testType;
    const date = new Date().toISOString().split('T')[0];
    const filename = `${testNo}_${testType}_${date}_Report.pdf`;

    // Return PDF as downloadable response
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const pdfUint8Array = new Uint8Array(pdfBuffer);
    
    return new NextResponse(pdfUint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[PDF Generation Error]', error);

    // Clean up browser if still open
    if (browser) {
      await browser.close();
    }

    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pdf - Health check for PDF service.
 * Why: Allows frontend to verify PDF generation is available.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'PDF generation service is available',
    capabilities: ['A4', 'printBackground', 'headerFooter'],
  });
}

