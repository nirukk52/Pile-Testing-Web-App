/**
 * Supabase client configuration for PileTest Pro.
 * Why: Centralizes Supabase connection for database and storage operations.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Environment variables for Supabase connection.
 * Why: These must be set in .env.local for the app to function.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client instance for client-side operations.
 * Why: Used for database queries and storage uploads from browser.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Storage bucket names for organized file management.
 * Why: Site images and certificates are stored separately for access control.
 */
export const STORAGE_BUCKETS = {
  /** Bucket for test setup photos */
  SITE_IMAGES: 'site-images',
  /** Bucket for calibration certificate PDFs */
  CERTIFICATES: 'certificates',
} as const;

/**
 * Helper to get a public URL for a stored file.
 * Why: Generates accessible URLs for displaying images in the app.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Helper to upload a file to Supabase Storage.
 * Why: Standardizes file upload with error handling.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ path: string; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return { path: '', error: new Error(error.message) };
  }

  return { path: data.path, error: null };
}

/**
 * Helper to delete a file from Supabase Storage.
 * Why: Cleans up storage when images/certificates are removed.
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}


