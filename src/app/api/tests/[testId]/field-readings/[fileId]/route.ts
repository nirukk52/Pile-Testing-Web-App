/**
 * Individual Field Reading API Route
 * Why: Delete operation for a specific field reading file.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteFile, STORAGE_BUCKETS } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ testId: string; fileId: string }>;
}

/**
 * DELETE /api/tests/[testId]/field-readings/[fileId] - Delete a field reading file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, fileId } = await params;

    const fieldReading = await prisma.fieldReading.findUnique({
      where: { id: fileId },
    });

    if (!fieldReading || fieldReading.testId !== testId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const { error: storageError } = await deleteFile(
      STORAGE_BUCKETS.FIELD_READINGS,
      fieldReading.storagePath
    );

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    await prisma.fieldReading.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete field reading:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
