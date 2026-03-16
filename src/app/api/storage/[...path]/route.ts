/**
 * Storage File Serving API Route
 * Why: Serves uploaded files from local filesystem so getPublicUrl() paths
 * (e.g. /api/storage/site-images/testId/file.jpg) resolve correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(process.cwd(), 'uploads');

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * GET /api/storage/[...path] - Serve a file from local storage
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const segments = (await params).path;
    const relativePath = segments.join('/');

    // Prevent directory traversal attacks
    const fullPath = path.resolve(STORAGE_ROOT, relativePath);
    if (!fullPath.startsWith(path.resolve(STORAGE_ROOT))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const buffer = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Failed to serve storage file:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
