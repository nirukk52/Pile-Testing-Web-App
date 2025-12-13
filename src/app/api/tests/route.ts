/**
 * Tests API Route
 * Why: CRUD operations for Test entities (pile load tests).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTestEngine } from '@/engines';
import type { TestType } from '@/engines';

/**
 * GET /api/tests - List all tests with optional filtering
 * Why: Home screen needs to show test list, optionally filtered by project.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const testType = searchParams.get('testType') as TestType | null;

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (testType) where.testType = testType;

    const tests = await prisma.test.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        project: {
          select: {
            name: true,
            client: true,
            location: true,
          },
        },
        _count: {
          select: { readings: true },
        },
      },
    });

    return NextResponse.json(tests);
  } catch (error) {
    console.error('Failed to fetch tests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests - Create a new test
 * Why: User creates a new pile load test within a project.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      testType = 'IVPLT',
      reportNo,
      testDate,
      dateOfCasting,
      pileId,
      pileDiameterMm,
      pileDepthM,
      concreteGrade,
      designLoadT,
      jackName,
      ramAreaCm2,
      gaugeLeastCountMm = 0.01,
    } = body;

    // Validate required fields
    if (!projectId || !pileId || !pileDiameterMm || !pileDepthM || !concreteGrade || !designLoadT || !ramAreaCm2) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get engine to calculate test load
    const engine = getTestEngine(testType as TestType);
    const testLoadT = engine.calculateTestLoad(parseFloat(designLoadT));

    const test = await prisma.test.create({
      data: {
        projectId,
        testType: testType as TestType,
        reportNo: reportNo || null,
        testDate: testDate ? new Date(testDate) : new Date(),
        dateOfCasting: dateOfCasting ? new Date(dateOfCasting) : null,
        pileId,
        pileDiameterMm: parseFloat(pileDiameterMm),
        pileDepthM: parseFloat(pileDepthM),
        concreteGrade,
        designLoadT: parseFloat(designLoadT),
        testLoadT,
        jackName: jackName || null,
        ramAreaCm2: parseFloat(ramAreaCm2),
        gaugeLeastCountMm: parseFloat(gaugeLeastCountMm),
        status: 'DRAFT',
      },
      include: {
        project: true,
      },
    });

    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    console.error('Failed to create test:', error);
    return NextResponse.json(
      { error: 'Failed to create test' },
      { status: 500 }
    );
  }
}


