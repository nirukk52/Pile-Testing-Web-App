/**
 * Batch Readings API Route
 * Why: Bulk insert multiple readings in a single transaction for efficiency.
 * Avoids 100+ sequential API calls when saving extracted field sheet data.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateLoadFromPressure, calculateAverageSettlement } from '@/lib/calculations';
import type { TestPhase } from '@/engines';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * Input shape for a single reading in the batch.
 * Why: Matches the createReading input format for consistency.
 */
interface BatchReadingInput {
  phase: TestPhase;
  recordedAt?: string;
  pressureKgCm2: number;
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;
  dg1Enabled?: boolean;
  dg2Enabled?: boolean;
  dg3Enabled?: boolean;
  dg4Enabled?: boolean;
  remark?: string;
}

/**
 * POST /api/tests/[testId]/readings/batch - Create multiple readings in one transaction
 * Why: Bulk inserts are orders of magnitude faster than sequential single inserts.
 * - For 100 readings: ~100ms (batch) vs ~10-30 seconds (sequential)
 * - Uses Prisma transaction to ensure atomicity (all or nothing)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const body = await request.json();

    const { readings } = body as { readings: BatchReadingInput[] };

    // Validate input
    if (!Array.isArray(readings) || readings.length === 0) {
      return NextResponse.json(
        { error: 'readings must be a non-empty array' },
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

    // Get current max sequence for this test
    const lastReading = await prisma.reading.findFirst({
      where: { testId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });
    let nextSequence = (lastReading?.sequence ?? 0) + 1;

    // Validate and transform readings
    const readingsToCreate = readings.map((reading, index) => {
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
      } = reading;

      // Validate required fields
      if (!phase || pressureKgCm2 === undefined || dg1 === undefined || 
          dg2 === undefined || dg3 === undefined || dg4 === undefined) {
        throw new Error(`Reading at index ${index} missing required fields`);
      }

      // Validate at least one gauge is enabled
      if (!dg1Enabled && !dg2Enabled && !dg3Enabled && !dg4Enabled) {
        throw new Error(`Reading at index ${index} must have at least one dial gauge enabled`);
      }

      // Calculate load and average settlement
      const loadT = calculateLoadFromPressure(parseFloat(String(pressureKgCm2)), test.ramAreaCm2);
      const avgSettlementMm = calculateAverageSettlement(
        parseFloat(String(dg1)),
        parseFloat(String(dg2)),
        parseFloat(String(dg3)),
        parseFloat(String(dg4)),
        dg1Enabled,
        dg2Enabled,
        dg3Enabled,
        dg4Enabled
      );

      return {
        testId,
        sequence: nextSequence++,
        phase: phase as TestPhase,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        pressureKgCm2: parseFloat(String(pressureKgCm2)),
        loadT,
        dg1: parseFloat(String(dg1)),
        dg2: parseFloat(String(dg2)),
        dg3: parseFloat(String(dg3)),
        dg4: parseFloat(String(dg4)),
        dg1Enabled,
        dg2Enabled,
        dg3Enabled,
        dg4Enabled,
        avgSettlementMm,
        remark: remark || null,
      };
    });

    // Execute batch insert in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create all readings at once
      const createResult = await tx.reading.createMany({
        data: readingsToCreate,
      });

      // Update test status to IN_PROGRESS if it's still DRAFT
      if (test.status === 'DRAFT') {
        await tx.test.update({
          where: { id: testId },
          data: { status: 'IN_PROGRESS' },
        });
      }

      // Fetch the created readings to return them with IDs
      const createdReadings = await tx.reading.findMany({
        where: { testId },
        orderBy: { sequence: 'asc' },
        take: readingsToCreate.length,
        skip: (lastReading?.sequence ?? 0),
      });

      return {
        count: createResult.count,
        readings: createdReadings,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to batch create readings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to batch create readings' },
      { status: 500 }
    );
  }
}

