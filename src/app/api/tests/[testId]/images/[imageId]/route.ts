/**
 * Single Site Image API Route
 * Why: Update caption or delete a specific site image.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSupabase, STORAGE_BUCKETS, getPublicUrl } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ testId: string; imageId: string }>;
}

/**
 * GET /api/tests/[testId]/images/[imageId] - Get a single image
 * Why: Load specific image details for editing.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, imageId } = await params;

    const image = await prisma.siteImage.findUnique({
      where: { id: imageId },
    });

    // Validate image exists and belongs to this test
    if (!image || image.testId !== testId) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    const imageWithUrl = {
      ...image,
      url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, image.storagePath),
    };

    return NextResponse.json(imageWithUrl);
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tests/[testId]/images/[imageId] - Update image caption
 * Why: User can edit caption for existing image.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, imageId } = await params;
    const body = await request.json();
    const { caption } = body as { caption?: string };

    // Validate caption length
    if (caption && caption.length > 200) {
      return NextResponse.json(
        { error: 'Caption must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Verify image belongs to this test
    const existing = await prisma.siteImage.findUnique({
      where: { id: imageId },
      select: { testId: true },
    });

    if (!existing || existing.testId !== testId) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    const image = await prisma.siteImage.update({
      where: { id: imageId },
      data: { caption: caption ?? null },
    });

    const imageWithUrl = {
      ...image,
      url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, image.storagePath),
    };

    return NextResponse.json(imageWithUrl);
  } catch (error) {
    console.error('Failed to update image:', error);
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tests/[testId]/images/[imageId] - Delete an image
 * Why: User can remove an image from the test. Also removes from storage.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, imageId } = await params;

    // Get image to find storage path
    const image = await prisma.siteImage.findUnique({
      where: { id: imageId },
      select: { testId: true, storagePath: true, displayOrder: true },
    });

    // Validate image exists and belongs to this test
    if (!image || image.testId !== testId) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await getSupabase().storage
      .from(STORAGE_BUCKETS.SITE_IMAGES)
      .remove([image.storagePath]);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      // Continue with database deletion even if storage delete fails
    }

    // Delete database record
    await prisma.siteImage.delete({
      where: { id: imageId },
    });

    // Resequence remaining images
    await prisma.siteImage.updateMany({
      where: {
        testId,
        displayOrder: { gt: image.displayOrder },
      },
      data: {
        displayOrder: { decrement: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

