/**
 * Test by ID API Route
 * Why: CRUD operations for a specific test by ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTestEngine } from '@/engines';
import type { TestType, ReadingInput } from '@/engines';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/tests/[testId] - Get a specific test with all related data
 * Why: Test workspace needs full test data including readings.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

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

    return NextResponse.json(test);
  } catch (error) {
    console.error('Failed to fetch test:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tests/[testId] - Update a test
 * Why: User updates test details or status.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const body = await request.json();

    // Check if testLoadT was explicitly provided (manual override)
    const hasExplicitTestLoad = body.testLoadT !== undefined && body.testLoadT !== null;

    // Only auto-calculate testLoadT if designLoadT is being updated AND no explicit testLoadT was provided
    if (body.designLoadT && !hasExplicitTestLoad) {
      const existingTest = await prisma.test.findUnique({
        where: { id: testId },
        select: { testType: true },
      });

      if (existingTest) {
        const engine = getTestEngine(existingTest.testType as TestType);
        body.testLoadT = engine.calculateTestLoad(parseFloat(body.designLoadT));
      }
    }

    // Convert string numbers to actual numbers
    const numericFields = ['pileDiameterMm', 'pileDepthM', 'designLoadT', 'testLoadT', 'ramAreaCm2', 'gaugeLeastCountMm'];
    for (const field of numericFields) {
      if (body[field] !== undefined) {
        body[field] = parseFloat(body[field]);
      }
    }

    // Convert date strings to Date
    if (body.testDate) {
      body.testDate = new Date(body.testDate);
    }
    if (body.dateOfCasting) {
      body.dateOfCasting = new Date(body.dateOfCasting);
    }

    const test = await prisma.test.update({
      where: { id: testId },
      data: body,
      include: {
        project: true,
      },
    });

    return NextResponse.json(test);
  } catch (error) {
    console.error('Failed to update test:', error);
    return NextResponse.json(
      { error: 'Failed to update test' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tests/[testId] - Delete a test
 * Why: User wants to remove a test and all related data.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    await prisma.test.delete({
      where: { id: testId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete test:', error);
    return NextResponse.json(
      { error: 'Failed to delete test' },
      { status: 500 }
    );
  }
}


