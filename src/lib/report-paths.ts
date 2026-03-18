/**
 * Centralized report artifact path management.
 * Why: Enforces the slug-based batch folder convention and auto-versioning
 * so every generated report is traceable and auditable.
 *
 * Convention:
 *   generated-reports/batches/<slug>/
 *     <slug>-field-sheet-input.pdf
 *     <slug>-reference-report.pdf
 *     <slug>-agent-generated-report-vN.pdf
 *     <slug>-verifier-output-<timestamp>.json
 */

import fs from "fs/promises";
import path from "path";
import os from "os";

const REPORTS_ROOT =
  process.env.REPORTS_ROOT ||
  path.join(os.homedir(), ".openclaw/workspace-piletest/generated-reports");

/** Derive a URL-safe slug from test identifiers. */
export function toSlug(pileId: string, testType: string, projectHint?: string): string {
  const parts = [pileId, testType.toLowerCase()];
  if (projectHint) parts.push(projectHint);
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Absolute path to a slug's batch directory. */
export function batchDir(slug: string): string {
  return path.join(REPORTS_ROOT, "batches", slug);
}

/** Scan the batch dir and return the next available version number. */
export async function nextVersion(slug: string): Promise<number> {
  const dir = batchDir(slug);
  try {
    const files = await fs.readdir(dir);
    const versions = files
      .filter((f) => f.includes("-agent-generated-report-v"))
      .map((f) => {
        const m = f.match(/-v(\d+)\.pdf$/);
        return m ? parseInt(m[1], 10) : 0;
      });
    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
  } catch {
    return 1;
  }
}

export function reportFilename(slug: string, version: number): string {
  return `${slug}-agent-generated-report-v${version}.pdf`;
}

export function verifierFilename(slug: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${slug}-verifier-output-${stamp}.json`;
}

export function inputFilename(slug: string): string {
  return `${slug}-field-sheet-input.pdf`;
}

export function referenceFilename(slug: string): string {
  return `${slug}-reference-report.pdf`;
}

/**
 * Ensure the batch dir exists, compute the next version,
 * and return the full output path for the report PDF.
 */
export async function resolveReportPath(slug: string): Promise<{
  dir: string;
  version: number;
  filename: string;
  fullPath: string;
}> {
  const dir = batchDir(slug);
  await fs.mkdir(dir, { recursive: true });
  const version = await nextVersion(slug);
  const filename = reportFilename(slug, version);
  return { dir, version, filename, fullPath: path.join(dir, filename) };
}

export { REPORTS_ROOT };
