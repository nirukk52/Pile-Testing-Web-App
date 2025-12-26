/**
 * Ingest API Route
 * Why: Handles file uploads and extraction for the auto-report pipeline.
 * POST: Upload file and start extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractFromFile } from '@/lib/ai/extraction-agent';
import type { IngestionJob, IngestionStatus } from '@/types';

/**
 * In-memory job storage (MVP - will move to Supabase in production).
 * Why: Simple state management for extraction jobs during development.
 */
const jobs = new Map<string, IngestionJob>();

/**
 * Generate a unique job ID.
 * Why: Each ingestion job needs a stable identifier.
 */
function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * POST /api/ingest
 * Upload a file and start extraction.
 * Why: Main entry point for the ingestion pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const testType = formData.get('testType') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv|pdf|jpg|jpeg|png|webp)$/i)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: Excel, CSV, PDF, Images' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 10MB' },
        { status: 400 }
      );
    }

    // Create job entry
    const jobId = generateJobId();
    const initialJob: IngestionJob = {
      id: jobId,
      fileName: file.name,
      fileType: 'xlsx', // Will be updated by extraction
      fileSizeBytes: file.size,
      status: 'extracting' as IngestionStatus,
      overallConfidence: 0,
      lowConfidenceFields: [],
      createdAt: new Date().toISOString(),
    };
    jobs.set(jobId, initialJob);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Run extraction
    const extractionResult = await extractFromFile(buffer, file.name, file.type);

    // Update job with results
    const completedJob: IngestionJob = {
      ...initialJob,
      ...extractionResult,
      status: extractionResult.extractionErrors?.length ? 'failed' : 'review',
      completedAt: new Date().toISOString(),
    };
    jobs.set(jobId, completedJob);

    return NextResponse.json(completedJob, { status: 201 });
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingest?jobId=xxx
 * Get extraction job status and results.
 * Why: Allows polling for async extraction status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    // Return all jobs (for debugging)
    return NextResponse.json({
      jobs: Array.from(jobs.values()).slice(-10), // Last 10 jobs
    });
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
