/**
 * Calibration Certificates API Route
 * Why: CRUD operations for test calibration certificates (IS 2911 compliance).
 * Simple: just upload PDFs, no complex categorization.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSupabase, STORAGE_BUCKETS, getPublicUrl } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/** Maximum file size for certificates (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum certificates per test */
const MAX_CERTIFICATES = 6;

/**
 * GET /api/tests/[testId]/certificates - List all certificates for a test
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    const certificates = await prisma.calibrationCertificate.findMany({
      where: { testId },
      orderBy: { createdAt: 'asc' },
    });

    // Add public URLs
    const certificatesWithUrls = certificates.map((cert) => ({
      ...cert,
      url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, cert.storagePath),
    }));

    return NextResponse.json(certificatesWithUrls);
  } catch (error) {
    console.error('Failed to fetch certificates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[testId]/certificates - Upload a certificate PDF
 * Expects multipart/form-data with 'file'.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Check certificate count
    const currentCount = await prisma.calibrationCertificate.count({
      where: { testId },
    });

    if (currentCount >= MAX_CERTIFICATES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CERTIFICATES} certificates allowed` },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (PDF only)
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate storage path
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${testId}/${timestamp}_${safeFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await getSupabase().storage
      .from(STORAGE_BUCKETS.CERTIFICATES)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload certificate' },
        { status: 500 }
      );
    }

    // Create database record (use OTHER as default type - we're simplifying)
    const certificate = await prisma.calibrationCertificate.create({
      data: {
        testId,
        certificateType: 'OTHER', // Simplified - no complex types
        storagePath: uploadData.path,
        fileName: file.name,
      },
    });

    return NextResponse.json(
      {
        ...certificate,
        url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, certificate.storagePath),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to upload certificate:', error);
    return NextResponse.json(
      { error: 'Failed to upload certificate' },
      { status: 500 }
    );
  }
}
