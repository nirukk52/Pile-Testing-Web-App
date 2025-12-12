/**
 * Calculate API Route
 * Why: Computes IS 2911 metrics for a test using the Test Type Engine.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTestEngine } from '@/engines';
import type { TestType, ReadingInput, TestMeta } from '@/engines';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/tests/[testId]/calculate - Calculate test results
 * Why: Report view needs computed KPIs (max settlement, net settlement, safe load, pass/fail).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    // Fetch test with readings
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
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

    // Get acceptance criteria
    const acceptanceCriteria = engine.getAcceptanceCriteria(meta);

    // Get graph config
    const graphConfig = engine.getGraphConfig(meta);

    // Get KPI config
    const kpiConfig = engine.getKPIConfig();

    return NextResponse.json({
      result,
      acceptanceCriteria,
      graphConfig,
      kpiConfig,
      testLoadT: test.testLoadT,
      designLoadT: test.designLoadT,
    });
  } catch (error) {
    console.error('Failed to calculate results:', error);
    return NextResponse.json(
      { error: 'Failed to calculate results' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[testId]/calculate - Calculate and save results to test
 * Why: Persist computed results when user finalizes test.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    // Fetch test with readings
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
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

    // Update test with computed results
    const updatedTest = await prisma.test.update({
      where: { id: testId },
      data: {
        maxSettlementMm: result.maxSettlementMm,
        elasticReboundMm: result.elasticReboundMm,
        netSettlementMm: result.netSettlementMm,
        safeLoadAdoptedT: result.safeLoadAdoptedT,
        isPassed: result.isPassed,
        status: 'COMPLETED',
      },
    });

    return NextResponse.json({
      test: updatedTest,
      result,
    });
  } catch (error) {
    console.error('Failed to save calculation results:', error);
    return NextResponse.json(
      { error: 'Failed to save calculation results' },
      { status: 500 }
    );
  }
}


