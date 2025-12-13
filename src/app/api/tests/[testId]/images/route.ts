/**
 * Site Images API Route
 * Why: CRUD operations for test site images (visual documentation of pile load test setup).
 * Max 5 images per test, stored in Supabase Storage with metadata in database.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { supabase, STORAGE_BUCKETS, getPublicUrl } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/** Maximum number of site images allowed per test */
const MAX_IMAGES_PER_TEST = 5;

/** Maximum file size in bytes (2MB after compression) */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * GET /api/tests/[testId]/images - List all site images for a test
 * Why: Site images screen needs all images for display with captions.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;

    const images = await prisma.siteImage.findMany({
      where: { testId },
      orderBy: { displayOrder: 'asc' },
    });

    // Add public URLs to each image
    const imagesWithUrls = images.map((image) => ({
      ...image,
      url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, image.storagePath),
    }));

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error('Failed to fetch site images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site images' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tests/[testId]/images - Upload a new site image
 * Why: User uploads test setup photo with optional caption.
 * Expects multipart/form-data with 'file' and optional 'caption'.
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

    // Check current image count
    const currentCount = await prisma.siteImage.count({
      where: { testId },
    });

    if (currentCount >= MAX_IMAGES_PER_TEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES_PER_TEST} images allowed per test` },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const caption = formData.get('caption') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
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

    // Validate caption length
    if (caption && caption.length > 200) {
      return NextResponse.json(
        { error: 'Caption must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Generate unique storage path
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const storagePath = `${testId}/${timestamp}.${extension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.SITE_IMAGES)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image to storage' },
        { status: 500 }
      );
    }

    // Get next display order
    const lastImage = await prisma.siteImage.findFirst({
      where: { testId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const displayOrder = (lastImage?.displayOrder ?? 0) + 1;

    // Create database record
    const siteImage = await prisma.siteImage.create({
      data: {
        testId,
        storagePath: uploadData.path,
        fileName: file.name,
        caption: caption || null,
        displayOrder,
      },
    });

    // Return with public URL
    const imageWithUrl = {
      ...siteImage,
      url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, siteImage.storagePath),
    };

    return NextResponse.json(imageWithUrl, { status: 201 });
  } catch (error) {
    console.error('Failed to upload site image:', error);
    return NextResponse.json(
      { error: 'Failed to upload site image' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tests/[testId]/images - Reorder images or bulk update
 * Why: User can reorder images via drag-and-drop for report display order.
 * Expects JSON body: { orderedIds: string[] }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const body = await request.json();
    const { orderedIds } = body as { orderedIds: string[] };

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: 'orderedIds array required' },
        { status: 400 }
      );
    }

    // Update each image's display order
    await Promise.all(
      orderedIds.map((imageId, index) =>
        prisma.siteImage.update({
          where: { id: imageId, testId },
          data: { displayOrder: index + 1 },
        })
      )
    );

    // Fetch updated images
    const images = await prisma.siteImage.findMany({
      where: { testId },
      orderBy: { displayOrder: 'asc' },
    });

    const imagesWithUrls = images.map((image) => ({
      ...image,
      url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, image.storagePath),
    }));

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error('Failed to reorder images:', error);
    return NextResponse.json(
      { error: 'Failed to reorder images' },
      { status: 500 }
    );
  }
}

