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
import { getPublicUrl, STORAGE_BUCKETS } from '@/lib/supabase';
import { mergePdfsFromSupabase } from '@/lib/pdf/merge';

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

    // Convert readings to engine input format
    const readingInputs: ReadingInput[] = test.readings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
      loadT: r.loadT,
      avgSettlementMm: r.avgSettlementMm,
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

    // Build report data (GET - no chart, use POST for chart)
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
      readings: readingInputs,
      conclusion: test.conclusion || undefined,
      siteImages,
      fieldReadings: fieldReadingsForReport,
      calibrationCertificates: certificatesForReport,
    };

    // Generate HTML
    const html = generateIvpltReportHtml(reportData);

    // Generate main report PDF
    let pdfBuffer = await generatePDFWithPageNumbers(html);

    // Merge field reading PDFs if any exist using authenticated Supabase download
    if (test.fieldReadings.length > 0) {
      const fieldReadingsForMerge = test.fieldReadings.map((fr) => ({
        storagePath: fr.storagePath,
      }));
      pdfBuffer = await mergePdfsFromSupabase(pdfBuffer, fieldReadingsForMerge);
    }

    // Merge calibration certificate PDFs if any exist using authenticated Supabase download
    if (test.certificates.length > 0) {
      const certificatesForMerge = test.certificates.map((cert) => ({
        storagePath: cert.storagePath,
      }));
      pdfBuffer = await mergePdfsFromSupabase(pdfBuffer, certificatesForMerge, 'certificates');
    }

    // Build filename
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

    // Convert readings to engine input format
    const readingInputs: ReadingInput[] = test.readings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
      loadT: r.loadT,
      avgSettlementMm: r.avgSettlementMm,
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

    // Build report data (use chart from client if provided)
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
      readings: readingInputs,
      conclusion: test.conclusion || undefined,
      chartImageBase64: chartImageBase64 || undefined,
      siteImages,
      fieldReadings: fieldReadingsForReport,
      calibrationCertificates: certificatesForReport,
    };

    // Generate HTML
    const html = generateIvpltReportHtml(reportData);

    // Generate main report PDF
    let pdfBuffer = await generatePDFWithPageNumbers(html);

    // Merge field reading PDFs if any exist using authenticated Supabase download
    if (test.fieldReadings.length > 0) {
      const fieldReadingsForMerge = test.fieldReadings.map((fr) => ({
        storagePath: fr.storagePath,
      }));
      pdfBuffer = await mergePdfsFromSupabase(pdfBuffer, fieldReadingsForMerge);
    }

    // Merge calibration certificate PDFs if any exist using authenticated Supabase download
    if (test.certificates.length > 0) {
      const certificatesForMerge = test.certificates.map((cert) => ({
        storagePath: cert.storagePath,
      }));
      pdfBuffer = await mergePdfsFromSupabase(pdfBuffer, certificatesForMerge, 'certificates');
    }

    // Build filename
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

