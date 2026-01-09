/**
 * Test lookup by slug API Route
 * Why: Enables shareable URLs with human-readable slugs instead of UUIDs.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/tests/by-slug/[slug] - Get a test by its slug
 * Why: Shareable links need to resolve slugs to test data.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const test = await prisma.test.findFirst({
      where: { slug },
      include: {
        project: true,
        readings: {
          orderBy: { sequence: 'asc' },
        },
        siteImages: {
          orderBy: { displayOrder: 'asc' },
        },
        certificates: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(test);
  } catch (error) {
    console.error('Failed to fetch test by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test' },
      { status: 500 }
    );
  }
}
