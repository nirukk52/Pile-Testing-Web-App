/**
 * OCR API client for extracting data from field sheet images.
 * Why: Abstracts the HTTP calls to the Python OCR server,
 * providing a clean interface for the upload page.
 */

import type { ProjectInfo, ExtractedReading, OCRValue } from '@/types';

/** Base URL for the OCR server */
const OCR_SERVER_URL = process.env.NEXT_PUBLIC_OCR_SERVER_URL || 'http://localhost:8000';

/**
 * Raw response from the OCR server.
 * Why: Matches the Python server's response format before transformation.
 */
interface RawOCRResponse {
  project_info: Record<string, { value: string | number | null; confidence: number }>;
  readings: Array<Record<string, { value: string | number | null; confidence: number }>>;
  page_count: number;
  total_readings: number;
}

/**
 * Transform raw project info from API to typed ProjectInfo.
 * Why: Maps Python snake_case field names to TypeScript camelCase.
 */
function transformProjectInfo(raw: RawOCRResponse['project_info']): ProjectInfo {
  /**
   * Helper to extract and transform a single field.
   * Why: Reduces repetition and ensures consistent null handling.
   */
  const getField = (snakeKey: string): OCRValue<string | null> => {
    const rawValue = raw[snakeKey];
    return {
      value: rawValue?.value?.toString() ?? null,
      confidence: rawValue?.confidence ?? 0,
    };
  };

  return {
    testNo: getField('test_no'),
    project: getField('project'),
    location: getField('location'),
    contractor: getField('contractor'),
    clientName: getField('client_name'),
    pileDiameter: getField('pile_diameter'),
    designLoad: getField('design_load'),
    testLoad: getField('test_load'),
    ramArea: getField('ram_area'),
    dateOfCasting: getField('date_of_casting'),
    pileDepth: getField('pile_depth'),
    lcDialGauge: getField('lc_dial_gauge'),
    testType: getField('test_type'),
    mixedDesign: getField('mixed_design'),
  };
}

/**
 * Transform raw readings from API to typed ExtractedReading[].
 * Why: Adds unique IDs and converts types for TypeScript.
 */
function transformReadings(raw: RawOCRResponse['readings']): ExtractedReading[] {
  return raw.map((reading, index) => ({
    id: `reading-${index}-${Date.now()}`,
    date: {
      value: reading.date?.value?.toString() ?? null,
      confidence: reading.date?.confidence ?? 0,
    },
    time: {
      value: reading.time?.value?.toString() ?? null,
      confidence: reading.time?.confidence ?? 0,
    },
    pressure: {
      value: typeof reading.pressure?.value === 'number' ? reading.pressure.value : null,
      confidence: reading.pressure?.confidence ?? 0,
    },
    gauge1: {
      value: typeof reading.gauge1?.value === 'number' ? reading.gauge1.value : null,
      confidence: reading.gauge1?.confidence ?? 0,
    },
    gauge2: {
      value: typeof reading.gauge2?.value === 'number' ? reading.gauge2.value : null,
      confidence: reading.gauge2?.confidence ?? 0,
    },
    gauge3: {
      value: typeof reading.gauge3?.value === 'number' ? reading.gauge3.value : null,
      confidence: reading.gauge3?.confidence ?? 0,
    },
    gauge4: {
      value: typeof reading.gauge4?.value === 'number' ? reading.gauge4.value : null,
      confidence: reading.gauge4?.confidence ?? 0,
    },
    remark: {
      value: reading.remark?.value?.toString() ?? null,
      confidence: reading.remark?.confidence ?? 1,
    },
  }));
}

/**
 * Result from OCR extraction.
 * Why: Provides typed response with transformed data.
 */
export interface ExtractResult {
  projectInfo: ProjectInfo;
  readings: ExtractedReading[];
  pageCount: number;
  totalReadings: number;
}

/**
 * Extract readings from uploaded files using OCR.
 * Why: Main function called by the upload page to process field sheets.
 * 
 * @param files - Array of File objects (images or PDFs)
 * @returns Extracted project info and readings with confidence scores
 * @throws Error if OCR server is unavailable or extraction fails
 */
export async function extractReadings(files: File[]): Promise<ExtractResult> {
  if (files.length === 0) {
    throw new Error('No files provided for extraction');
  }

  // Build form data with all files
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  try {
    const response = await fetch(`${OCR_SERVER_URL}/extract`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `OCR extraction failed with status ${response.status}`
      );
    }

    const data: RawOCRResponse = await response.json();

    return {
      projectInfo: transformProjectInfo(data.project_info),
      readings: transformReadings(data.readings),
      pageCount: data.page_count,
      totalReadings: data.total_readings,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        'Cannot connect to OCR server. Please ensure the server is running at ' +
          OCR_SERVER_URL
      );
    }
    throw error;
  }
}

/**
 * Check if the OCR server is available.
 * Why: Allows UI to show server status before user attempts extraction.
 */
export async function checkOCRServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OCR_SERVER_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

