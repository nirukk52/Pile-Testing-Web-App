/**
 * PDF Generation API Route
 * Why: Generates professional PDF reports for pile load tests.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTestEngine } from '@/engines';
import type { TestType, ReadingInput, TestMeta } from '@/engines';
import { generatePDFWithPageNumbers } from '@/lib/pdf/generator';
import { generateIvpltReportHtml, type IvpltReportData } from '@/lib/pdf/templates/ivplt-template';
import { generateRvpltReportHtml } from '@/lib/pdf/templates/rvplt-template';
import { generateLateralReportHtml } from '@/lib/pdf/templates/lateral-template';
import { generateUpliftReportHtml } from '@/lib/pdf/templates/uplift-template';
import { getPublicUrl, STORAGE_BUCKETS } from '@/lib/storage';
import { mergePdfs } from '@/lib/pdf/merge';

/**
 * Why: Maps test type to its HTML template generator so the route
 * dispatches to the correct report layout at runtime.
 */
const templateByType: Record<string, (data: IvpltReportData) => string> = {
  IVPLT: generateIvpltReportHtml,
  RVPLT: generateRvpltReportHtml,
  LATERAL: generateLateralReportHtml,
  UPLIFT: generateUpliftReportHtml,
};
const reportLabelByType: Record<string, string> = {
  IVPLT: 'IVPLT Report',
  RVPLT: 'RVPLT Report',
  LATERAL: 'Lateral Load Test Report',
  UPLIFT: 'Uplift Load Test Report',
};

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/tests/[testId]/pdf - Generate and download PDF report
 * Why: Primary deliverable - professional IS 2911 compliant PDF report.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    // Fetch test with all related data
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: true,
        readings: {
          orderBy: { sequence: 'asc' },
        },
        siteImages: {
          orderBy: { displayOrder: 'asc' },
        },
        fieldReadings: {
          orderBy: { createdAt: 'asc' },
        },
        certificates: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    if (test.readings.length === 0) {
      return NextResponse.json(
        { error: 'Cannot generate PDF: No readings recorded' },
        { status: 400 }
      );
    }

    // Get the appropriate engine
    const engine = getTestEngine(test.testType as TestType);

    // Convert readings to engine input format (basic for calculations)
    const readingInputs: ReadingInput[] = test.readings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
      loadT: r.loadT,
      avgSettlementMm: r.avgSettlementMm,
    }));

    // Extended readings with all fields for observation sheet
    const extendedReadings = test.readings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
      loadT: r.loadT,
      avgSettlementMm: r.avgSettlementMm,
      dialGauge1: r.dg1.toString(),
      dialGauge2: r.dg2.toString(),
      dialGauge3: r.dg3.toString(),
      dialGauge4: r.dg4.toString(),
      timestamp: r.recordedAt?.toISOString(),
      pressureGauge: r.pressureKgCm2.toString(),
      remark: r.remark || undefined,
    }));

    // Build test metadata
    const meta: TestMeta = {
      pileDiameterMm: test.pileDiameterMm,
      pileDepthM: test.pileDepthM,
      designLoadT: test.designLoadT,
      testLoadT: test.testLoadT,
      ramAreaCm2: test.ramAreaCm2,
    };

    // Calculate results
    const result = engine.calculate(readingInputs, meta);

    // Map site images with public URLs
    const siteImages = test.siteImages.map((img) => ({
      url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, img.storagePath),
      caption: img.caption || undefined,
    }));

    // Map field readings for display in report
    const fieldReadingsForReport = test.fieldReadings.map((fr) => ({
      id: fr.id,
      filename: fr.fileName,
      url: getPublicUrl(STORAGE_BUCKETS.FIELD_READINGS, fr.storagePath),
    }));

    // Map calibration certificates for display in report
    const certificatesForReport = test.certificates.map((cert) => ({
      id: cert.id,
      filename: cert.fileName,
      url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, cert.storagePath),
    }));

    const reportData: IvpltReportData = {
      projectName: test.project.name,
      client: test.project.client,
      contractor: test.project.contractor,
      pmc: test.project.pmc || undefined,
      location: test.project.location,
      pileId: test.pileId,
      reportNo: test.reportNo || undefined,
      testDate: test.testDate.toISOString(),
      pileDiameterMm: test.pileDiameterMm,
      pileDepthM: test.pileDepthM,
      concreteGrade: test.concreteGrade,
      designLoadT: test.designLoadT,
      testLoadT: test.testLoadT,
      jackName: test.jackName || undefined,
      ramAreaCm2: test.ramAreaCm2,
      gaugeLeastCountMm: test.gaugeLeastCountMm,
      result,
      readings: extendedReadings,
      conclusion: test.conclusion || undefined,
      siteImages,
      fieldReadings: fieldReadingsForReport,
      calibrationCertificates: certificatesForReport,
    };

    const generateHtmlGet = templateByType[test.testType] || generateIvpltReportHtml;
    const html = generateHtmlGet(reportData);

    const reportLabelGet = reportLabelByType[test.testType] || 'IVPLT Report';
    let pdfBuffer = await generatePDFWithPageNumbers(html, { reportLabel: reportLabelGet });

    // Merge field reading PDFs if any exist using authenticated Supabase download
    if (test.fieldReadings.length > 0) {
      const fieldReadingsForMerge = test.fieldReadings.map((fr) => ({
        storagePath: fr.storagePath,
      }));
      pdfBuffer = await mergePdfs(pdfBuffer, fieldReadingsForMerge);
    }

    if (test.certificates.length > 0) {
      const certificatesForMerge = test.certificates.map((cert) => ({
        storagePath: cert.storagePath,
      }));
      pdfBuffer = await mergePdfs(pdfBuffer, certificatesForMerge, 'certificates');
    }

    const dateStr = test.testDate.toISOString().split('T')[0];
    const filename = `${test.pileId}_${test.testType}_${dateStr}_Report.pdf`;

    // Return PDF (convert Buffer to Uint8Array for NextResponse compatibility)
    const uint8Array = new Uint8Array(pdfBuffer);
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[testId]/pdf - Generate PDF with chart from client
 * Why: Client captures the rendered Chart.js canvas and sends it as base64.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const body = await request.json();
    const { chartImageBase64 } = body;

    // Fetch test with all related data
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: true,
        readings: {
          orderBy: { sequence: 'asc' },
        },
        siteImages: {
          orderBy: { displayOrder: 'asc' },
        },
        fieldReadings: {
          orderBy: { createdAt: 'asc' },
        },
        certificates: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    if (test.readings.length === 0) {
      return NextResponse.json(
        { error: 'Cannot generate PDF: No readings recorded' },
        { status: 400 }
      );
    }

    // Get the appropriate engine
    const engine = getTestEngine(test.testType as TestType);

    // Convert readings to engine input format (basic for calculations)
    const readingInputs: ReadingInput[] = test.readings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
      loadT: r.loadT,
      avgSettlementMm: r.avgSettlementMm,
    }));

    // Extended readings with all fields for observation sheet
    const extendedReadings = test.readings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
      loadT: r.loadT,
      avgSettlementMm: r.avgSettlementMm,
      dialGauge1: r.dg1.toString(),
      dialGauge2: r.dg2.toString(),
      dialGauge3: r.dg3.toString(),
      dialGauge4: r.dg4.toString(),
      timestamp: r.recordedAt?.toISOString(),
      pressureGauge: r.pressureKgCm2.toString(),
      remark: r.remark || undefined,
    }));

    // Build test metadata
    const meta: TestMeta = {
      pileDiameterMm: test.pileDiameterMm,
      pileDepthM: test.pileDepthM,
      designLoadT: test.designLoadT,
      testLoadT: test.testLoadT,
      ramAreaCm2: test.ramAreaCm2,
    };

    // Calculate results
    const result = engine.calculate(readingInputs, meta);

    // Map site images with public URLs
    const siteImages = test.siteImages.map((img) => ({
      url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, img.storagePath),
      caption: img.caption || undefined,
    }));

    // Map field readings for display in report
    const fieldReadingsForReport = test.fieldReadings.map((fr) => ({
      id: fr.id,
      filename: fr.fileName,
      url: getPublicUrl(STORAGE_BUCKETS.FIELD_READINGS, fr.storagePath),
    }));

    // Map calibration certificates for display in report
    const certificatesForReport = test.certificates.map((cert) => ({
      id: cert.id,
      filename: cert.fileName,
      url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, cert.storagePath),
    }));

    const reportData: IvpltReportData = {
      projectName: test.project.name,
      client: test.project.client,
      contractor: test.project.contractor,
      pmc: test.project.pmc || undefined,
      location: test.project.location,
      pileId: test.pileId,
      reportNo: test.reportNo || undefined,
      testDate: test.testDate.toISOString(),
      pileDiameterMm: test.pileDiameterMm,
      pileDepthM: test.pileDepthM,
      concreteGrade: test.concreteGrade,
      designLoadT: test.designLoadT,
      testLoadT: test.testLoadT,
      jackName: test.jackName || undefined,
      ramAreaCm2: test.ramAreaCm2,
      gaugeLeastCountMm: test.gaugeLeastCountMm,
      result,
      readings: extendedReadings,
      conclusion: test.conclusion || undefined,
      chartImageBase64: chartImageBase64 || undefined,
      siteImages,
      fieldReadings: fieldReadingsForReport,
      calibrationCertificates: certificatesForReport,
    };

    const generateHtmlPost = templateByType[test.testType] || generateIvpltReportHtml;
    const html = generateHtmlPost(reportData);

    const reportLabelPost = reportLabelByType[test.testType] || 'IVPLT Report';
    let pdfBuffer = await generatePDFWithPageNumbers(html, { reportLabel: reportLabelPost });

    // Merge field reading PDFs if any exist using authenticated Supabase download
    if (test.fieldReadings.length > 0) {
      const fieldReadingsForMerge = test.fieldReadings.map((fr) => ({
        storagePath: fr.storagePath,
      }));
      pdfBuffer = await mergePdfs(pdfBuffer, fieldReadingsForMerge);
    }

    if (test.certificates.length > 0) {
      const certificatesForMerge = test.certificates.map((cert) => ({
        storagePath: cert.storagePath,
      }));
      pdfBuffer = await mergePdfs(pdfBuffer, certificatesForMerge, 'certificates');
    }

    const dateStr = test.testDate.toISOString().split('T')[0];
    const filename = `${test.pileId}_${test.testType}_${dateStr}_Report.pdf`;

    // Return PDF as base64 for client download
    return NextResponse.json({
      filename,
      pdfBase64: pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
    });
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: String(error) },
      { status: 500 }
    );
  }
}

