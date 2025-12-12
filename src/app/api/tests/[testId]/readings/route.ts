/**
 * Readings API Route
 * Why: CRUD operations for test readings (measurements during pile load test).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateLoadFromPressure, calculateAverageSettlement } from '@/lib/calculations';
import type { TestPhase } from '@/engines';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/tests/[testId]/readings - List all readings for a test
 * Why: Data entry screen needs all readings for display.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    const readings = await prisma.reading.findMany({
      where: { testId },
      orderBy: { sequence: 'asc' },
    });

    return NextResponse.json(readings);
  } catch (error) {
    console.error('Failed to fetch readings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch readings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[testId]/readings - Create a new reading
 * Why: User adds a measurement during the test.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const body = await request.json();

    const {
      phase,
      recordedAt,
      pressureKgCm2,
      dg1,
      dg2,
      dg3,
      dg4,
      dg1Enabled = true,
      dg2Enabled = true,
      dg3Enabled = true,
      dg4Enabled = true,
      remark,
      insertAtSequence, // Optional: insert at specific sequence
    } = body;

    // Validate required fields
    if (!phase || pressureKgCm2 === undefined || dg1 === undefined || dg2 === undefined || dg3 === undefined || dg4 === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate at least one gauge is enabled
    if (!dg1Enabled && !dg2Enabled && !dg3Enabled && !dg4Enabled) {
      return NextResponse.json(
        { error: 'At least one dial gauge must be enabled' },
        { status: 400 }
      );
    }

    // Get test to calculate load from pressure
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { ramAreaCm2: true, status: true },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Calculate load and average settlement
    const loadT = calculateLoadFromPressure(parseFloat(pressureKgCm2), test.ramAreaCm2);
    const avgSettlementMm = calculateAverageSettlement(
      parseFloat(dg1),
      parseFloat(dg2),
      parseFloat(dg3),
      parseFloat(dg4),
      dg1Enabled,
      dg2Enabled,
      dg3Enabled,
      dg4Enabled
    );

    // Determine sequence number
    let sequence: number;
    
    if (insertAtSequence !== undefined) {
      // Shift existing readings to make room
      await prisma.reading.updateMany({
        where: {
          testId,
          sequence: { gte: insertAtSequence },
        },
        data: {
          sequence: { increment: 1 },
        },
      });
      sequence = insertAtSequence;
    } else {
      // Get next sequence number
      const lastReading = await prisma.reading.findFirst({
        where: { testId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      sequence = (lastReading?.sequence ?? 0) + 1;
    }

    // Create the reading
    const reading = await prisma.reading.create({
      data: {
        testId,
        sequence,
        phase: phase as TestPhase,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        pressureKgCm2: parseFloat(pressureKgCm2),
        loadT,
        dg1: parseFloat(dg1),
        dg2: parseFloat(dg2),
        dg3: parseFloat(dg3),
        dg4: parseFloat(dg4),
        dg1Enabled,
        dg2Enabled,
        dg3Enabled,
        dg4Enabled,
        avgSettlementMm,
        remark: remark || null,
      },
    });

    // Update test status to IN_PROGRESS if it's still DRAFT
    if (test.status === 'DRAFT') {
      await prisma.test.update({
        where: { id: testId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return NextResponse.json(reading, { status: 201 });
  } catch (error) {
    console.error('Failed to create reading:', error);
    return NextResponse.json(
      { error: 'Failed to create reading' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tests/[testId]/readings - Delete a reading by ID (via query param)
 * Why: User wants to remove a specific reading.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const { searchParams } = new URL(request.url);
    const readingId = searchParams.get('id');

    if (!readingId) {
      return NextResponse.json(
        { error: 'Reading ID required' },
        { status: 400 }
      );
    }

    // Get the reading to get its sequence
    const reading = await prisma.reading.findUnique({
      where: { id: readingId },
      select: { sequence: true },
    });

    if (!reading) {
      return NextResponse.json(
        { error: 'Reading not found' },
        { status: 404 }
      );
    }

    // Delete the reading
    await prisma.reading.delete({
      where: { id: readingId },
    });

    // Resequence remaining readings
    await prisma.reading.updateMany({
      where: {
        testId,
        sequence: { gt: reading.sequence },
      },
      data: {
        sequence: { decrement: 1 },
      },
    });

    // Check if any readings remain, if not set status back to DRAFT
    const remainingCount = await prisma.reading.count({
      where: { testId },
    });

    if (remainingCount === 0) {
      await prisma.test.update({
        where: { id: testId },
        data: { status: 'DRAFT' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete reading:', error);
    return NextResponse.json(
      { error: 'Failed to delete reading' },
      { status: 500 }
    );
  }
}


