/**
 * Extraction Agent
 * Why: Routes uploaded files to the appropriate parser based on file type.
 * Handles Excel files directly, uses Vision API for scanned PDFs/images.
 * Uses shared extraction-config for consistent rules across all parsers.
 */

import type {
  IngestionJob,
  IngestionFileType,
  ExtractionMethod,
  ExtractedProjectInfo,
  ExtractedReading,
} from '@/types';
import { parseExcelBuffer, validateExtractedReadings } from '@/lib/parsers/excel-parser';
import { buildVisionExtractionPrompt } from '@/lib/parsers/extraction-config';
import OpenAI from 'openai';

/**
 * Detects file type from file name and MIME type.
 * Why: Routes to correct parser based on file format.
 */
export function detectFileType(fileName: string, mimeType?: string): IngestionFileType {
  const ext = fileName.toLowerCase().split('.').pop();

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'image';

  // Fallback to MIME type
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'xlsx';
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.startsWith('image/')) return 'image';

  return 'xlsx'; // Default to Excel
}

/**
 * Determines extraction method based on file type.
 * Why: Different file types need different processing approaches.
 */
export function getExtractionMethod(fileType: IngestionFileType): ExtractionMethod {
  switch (fileType) {
    case 'xlsx':
    case 'csv':
      return 'excel';
    case 'pdf':
    case 'image':
      return 'vision';
    default:
      return 'excel';
  }
}

/**
 * Main extraction function - processes any supported file type.
 * Why: Single entry point for all file extraction regardless of format.
 */
export async function extractFromFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<Omit<IngestionJob, 'id' | 'createdAt' | 'status'>> {
  const fileType = detectFileType(fileName, mimeType);
  const extractionMethod = getExtractionMethod(fileType);

  const baseResult = {
    fileName,
    fileType,
    fileSizeBytes: fileBuffer.length,
    extractionMethod,
    lowConfidenceFields: [] as string[],
  };

  try {
    if (extractionMethod === 'excel') {
      // Direct Excel parsing - fast and reliable
      const result = parseExcelBuffer(fileBuffer, fileName);
      const warnings = result.extractedReadings
        ? validateExtractedReadings(result.extractedReadings)
        : [];

      return {
        ...baseResult,
        extractedProjectInfo: result.extractedProjectInfo,
        extractedReadings: result.extractedReadings,
        overallConfidence: result.overallConfidence,
        lowConfidenceFields: [...result.lowConfidenceFields, ...warnings],
      };
    } else {
      // Vision API for PDFs and images
      const result = await extractWithVisionAPI(fileBuffer, fileName, mimeType);
      return {
        ...baseResult,
        ...result,
      };
    }
  } catch (error) {
    console.error('Extraction failed:', error);
    return {
      ...baseResult,
      overallConfidence: 0,
      extractionErrors: [error instanceof Error ? error.message : 'Unknown extraction error'],
      lowConfidenceFields: ['Extraction failed - please try again or enter data manually'],
    };
  }
}

/**
 * Extracts data from PDF/image using OpenAI Vision API.
 * Why: Handles scanned documents and photos of handwritten field sheets.
 */
async function extractWithVisionAPI(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<{
  extractedProjectInfo?: ExtractedProjectInfo;
  extractedReadings?: ExtractedReading[];
  overallConfidence: number;
  lowConfidenceFields: string[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey });

  // Convert buffer to base64 for Vision API
  const base64Image = fileBuffer.toString('base64');
  const imageMediaType = mimeType || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

  // Use shared prompt from extraction-config for consistency
  const systemPrompt = buildVisionExtractionPrompt();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageMediaType};base64,${base64Image}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Extract all pile test data from this document. Return JSON only.',
            },
          ],
        },
      ],
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Vision API');
    }

    const parsed = JSON.parse(content);
    return transformVisionResponse(parsed);
  } catch (error) {
    console.error('Vision API error:', error);
    throw new Error(`Vision extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transforms Vision API response to our standard format.
 * Why: Normalizes AI output to match our type definitions.
 */
function transformVisionResponse(response: {
  projectInfo?: Record<string, string>;
  readings?: Array<Record<string, string>>;
  confidence?: number;
  notes?: string;
}): {
  extractedProjectInfo?: ExtractedProjectInfo;
  extractedReadings?: ExtractedReading[];
  overallConfidence: number;
  lowConfidenceFields: string[];
} {
  const confidence = response.confidence || 70;
  const lowConfidenceFields: string[] = [];

  if (response.notes) {
    lowConfidenceFields.push(response.notes);
  }

  // Transform project info
  const extractedProjectInfo: ExtractedProjectInfo = {};
  if (response.projectInfo) {
    const pi = response.projectInfo;
    if (pi.pileId) extractedProjectInfo.pileId = { value: pi.pileId, confidence };
    if (pi.project) extractedProjectInfo.project = { value: pi.project, confidence };
    if (pi.location) extractedProjectInfo.location = { value: pi.location, confidence };
    if (pi.client) extractedProjectInfo.client = { value: pi.client, confidence };
    if (pi.contractor) extractedProjectInfo.contractor = { value: pi.contractor, confidence };
    if (pi.pileDiameter) extractedProjectInfo.pileDiameter = { value: pi.pileDiameter, confidence };
    if (pi.pileDepth) extractedProjectInfo.pileDepth = { value: pi.pileDepth, confidence };
    if (pi.designLoad) extractedProjectInfo.designLoad = { value: pi.designLoad, confidence };
    if (pi.ramArea) extractedProjectInfo.ramArea = { value: pi.ramArea, confidence };
  }

  // Transform readings
  const extractedReadings: ExtractedReading[] = [];
  if (response.readings) {
    response.readings.forEach((r, index) => {
      extractedReadings.push({
        rowIndex: index,
        pressureGauge: { value: r.pressure || '0', confidence },
        dialGauge1: { value: r.dg1 || '0', confidence },
        dialGauge2: { value: r.dg2 || '0', confidence },
        dialGauge3: { value: r.dg3 || '0', confidence },
        dialGauge4: { value: r.dg4 || '0', confidence },
        phase: r.phase ? { value: r.phase, confidence } : undefined,
        timestamp: r.time ? { value: r.time, confidence } : undefined,
        remark: r.remark ? { value: r.remark, confidence } : undefined,
      });
    });
  }

  // Mark low confidence if below threshold
  if (confidence < 80) {
    lowConfidenceFields.push('Overall extraction confidence below 80% - please review all values');
  }

  return {
    extractedProjectInfo: Object.keys(extractedProjectInfo).length > 0 ? extractedProjectInfo : undefined,
    extractedReadings,
    overallConfidence: confidence,
    lowConfidenceFields,
  };
}
