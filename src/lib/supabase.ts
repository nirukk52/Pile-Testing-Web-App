/**
 * Supabase client configuration for PileTest Pro.
 * Why: Centralizes Supabase connection for database and storage operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy-loaded Supabase client singleton.
 * Why: Prevents build-time errors when env vars aren't available.
 */
let _supabase: SupabaseClient | null = null;

/**
 * Get Supabase client instance (lazy-loaded).
 * Why: Only creates client when actually needed, not at module load time.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

/**
 * Legacy export for backward compatibility.
 * Why: Existing code imports `supabase` directly.
 * @deprecated Use getSupabase() instead
 */
export const supabase = {
  get storage() {
    return getSupabase().storage;
  },
};

/**
 * Storage bucket names for organized file management.
 * Why: Site images and certificates are stored separately for access control.
 */
export const STORAGE_BUCKETS = {
  /** Bucket for test setup photos */
  SITE_IMAGES: 'site-images',
  /** Bucket for calibration certificate PDFs */
  CERTIFICATES: 'certificates',
  /** Bucket for scanned field reading sheets (handwritten records) */
  FIELD_READINGS: 'field-readings',
} as const;

/**
 * Helper to get a public URL for a stored file.
 * Why: Generates accessible URLs for displaying images in the app.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = getSupabase().storage.from(bucket).getPublicUrl(path);
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
  const { data, error } = await getSupabase().storage
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
  const { error } = await getSupabase().storage.from(bucket).remove([path]);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}


