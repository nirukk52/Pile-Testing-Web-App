/**
 * PDF Generation Module Exports
 * Why: Provides a clean public API for PDF generation functionality.
 */

export { generatePDF, generatePDFWithPageNumbers, closeBrowser } from './generator';
export type { PDFGeneratorOptions } from './generator';
export { generateIvpltReportHtml } from './templates/ivplt-template';
export type { IvpltReportData } from './templates/ivplt-template';


