/**
 * Report Preview API Route
 * Why: Returns the raw HTML of the report for preview before PDF generation.
 * This is the exact HTML that will be converted to PDF.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTestEngine } from '@/engines';
import type { TestType, ReadingInput, TestMeta } from '@/engines';
import { generateIvpltReportHtml } from '@/lib/pdf/templates/ivplt-template';
import { getPublicUrl, STORAGE_BUCKETS } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/tests/[testId]/preview - Get HTML preview of the report
 * Why: Allows client to display exact PDF content before download.
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
        { error: 'No readings recorded' },
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

    // Build report data
    const reportData = {
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
    };

    // Generate HTML
    const html = generateIvpltReportHtml(reportData);

    // Return HTML directly
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Failed to generate preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview', details: String(error) },
      { status: 500 }
    );
  }
}



