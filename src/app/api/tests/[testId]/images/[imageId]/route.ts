/**
 * Single Site Image API Route
 * Why: Update caption or delete a specific site image.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteFile, getPublicUrl, STORAGE_BUCKETS } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ testId: string; imageId: string }>;
}

/**
 * GET /api/tests/[testId]/images/[imageId] - Get a single image
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, imageId } = await params;

    const image = await prisma.siteImage.findUnique({
      where: { id: imageId },
    });

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
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, imageId } = await params;
    const body = await request.json();
    const { caption } = body as { caption?: string };

    if (caption && caption.length > 200) {
      return NextResponse.json(
        { error: 'Caption must be 200 characters or less' },
        { status: 400 }
      );
    }

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
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, imageId } = await params;

    const image = await prisma.siteImage.findUnique({
      where: { id: imageId },
      select: { testId: true, storagePath: true, displayOrder: true },
    });

    if (!image || image.testId !== testId) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    const { error: storageError } = await deleteFile(
      STORAGE_BUCKETS.SITE_IMAGES,
      image.storagePath
    );

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    await prisma.siteImage.delete({
      where: { id: imageId },
    });

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
