/**
 * Single Calibration Certificate API Route
 * Why: Get or delete a specific certificate.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { supabase, STORAGE_BUCKETS, getPublicUrl } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ testId: string; certId: string }>;
}

/**
 * GET /api/tests/[testId]/certificates/[certId] - Get a single certificate
 * Why: Load specific certificate details.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, certId } = await params;

    const certificate = await prisma.calibrationCertificate.findUnique({
      where: { id: certId, testId },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }

    const certificateWithUrl = {
      ...certificate,
      url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, certificate.storagePath),
    };

    return NextResponse.json(certificateWithUrl);
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
 * Why: User can remove a certificate from the test. Also removes from storage.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, certId } = await params;

    // Get certificate to find storage path
    const certificate = await prisma.calibrationCertificate.findUnique({
      where: { id: certId, testId },
      select: { storagePath: true },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from(STORAGE_BUCKETS.CERTIFICATES)
      .remove([certificate.storagePath]);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      // Continue with database deletion even if storage delete fails
    }

    // Delete database record
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

