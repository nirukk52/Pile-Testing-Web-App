/**
 * Local File Storage for PileTest Pro.
 * Why: Replaces Supabase Storage with local filesystem, enabling self-hosted
 * deployments and MCP server access without cloud SDK dependency.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Root directory for all uploaded files.
 * Why: Configurable via env var for different environments (dev vs prod).
 */
const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(process.cwd(), 'uploads');

/**
 * Storage bucket names for organized file management.
 * Why: Site images, certificates, and field readings are stored separately.
 */
export const STORAGE_BUCKETS = {
  SITE_IMAGES: 'site-images',
  CERTIFICATES: 'certificates',
  FIELD_READINGS: 'field-readings',
} as const;

/**
 * Resolve the absolute filesystem path for a bucket + relative path.
 * Why: All storage operations need a consistent path resolution strategy.
 */
function resolvePath(bucket: string, relativePath: string): string {
  return path.join(STORAGE_ROOT, bucket, relativePath);
}

/**
 * Ensure the directory for a file path exists, creating it if needed.
 * Why: Uploads can target arbitrary subdirectories (e.g. testId/timestamp_file.pdf).
 */
async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/**
 * Get a public URL for a stored file.
 * Why: Serves files through the Next.js API for display in the app.
 * In local mode, returns a relative API path; the web app proxies it.
 */
export function getPublicUrl(bucket: string, storagePath: string): string {
  return `/api/storage/${bucket}/${storagePath}`;
}

/**
 * Upload a file to local storage.
 * Why: Standardizes file upload with error handling matching the old Supabase interface.
 */
export async function uploadFile(
  bucket: string,
  storagePath: string,
  file: File | Buffer | ArrayBuffer
): Promise<{ path: string; error: Error | null }> {
  try {
    const fullPath = resolvePath(bucket, storagePath);
    await ensureDir(fullPath);

    let buffer: Buffer;
    if (Buffer.isBuffer(file)) {
      buffer = file;
    } else if (file instanceof ArrayBuffer) {
      buffer = Buffer.from(file);
    } else {
      const arrayBuffer = await (file as Blob).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    await fs.writeFile(fullPath, buffer);
    return { path: storagePath, error: null };
  } catch (err) {
    return { path: '', error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Delete a file from local storage.
 * Why: Cleans up storage when images/certificates are removed.
 */
export async function deleteFile(
  bucket: string,
  storagePath: string
): Promise<{ error: Error | null }> {
  try {
    const fullPath = resolvePath(bucket, storagePath);
    await fs.unlink(fullPath);
    return { error: null };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { error: null };
    }
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Download a file from local storage and return as Buffer.
 * Why: Used by PDF merge to read certificate/field-reading PDFs for merging.
 */
export async function downloadFile(
  bucket: string,
  storagePath: string
): Promise<Buffer> {
  const fullPath = resolvePath(bucket, storagePath);
  try {
    return await fs.readFile(fullPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`File not found: ${bucket}/${storagePath}`);
    }
    throw new Error(`Failed to read ${bucket}/${storagePath}: ${(err as Error).message}`);
  }
}
