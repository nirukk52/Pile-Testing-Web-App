/**
 * PDF Generation Module Exports
 * Why: Provides a clean public API for PDF generation functionality.
 */

export { generatePDF, generatePDFWithPageNumbers, closeBrowser } from './generator';
export type { PDFGeneratorOptions } from './generator';
export { generateIvpltReportHtml } from './templates/ivplt-template';
export type { IvpltReportData } from './templates/ivplt-template';
export { generateRvpltReportHtml } from './templates/rvplt-template';
export type { RvpltReportData } from './templates/rvplt-template';
export { generateLateralReportHtml } from './templates/lateral-template';
export type { LateralReportData } from './templates/lateral-template';
export { generateUpliftReportHtml } from './templates/uplift-template';
export type { UpliftReportData } from './templates/uplift-template';
export { generateChartScript, processReadingsForChart } from './chart-generator';
export type { ProcessedChartData } from './chart-generator';


