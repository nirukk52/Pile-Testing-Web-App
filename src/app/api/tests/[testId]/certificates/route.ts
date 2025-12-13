/**
 * Calibration Certificates API Route
 * Why: CRUD operations for test calibration certificates (IS 2911 compliance documentation).
 * Certificates are categorized by type and one per type is allowed per test.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { supabase, STORAGE_BUCKETS, getPublicUrl } from '@/lib/supabase';
import { CertificateType } from '@prisma/client';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/** Maximum file size for certificates (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * GET /api/tests/[testId]/certificates - List all certificates for a test
 * Why: Certificates screen needs all certificates for display.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    const certificates = await prisma.calibrationCertificate.findMany({
      where: { testId },
      orderBy: { createdAt: 'asc' },
    });

    // Add public URLs to each certificate
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
 * POST /api/tests/[testId]/certificates - Upload a new certificate
 * Why: User uploads calibration certificate PDF with type selection.
 * Expects multipart/form-data with 'file' and 'certificateType'.
 * If a certificate of the same type exists, it will be replaced.
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
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const certificateTypeStr = formData.get('certificateType') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!certificateTypeStr) {
      return NextResponse.json(
        { error: 'Certificate type is required' },
        { status: 400 }
      );
    }

    // Validate certificate type
    const validTypes: CertificateType[] = [
      'HYDRAULIC_JACK',
      'PRESSURE_GAUGE',
      'DIAL_GAUGE',
      'PROVING_RING',
      'OTHER',
    ];

    if (!validTypes.includes(certificateTypeStr as CertificateType)) {
      return NextResponse.json(
        { error: `Invalid certificate type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const certificateType = certificateTypeStr as CertificateType;

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
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Check if certificate of this type already exists
    const existingCert = await prisma.calibrationCertificate.findUnique({
      where: {
        testId_certificateType: {
          testId,
          certificateType,
        },
      },
    });

    // If exists, delete old file from storage
    if (existingCert) {
      await supabase.storage
        .from(STORAGE_BUCKETS.CERTIFICATES)
        .remove([existingCert.storagePath]);

      // Delete old database record
      await prisma.calibrationCertificate.delete({
        where: { id: existingCert.id },
      });
    }

    // Generate unique storage path
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${testId}/${certificateType}_${timestamp}_${safeFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.CERTIFICATES)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload certificate to storage' },
        { status: 500 }
      );
    }

    // Create database record
    const certificate = await prisma.calibrationCertificate.create({
      data: {
        testId,
        certificateType,
        storagePath: uploadData.path,
        fileName: file.name,
      },
    });

    // Return with public URL
    const certificateWithUrl = {
      ...certificate,
      url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, certificate.storagePath),
    };

    return NextResponse.json(certificateWithUrl, { status: 201 });
  } catch (error) {
    console.error('Failed to upload certificate:', error);
    return NextResponse.json(
      { error: 'Failed to upload certificate' },
      { status: 500 }
    );
  }
}

