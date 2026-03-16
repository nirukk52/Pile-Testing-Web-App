/**
 * Field Readings API Route
 * Why: CRUD operations for scanned handwritten field recording sheets.
 * These are uploaded PDFs of the original paper field sheets, included in reports as reference.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadFile, getPublicUrl, STORAGE_BUCKETS } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/** Maximum file size for field readings (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum field reading files per test */
const MAX_FIELD_READINGS = 5;

/**
 * GET /api/tests/[testId]/field-readings - List all field reading files for a test
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    const fieldReadings = await prisma.fieldReading.findMany({
      where: { testId },
      orderBy: { createdAt: 'asc' },
    });

    const fieldReadingsWithUrls = fieldReadings.map((fr) => ({
      id: fr.id,
      filename: fr.fileName,
      url: getPublicUrl(STORAGE_BUCKETS.FIELD_READINGS, fr.storagePath),
      uploadedAt: fr.createdAt.toISOString(),
    }));

    return NextResponse.json({ fieldReadings: fieldReadingsWithUrls });
  } catch (error) {
    console.error('Failed to fetch field readings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field readings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[testId]/field-readings - Upload a field reading PDF
 * Expects multipart/form-data with 'file'.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const currentCount = await prisma.fieldReading.count({
      where: { testId },
    });

    if (currentCount >= MAX_FIELD_READINGS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FIELD_READINGS} files allowed` },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${testId}/${timestamp}_${safeFileName}`;

    const { path: uploadedPath, error: uploadError } = await uploadFile(
      STORAGE_BUCKETS.FIELD_READINGS,
      storagePath,
      file
    );

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    const fieldReading = await prisma.fieldReading.create({
      data: {
        testId,
        storagePath: uploadedPath,
        fileName: file.name,
      },
    });

    return NextResponse.json(
      {
        id: fieldReading.id,
        filename: fieldReading.fileName,
        url: getPublicUrl(STORAGE_BUCKETS.FIELD_READINGS, fieldReading.storagePath),
        uploadedAt: fieldReading.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to upload field reading:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
