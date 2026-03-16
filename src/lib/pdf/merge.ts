/**
 * PDF Merge Utilities
 * Why: Merges multiple PDF files into a single document for field readings attachment.
 */

import { PDFDocument } from 'pdf-lib';
import { downloadFile, STORAGE_BUCKETS } from '@/lib/storage';

/**
 * Field reading file info for merging.
 * Why: Contains storage path needed to locate the file on disk.
 */
interface FieldReadingInfo {
  storagePath: string;
}

/**
 * Merge the main report PDF with additional PDFs (field readings or certificates).
 * Why: Combines the main report with field reading PDFs or calibration certificates.
 * 
 * @param mainPdfBuffer - The main report PDF buffer
 * @param documents - Array of document info with storage paths
 * @param documentType - Type of documents being merged (for logging)
 * @returns Combined PDF as Buffer
 */
export async function mergePdfs(
  mainPdfBuffer: Buffer,
  documents: FieldReadingInfo[],
  documentType: 'field-readings' | 'certificates' = 'field-readings'
): Promise<Buffer> {
  const mainPdf = await PDFDocument.load(mainPdfBuffer);

  const bucket = documentType === 'certificates' 
    ? STORAGE_BUCKETS.CERTIFICATES 
    : STORAGE_BUCKETS.FIELD_READINGS;

  console.log(`Merging ${documents.length} ${documentType} PDFs...`);

  for (const doc of documents) {
    try {
      console.log(`Reading ${documentType} from: ${doc.storagePath}`);
      const pdfBuffer = await downloadFile(bucket, doc.storagePath);
      const pdfToMerge = await PDFDocument.load(pdfBuffer);
      
      const pageCount = pdfToMerge.getPageCount();
      console.log(`${documentType} document has ${pageCount} pages`);
      
      const copiedPages = await mainPdf.copyPages(
        pdfToMerge,
        pdfToMerge.getPageIndices()
      );
      
      copiedPages.forEach((page) => {
        mainPdf.addPage(page);
      });
      
      console.log(`Successfully merged ${pageCount} pages from ${doc.storagePath}`);
    } catch (error) {
      console.error(`Failed to merge ${documentType} PDF from ${doc.storagePath}:`, error);
    }
  }

  const mergedPdfBytes = await mainPdf.save();
  console.log(`Final PDF has ${mainPdf.getPageCount()} pages`);
  return Buffer.from(mergedPdfBytes);
}

/**
 * @deprecated Use mergePdfs instead. Kept for backward compatibility during migration.
 */
export const mergePdfsFromSupabase = mergePdfs;
