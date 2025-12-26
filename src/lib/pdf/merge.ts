/**
 * PDF Merge Utilities
 * Why: Merges multiple PDF files into a single document for field readings attachment.
 */

import { PDFDocument } from 'pdf-lib';
import { getSupabase, STORAGE_BUCKETS } from '@/lib/supabase';

/**
 * Field reading file info for merging.
 * Why: Contains storage path needed to download from Supabase.
 */
interface FieldReadingInfo {
  storagePath: string;
}

/**
 * Download a PDF from Supabase Storage and return as Buffer.
 * Why: Uses authenticated Supabase download instead of public URLs.
 */
async function downloadPdfFromSupabase(
  storagePath: string,
  bucket: string = STORAGE_BUCKETS.FIELD_READINGS
): Promise<Buffer> {
  const { data, error } = await getSupabase()
    .storage
    .from(bucket)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download PDF from ${bucket}/${storagePath}: ${error?.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Merge the main report PDF with additional PDFs (field readings or certificates).
 * Why: Combines the main report with field reading PDFs or calibration certificates using authenticated Supabase downloads.
 * 
 * @param mainPdfBuffer - The main report PDF buffer
 * @param documents - Array of document info with storage paths
 * @param documentType - Type of documents being merged (for logging) - 'field-readings' or 'certificates'
 * @returns Combined PDF as Buffer
 */
export async function mergePdfsFromSupabase(
  mainPdfBuffer: Buffer,
  documents: FieldReadingInfo[],
  documentType: 'field-readings' | 'certificates' = 'field-readings'
): Promise<Buffer> {
  // Load the main PDF
  const mainPdf = await PDFDocument.load(mainPdfBuffer);

  const bucket = documentType === 'certificates' 
    ? STORAGE_BUCKETS.CERTIFICATES 
    : STORAGE_BUCKETS.FIELD_READINGS;

  console.log(`Merging ${documents.length} ${documentType} PDFs...`);

  // Download and merge each document PDF
  for (const doc of documents) {
    try {
      console.log(`Downloading ${documentType} from: ${doc.storagePath}`);
      const pdfBuffer = await downloadPdfFromSupabase(doc.storagePath, bucket);
      const pdfToMerge = await PDFDocument.load(pdfBuffer);
      
      const pageCount = pdfToMerge.getPageCount();
      console.log(`${documentType} document has ${pageCount} pages`);
      
      // Copy all pages from the document PDF
      const copiedPages = await mainPdf.copyPages(
        pdfToMerge,
        pdfToMerge.getPageIndices()
      );
      
      // Add copied pages to the main PDF
      copiedPages.forEach((page) => {
        mainPdf.addPage(page);
      });
      
      console.log(`Successfully merged ${pageCount} pages from ${doc.storagePath}`);
    } catch (error) {
      console.error(`Failed to merge ${documentType} PDF from ${doc.storagePath}:`, error);
      // Continue with other PDFs even if one fails
    }
  }

  // Save the merged PDF
  const mergedPdfBytes = await mainPdf.save();
  console.log(`Final PDF has ${mainPdf.getPageCount()} pages`);
  return Buffer.from(mergedPdfBytes);
}

