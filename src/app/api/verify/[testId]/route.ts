/**
 * Verify API Route
 * Why: Runs verification checks on a test and returns a verification report.
 * POST: Run verification
 * GET: Get latest verification report
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTest } from '@/lib/ai/verification-agent';
import type { LegacyProjectInfo, LoadEntry, LegacyReading, LegacyTestPhase } from '@/types';

/**
 * In-memory storage for verification reports (MVP).
 * Why: Simple state management during development.
 */
const verificationReports = new Map<string, ReturnType<typeof verifyTest>>();

/**
 * POST /api/verify/[testId]
 * Run verification on a test.
 * Why: Scores the report for data integrity, IS 2911 compliance, and quality.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;

    // Fetch test with readings from database
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

    // Convert to legacy format for verification
    const projectInfo: LegacyProjectInfo = {
      reportNo: test.reportNo || '',
      project: test.project.name,
      location: test.project.location,
      contractor: test.project.contractor,
      client: test.project.client,
      pmc: test.project.pmc || '',
      pileId: test.pileId,
      testDate: test.testDate.toISOString().split('T')[0],
      jackName: test.jackName || '',
      lcOfDialGauge: test.gaugeLeastCountMm.toString(),
      designLoadOnPile: test.designLoadT.toString(),
      testLoad: test.testLoadT.toString(),
      mixedDesign: test.concreteGrade,
      pileDiameter: test.pileDiameterMm.toString(),
      ramArea: test.ramAreaCm2.toString(),
      dateOfCasting: test.dateOfCasting?.toISOString().split('T')[0] || '',
      pileDepth: test.pileDepthM.toString(),
      testType: test.testType as LegacyProjectInfo['testType'],
    };

    // Convert readings to legacy format
    const phaseMap: Record<string, LegacyTestPhase> = {
      LOADING: 'loading',
      HOLD: 'holding',
      UNLOADING: 'unloading',
    };

    const loadEntries: LoadEntry[] = test.readings.map((reading) => {
      const legacyReading: LegacyReading = {
        id: reading.id,
        pressureGauge: reading.pressureKgCm2.toString(),
        load: reading.loadT.toFixed(2),
        dialGauge1: reading.dg1.toString(),
        dialGauge2: reading.dg2.toString(),
        dialGauge3: reading.dg3.toString(),
        dialGauge4: reading.dg4.toString(),
        dg1Enabled: reading.dg1Enabled,
        dg2Enabled: reading.dg2Enabled,
        dg3Enabled: reading.dg3Enabled,
        dg4Enabled: reading.dg4Enabled,
        avgSettlement: reading.avgSettlementMm.toFixed(2),
        timestamp: reading.recordedAt.toISOString(),
        phase: phaseMap[reading.phase] || 'loading',
        remark: reading.remark || '',
      };

      return {
        id: `entry-${reading.id}`,
        pressureGauge: reading.pressureKgCm2.toString(),
        load: reading.loadT.toFixed(2),
        readings: [legacyReading],
        timestamp: reading.recordedAt.toISOString(),
      };
    });

    // Run verification
    const report = verifyTest(testId, projectInfo, loadEntries);

    // Store report
    verificationReports.set(testId, report);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/verify/[testId]
 * Get the latest verification report for a test.
 * Why: Allows fetching verification status without re-running.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;

    const report = verificationReports.get(testId);
    if (!report) {
      return NextResponse.json(
        { error: 'No verification report found. Run POST to verify first.' },
        { status: 404 }
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Get verification error:', error);
    return NextResponse.json(
      { error: 'Failed to get verification report' },
      { status: 500 }
    );
  }
}
