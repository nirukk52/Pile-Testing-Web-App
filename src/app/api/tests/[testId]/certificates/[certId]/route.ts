/**
 * Single Certificate API Route
 * Why: Get or delete a specific certificate.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteFile, getPublicUrl, STORAGE_BUCKETS } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ testId: string; certId: string }>;
}

/**
 * GET /api/tests/[testId]/certificates/[certId] - Get a single certificate
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, certId } = await params;

    const certificate = await prisma.calibrationCertificate.findUnique({
      where: { id: certId },
    });

    if (!certificate || certificate.testId !== testId) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...certificate,
      url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, certificate.storagePath),
    });
  } catch (error) {
    console.error('Failed to fetch certificate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificate' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tests/[testId]/certificates/[certId] - Delete a certificate
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, certId } = await params;

    const certificate = await prisma.calibrationCertificate.findUnique({
      where: { id: certId },
      select: { testId: true, storagePath: true },
    });

    if (!certificate || certificate.testId !== testId) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    await deleteFile(STORAGE_BUCKETS.CERTIFICATES, certificate.storagePath);

    await prisma.calibrationCertificate.delete({
      where: { id: certId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete certificate:', error);
    return NextResponse.json(
      { error: 'Failed to delete certificate' },
      { status: 500 }
    );
  }
}
