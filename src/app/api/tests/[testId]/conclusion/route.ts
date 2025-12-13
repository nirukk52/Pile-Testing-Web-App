/**
 * Conclusion API Route
 * Why: Generates AI-powered or static IS 2911-compliant conclusions for test reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTestEngine } from '@/engines';
import type { TestType, ReadingInput, TestMeta, ReportData } from '@/engines';
import { generateConclusion } from '@/lib/ai';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/tests/[testId]/conclusion - Get current conclusion
 * Why: Returns stored conclusion or generates new one if none exists.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        conclusion: true,
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conclusion: test.conclusion,
      hasConclusion: !!test.conclusion,
    });
  } catch (error) {
    console.error('Failed to fetch conclusion:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conclusion' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[testId]/conclusion - Generate new conclusion
 * Why: Triggers AI generation of IS 2911-compliant conclusion.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    // Fetch test with all data needed for conclusion
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        project: true,
        readings: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
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

    // Build report data for AI prompt
    const reportData: ReportData = {
      projectName: test.project.name,
      client: test.project.client,
      contractor: test.project.contractor,
      pmc: test.project.pmc || undefined,
      location: test.project.location,
      testType: test.testType as TestType,
      pileId: test.pileId,
      pileDiameterMm: test.pileDiameterMm,
      pileDepthM: test.pileDepthM,
      concreteGrade: test.concreteGrade,
      designLoadT: test.designLoadT,
      testLoadT: test.testLoadT,
      testDate: test.testDate,
      reportNo: test.reportNo || undefined,
      jackName: test.jackName || undefined,
      ramAreaCm2: test.ramAreaCm2,
      gaugeLeastCountMm: test.gaugeLeastCountMm,
      readings: readingInputs,
      result,
    };

    // Get the AI prompt from the engine
    const prompt = engine.getAIConclusionPrompt(result, reportData);

    // Generate conclusion using AI (with fallback to static template)
    const conclusionResponse = await generateConclusion(prompt, result, reportData);

    // Don't auto-save - let user review and save manually
    return NextResponse.json({
      conclusion: conclusionResponse.conclusion,
      isAIGenerated: conclusionResponse.isAIGenerated,
      error: conclusionResponse.error,
    });
  } catch (error) {
    console.error('Failed to generate conclusion:', error);
    return NextResponse.json(
      { error: 'Failed to generate conclusion' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tests/[testId]/conclusion - Save edited conclusion
 * Why: Persists user-edited conclusion to database.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const body = await request.json();

    if (!body.conclusion || typeof body.conclusion !== 'string') {
      return NextResponse.json(
        { error: 'Conclusion text is required' },
        { status: 400 }
      );
    }

    const test = await prisma.test.update({
      where: { id: testId },
      data: {
        conclusion: body.conclusion,
      },
      select: {
        id: true,
        conclusion: true,
      },
    });

    return NextResponse.json({
      success: true,
      conclusion: test.conclusion,
    });
  } catch (error) {
    console.error('Failed to save conclusion:', error);
    return NextResponse.json(
      { error: 'Failed to save conclusion' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tests/[testId]/conclusion - Clear conclusion
 * Why: Allows user to reset and regenerate conclusion.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    await prisma.test.update({
      where: { id: testId },
      data: {
        conclusion: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conclusion:', error);
    return NextResponse.json(
      { error: 'Failed to delete conclusion' },
      { status: 500 }
    );
  }
}

