/**
 * Slug generation utilities for shareable test URLs.
 * Why: Creates URL-safe, human-readable slugs from project/test data.
 */

/**
 * Convert a string to a URL-safe slug.
 * Why: Removes special characters, converts to lowercase, replaces spaces with hyphens.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
}

/**
 * Generate a unique slug for a test.
 * Why: Combines project name and report number (or pile ID + test type) for readable URLs.
 * 
 * Format priority:
 * 1. {project-name}-{report-no} (if reportNo exists)
 * 2. {project-name}-{pile-id}-{test-type} (fallback)
 * 
 * @example
 * generateTestSlug("Prestige Nautilus Worli", "TP-01", "IVPLT", "IVPLT-03")
 * // Returns: "prestige-nautilus-worli-ivplt-03"
 * 
 * generateTestSlug("BDD Chawls Project", "TP-02", "RVPLT", null)
 * // Returns: "bdd-chawls-project-tp-02-rvplt"
 */
export function generateTestSlug(
  projectName: string,
  pileId: string,
  testType: string,
  reportNo: string | null
): string {
  const projectSlug = slugify(projectName);
  
  if (reportNo) {
    // Use reportNo for cleaner URLs
    const reportSlug = slugify(reportNo);
    return `${projectSlug}-${reportSlug}`;
  }
  
  // Fallback to pile-id and test-type
  const pileSlug = slugify(pileId);
  const typeSlug = testType.toLowerCase();
  
  return `${projectSlug}-${pileSlug}-${typeSlug}`;
}

/**
 * Check if a string looks like a UUID.
 * Why: API needs to differentiate between slug and ID lookups.
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
