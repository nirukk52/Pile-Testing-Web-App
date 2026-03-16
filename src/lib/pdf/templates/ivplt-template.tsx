/**
 * IVPLT Report HTML Template V2
 * Why: Generates professional HTML for PDF conversion matching IS 2911 report format.
 * Updated to match report-generation-v2.md spec with new section structure.
 */

import type { CalculationResult, ReadingInput } from '@/engines';
import { generateChartScript } from '../chart-generator';

/**
 * Site image data for the report.
 */
export interface ReportImage {
  url: string;
  caption?: string;
}

/**
 * Field reading PDF data for the report.
 * Why: Represents uploaded scanned handwritten field sheets to include as reference in report.
 */
export interface FieldReadingFile {
  id: string;
  filename: string;
  url: string;
}

/**
 * Calibration certificate PDF data for the report.
 * Why: Represents uploaded calibration certificates to include as reference in report.
 */
export interface CalibrationCertificateFile {
  id: string;
  filename: string;
  url: string;
}

/**
 * Data structure for IVPLT report generation.
 */
export interface IvpltReportData {
  // Project info
  projectName: string;
  client: string;
  contractor: string;
  pmc?: string;
  location: string;
  
  // Pile info
  pileId: string;
  reportNo?: string;
  testDate: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;
  
  // Equipment
  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;
  
  // Results
  result: CalculationResult;
  readings: ReadingInput[];
  
  // Optional content
  conclusion?: string;
  chartImageBase64?: string;
  
  // Site images (max 4)
  siteImages?: ReportImage[];
  
  // Field readings (uploaded PDFs)
  fieldReadings?: FieldReadingFile[];
  
  // Calibration certificates (uploaded PDFs)
  calibrationCertificates?: CalibrationCertificateFile[];
}

/**
 * Load sequence step for the methodology table.
 * Why: Represents a single row in the load sequence table showing pressure, load, and timing.
 */
interface LoadSequenceStep {
  srNo: number;
  pressureKgCm2: number;
  loadMT: number;
  readingTime: string;
  isUnloading: boolean;
  isMaxHold?: boolean;
}

/**
 * Generate the load sequence table data.
 * Why: Creates the loading and unloading sequence based on IS 2911 requirements.
 * Load increments are 20% of design load, held for specified intervals.
 */
function generateLoadSequence(
  designLoadT: number,
  testLoadT: number,
  ramAreaCm2: number
): LoadSequenceStep[] {
  const steps: LoadSequenceStep[] = [];
  
  // Load increment is 20% of design load
  const incrementT = designLoadT * 0.2;
  
  // Calculate pressure for a given load: pressure = (load × 1000) / ramArea
  const loadToPressure = (loadMT: number): number => {
    return Math.round((loadMT * 1000) / ramAreaCm2);
  };
  
  let srNo = 1;
  
  // Loading phase: 0 to test load
  let currentLoad = 0;
  steps.push({
    srNo: srNo++,
    pressureKgCm2: 0,
    loadMT: 0,
    readingTime: '0',
    isUnloading: false,
  });
  
  currentLoad = incrementT;
  while (currentLoad < testLoadT) {
    steps.push({
      srNo: srNo++,
      pressureKgCm2: loadToPressure(currentLoad),
      loadMT: parseFloat(currentLoad.toFixed(2)),
      readingTime: '1, 15, 30, 45, 60 mins',
      isUnloading: false,
    });
    currentLoad += incrementT;
  }
  
  // Maximum test load with 24-hour hold
  steps.push({
    srNo: srNo++,
    pressureKgCm2: loadToPressure(testLoadT),
    loadMT: parseFloat(testLoadT.toFixed(2)),
    readingTime: '24 hours (1440 mins)',
    isUnloading: false,
    isMaxHold: true,
  });
  
  // Unloading phase: test load back to 0 in same increments
  currentLoad = testLoadT - incrementT;
  while (currentLoad > 0) {
    steps.push({
      srNo: srNo++,
      pressureKgCm2: loadToPressure(currentLoad),
      loadMT: parseFloat(currentLoad.toFixed(2)),
      readingTime: '1, 5, 15 mins',
      isUnloading: true,
    });
    currentLoad -= incrementT;
  }
  
  // Final unload to zero
  steps.push({
    srNo: srNo++,
    pressureKgCm2: 0,
    loadMT: 0,
    readingTime: '1, 5, 15 mins',
    isUnloading: true,
  });
  
  return steps;
}

/**
 * Generate HTML rows for the load sequence table.
 * Why: Separated to avoid nested template literal issues in the main template.
 */
function generateLoadSequenceTableHtml(
  designLoadT: number,
  testLoadT: number,
  ramAreaCm2: number
): string {
  const loadSequence = generateLoadSequence(designLoadT, testLoadT, ramAreaCm2);
  const loadingSteps = loadSequence.filter(s => !s.isUnloading);
  const unloadingSteps = loadSequence.filter(s => s.isUnloading);
  
  let html = '';
  
  // Loading section header
  html += '<tr class="section-header"><td colspan="4">Loading Phase</td></tr>';
  
  // Loading steps
  loadingSteps.forEach((step) => {
    const rowClass = step.isMaxHold ? 'row-max-hold' : 'row-loading';
    html += '<tr class="' + rowClass + '">';
    html += '<td>' + step.srNo + '</td>';
    html += '<td>' + step.pressureKgCm2 + '</td>';
    html += '<td>' + step.loadMT.toFixed(2) + '</td>';
    html += '<td>' + step.readingTime + '</td>';
    html += '</tr>';
  });
  
  // Unloading section header
  html += '<tr class="section-header"><td colspan="4">Unloading Phase</td></tr>';
  
  // Unloading steps
  unloadingSteps.forEach((step) => {
    html += '<tr class="row-unloading">';
    html += '<td>' + step.srNo + '</td>';
    html += '<td>' + step.pressureKgCm2 + '</td>';
    html += '<td>' + step.loadMT.toFixed(2) + '</td>';
    html += '<td>' + step.readingTime + '</td>';
    html += '</tr>';
  });
  
  return html;
}

/**
 * Extended reading input with dial gauge values for observation sheet.
 * Why: The observation sheet needs individual dial gauge readings, not just the average.
 */
interface ExtendedReadingInput extends ReadingInput {
  dialGauge1?: string;
  dialGauge2?: string;
  dialGauge3?: string;
  dialGauge4?: string;
  timestamp?: string;
  pressureGauge?: string;
  remark?: string;
}

/**
 * Generate HTML for the observation sheet table matching data entry style.
 * Why: Creates a field-sheet style table with phase headers and all dial gauge readings.
 */
function generateObservationSheetHtml(readings: ReadingInput[]): string {
  // Cast to extended type if additional fields are available
  const extendedReadings = readings as ExtendedReadingInput[];
  
  // Phase colors matching data entry
  const phaseColors: Record<string, { bg: string; text: string }> = {
    LOADING: { bg: '#2563eb', text: '#ffffff' },
    HOLD: { bg: '#d97706', text: '#ffffff' },
    UNLOADING: { bg: '#16a34a', text: '#ffffff' },
  };
  
  let html = `
    <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
      <thead>
        <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px; min-width: 70px;">DATE</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px; min-width: 60px;">TIME<br/>(Hrs)</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px; min-width: 70px;">PRESSURE<br/>GAUGE<br/>READING<br/>kg/cm²</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px; min-width: 60px;">LOAD<br/>IN MT</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px;" colspan="4">Dial Gauge</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px; min-width: 70px;">AVERAGE<br/>SETTLEMENT<br/>IN MM</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px; min-width: 80px;">REMARK</th>
        </tr>
        <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
          <th colspan="4" style="border: 1px solid #cbd5e1;"></th>
          <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">Reading<br/>1</th>
          <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">Reading<br/>2</th>
          <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">Reading<br/>3</th>
          <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">Reading<br/>4</th>
          <th style="border: 1px solid #cbd5e1;"></th>
          <th style="border: 1px solid #cbd5e1;"></th>
        </tr>
      </thead>
      <tbody>
  `;
  
  let prevPhase: string | null = null;
  let prevLoad: number | null = null;
  let prevDate: string | null = null;
  
  extendedReadings.forEach((reading, index) => {
    const phase = reading.phase;
    const phaseStyle = phaseColors[phase] || phaseColors.LOADING;
    
    // Format date and time from timestamp if available
    let dateStr = '-';
    let timeStr = '-';
    if (reading.timestamp) {
      try {
        const date = new Date(reading.timestamp);
        dateStr = date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          timeZone: 'Asia/Kolkata'
        }).replace(/\//g, '/');
        timeStr = date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false,
          timeZone: 'Asia/Kolkata'
        });
      } catch {
        // Keep defaults
      }
    }
    
    // Show phase header when phase changes
    if (phase !== prevPhase) {
      const phaseName = phase === 'HOLD' ? 'Holding' : phase.charAt(0) + phase.slice(1).toLowerCase();
      html += `
        <tr>
          <td colspan="10" style="background: ${phaseStyle.bg}; color: ${phaseStyle.text}; text-align: center; padding: 6px; font-weight: 600; border: 1px solid #cbd5e1;">
            ${phaseName}
          </td>
        </tr>
      `;
      prevPhase = phase;
    }
    
    // Only show date if it changed
    const showDate = dateStr !== prevDate || index === 0;
    prevDate = dateStr;
    
    // Only show load if it changed
    const loadChanged = prevLoad === null || reading.loadT !== prevLoad;
    prevLoad = reading.loadT;
    
    html += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center; font-weight: ${showDate ? '600' : '400'};">${showDate ? dateStr : ''}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${timeStr}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center; font-weight: 600;">${reading.pressureGauge || '-'}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center; color: #2563eb; font-weight: 600;">${loadChanged ? reading.loadT.toFixed(2) : ''}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${reading.dialGauge1 || '-'}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${reading.dialGauge2 || '-'}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${reading.dialGauge3 || '-'}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${reading.dialGauge4 || '-'}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center; color: #16a34a; font-weight: 600;">${reading.avgSettlementMm.toFixed(2)}</td>
        <td style="border: 1px solid #e2e8f0; padding: 6px; font-size: 8pt; color: #64748b; font-style: italic;">${reading.remark || '-'}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  return html;
}

/**
 * Generate the complete IVPLT report HTML.
 * Why: Creates a professional, printable HTML document for PDF conversion.
 * Structure follows IS 2911 standard report format.
 */
export function generateIvpltReportHtml(data: IvpltReportData): string {
  const {
    projectName,
    client,
    contractor,
    pmc,
    location,
    pileId,
    reportNo,
    testDate,
    pileDiameterMm,
    pileDepthM,
    concreteGrade,
    designLoadT,
    testLoadT,
    jackName,
    ramAreaCm2,
    gaugeLeastCountMm,
    result,
    readings,
    conclusion,
    chartImageBase64,
    siteImages = [],
    fieldReadings = [],
    calibrationCertificates = [],
  } = data;

  const formatDate = (dateStr: string) => {
    try {
      // Avoid timezone drift: if ISO-like input exists, format using date components directly.
      // Example: 2026-01-06T00:00:00+05:30 must render as 06 January 2026 (not 05 Jan in UTC hosts).
      const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]);
        const day = Number(isoMatch[3]);
        const monthName = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ][month - 1];
        if (monthName) return `${String(day).padStart(2, '0')} ${monthName} ${year}`;
      }

      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Get specific images for cover and TOC pages
  const coverImage = siteImages[0];
  const tocImage = siteImages[1];

  // Note: Page numbers are handled dynamically by Puppeteer footer template.
  // TOC uses section numbers only (no static page references).

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IVPLT Report - ${pileId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e293b;
      background: white;
    }
    
    .page {
      page-break-after: always;
      min-height: 100vh;
      padding: 40px;
      position: relative;
    }
    
    .page:last-child {
      page-break-after: auto;
    }

    /* Header on each page */
    .page-header {
      position: absolute;
      top: 15px;
      left: 40px;
      right: 40px;
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    
    /* Cover Page Styles */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
      padding-top: 30px;
    }
    
    .cover-title {
      margin-bottom: 15px;
    }
    
    .cover-title h1 {
      font-size: 22pt;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 1px;
      line-height: 1.2;
      margin-bottom: 8px;
    }
    
    .cover-title h2 {
      font-size: 14pt;
      color: #334155;
      font-weight: 500;
    }
    
    .cover-image {
      width: 85%;
      max-width: 500px;
      height: 320px;
      margin: 15px auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .cover-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .cover-image-placeholder {
      color: #94a3b8;
      font-size: 10pt;
    }
    
    .cover-info {
      text-align: left;
      width: 80%;
      max-width: 450px;
      margin: 12px auto;
    }
    
    .cover-info p {
      margin: 6px 0;
      font-size: 11pt;
    }
    
    .cover-info strong {
      display: inline-block;
      width: 120px;
      color: #64748b;
    }
    
    .cover-badge {
      margin-top: 20px;
      padding: 12px 25px;
      border: 2px solid #1e40af;
      border-radius: 8px;
    }
    
    .cover-badge p {
      font-size: 11pt;
      font-weight: 600;
      color: #1e40af;
    }

    /* TOC Page Styles */
    .toc-page {
      padding-top: 50px;
    }
    
    .toc-title {
      font-size: 16pt;
      color: #1e40af;
      text-align: center;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .toc-list {
      width: 80%;
      max-width: 500px;
      margin: 0 auto 20px;
    }
    
    .toc-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dotted #cbd5e1;
      font-size: 10pt;
    }
    
    .toc-item span:first-child {
      color: #334155;
    }
    
    .toc-item span:last-child {
      color: #64748b;
    }
    
    .toc-image {
      width: 85%;
      max-width: 500px;
      max-height: 400px;
      margin: 15px auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      break-inside: avoid;
    }
    
    .toc-image img {
      width: 100%;
      height: auto;
      max-height: 400px;
      object-fit: contain;
    }
    
    /* Content Page Styles */
    .content-page {
      padding-top: 50px;
    }
    
    .section {
      margin-bottom: 25px;
    }
    
    .section-title {
      font-size: 14pt;
      color: #1e40af;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    
    .section h3 {
      font-size: 12pt;
      color: #334155;
      margin: 15px 0 10px;
    }
    
    .section p {
      margin: 8px 0;
      text-align: justify;
    }
    
    .section ol, .section ul {
      margin-left: 25px;
      margin-top: 10px;
    }
    
    .section li {
      margin-bottom: 8px;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10pt;
    }
    
    th, td {
      border: 1px solid #cbd5e1;
      padding: 10px 12px;
      text-align: left;
    }
    
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #334155;
    }
    
    .specs-table td:first-child {
      width: 50%;
      color: #64748b;
    }
    
    .specs-table td:last-child {
      font-weight: 600;
    }
    
    /* Chart Page - KEY PAGE */
    .chart-page {
      padding-top: 50px;
    }
    
    .chart-container {
      width: 100%;
      margin: 15px 0;
      text-align: center;
      background: #fff;
    }
    
    .chart-container canvas {
      max-width: 100%;
    }
    
    .chart-container img {
      max-width: 100%;
      max-height: 100%;
      border: 2px solid #000;
    }
    
    .chart-kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    
    .chart-kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    
    .chart-kpi .label {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .chart-kpi .value {
      font-size: 20pt;
      font-weight: 700;
      color: #1e293b;
    }
    
    .chart-kpi .unit {
      font-size: 9pt;
      color: #94a3b8;
    }
    
    .chart-summary {
      background: ${result.isPassed ? '#dcfce7' : '#fee2e2'};
      border: 2px solid ${result.isPassed ? '#22c55e' : '#ef4444'};
      border-radius: 8px;
      padding: 15px 20px;
      text-align: center;
      margin-top: 20px;
    }
    
    .chart-summary h3 {
      font-size: 18pt;
      color: ${result.isPassed ? '#166534' : '#991b1b'};
      margin-bottom: 5px;
    }
    
    .chart-summary p {
      font-size: 11pt;
      color: ${result.isPassed ? '#15803d' : '#b91c1c'};
    }
    
    /* Data Table */
    .data-table {
      font-size: 9pt;
    }
    
    .data-table th {
      background: #1e40af;
      color: white;
      font-size: 8pt;
      text-transform: uppercase;
      padding: 8px 6px;
    }
    
    .data-table td {
      padding: 6px;
    }
    
    .data-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .phase-loading { color: #2563eb; font-weight: 600; }
    .phase-hold { color: #d97706; font-weight: 600; }
    .phase-unloading { color: #16a34a; font-weight: 600; }
    
    /* Load Sequence Table Styles */
    .load-sequence-section {
      margin-top: 25px;
    }
    
    .load-sequence-intro {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px 18px;
      margin-bottom: 20px;
    }
    
    .load-sequence-intro p {
      margin: 6px 0;
      font-size: 10pt;
    }
    
    .load-sequence-intro .param-label {
      display: inline-block;
      width: 180px;
      color: #64748b;
      font-weight: 500;
    }
    
    .load-sequence-intro .param-value {
      font-weight: 600;
      color: #1e293b;
    }
    
    .load-sequence-table {
      font-size: 9pt;
      margin-top: 15px;
    }
    
    .load-sequence-table th {
      background: #1e40af;
      color: white;
      font-size: 8pt;
      text-transform: uppercase;
      padding: 8px 10px;
      text-align: center;
    }
    
    .load-sequence-table td {
      padding: 6px 10px;
      text-align: center;
    }
    
    .load-sequence-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .load-sequence-table .row-loading {
      color: #1e293b;
    }
    
    .load-sequence-table .row-max-hold {
      background: #fef3c7 !important;
      font-weight: 600;
      color: #92400e;
    }
    
    .load-sequence-table .row-unloading {
      background: #ecfdf5 !important;
      color: #065f46;
    }
    
    .load-sequence-table .section-header {
      background: #334155 !important;
      color: white;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 8pt;
    }
    
    .signature-column {
      width: 160px;
      text-align: center;
    }
    
    /* Site Images Section */
    .images-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 20px 0;
    }
    
    .image-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .image-card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    
    .image-card .caption {
      padding: 10px;
      font-size: 9pt;
      color: #64748b;
      text-align: center;
      background: #f8fafc;
    }
    
    /* Signature Section */
    .signature-section {
      margin-top: 60px;
    }
    
    .signature-row {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
    }
    
    .signature-box {
      width: 45%;
    }
    
    .signature-box p {
      margin-bottom: 50px;
    }
    
    .signature-line {
      border-top: 1px solid #1e293b;
      padding-top: 5px;
      font-size: 10pt;
    }
    
    @media print {
      .page {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <!-- Page 1: Cover Page -->
  <div class="page cover-page">
    <div class="cover-title">
      <h1>INITIAL STATIC VERTICAL PILE LOAD TEST</h1>
      <h1>ON ${pileDiameterMm}mm DIA PILE</h1>
      <h2>FOR ${projectName}</h2>
      <h2>AT ${location}</h2>
      <p style="margin-top: 15px; font-size: 12pt; color: #64748b;">(TEST PILE ${pileId})</p>
    </div>
    
    <div class="cover-image">
      ${coverImage ? `<img src="${coverImage.url}" alt="Site Image" />` : '<span class="cover-image-placeholder">Site Image</span>'}
    </div>
    
    <div class="cover-info">
      <p><strong>Client:</strong> ${client}</p>
      <p><strong>Contractor:</strong> ${contractor}</p>
      ${pmc ? `<p><strong>PMC:</strong> ${pmc}</p>` : ''}
      <p><strong>Test Date:</strong> ${formatDate(testDate)}</p>
      ${reportNo ? `<p><strong>Report No:</strong> ${reportNo}</p>` : ''}
    </div>
    
    <div class="cover-badge">
      <p>Test conducted as per IS 2911 (Part 4) - 2013</p>
    </div>
  </div>

  <!-- Page 2: Table of Contents -->
  <div class="page toc-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <h1 class="toc-title">Contents</h1>
    
    <div class="toc-list">
      <div class="toc-item"><span>1.0 General</span><span></span></div>
      <div class="toc-item"><span>2.0 Scope of Work</span><span></span></div>
      <div class="toc-item"><span>3.0 Methodology</span><span></span></div>
      <div class="toc-item"><span>4.0 Results</span><span></span></div>
      <div class="toc-item"><span>5.0 Readings and Graph</span><span></span></div>
      <div class="toc-item"><span>6.0 Conclusion</span><span></span></div>
      <div class="toc-item"><span>7.0 Load Test Data</span><span></span></div>
      ${siteImages.length > 0 ? `<div class="toc-item"><span>8.0 Site Images</span><span></span></div>` : ''}
      ${fieldReadings.length > 0 ? `<div class="toc-item"><span>9.0 Field Readings</span><span></span></div>` : ''}
      ${calibrationCertificates.length > 0 ? `<div class="toc-item"><span>10.0 Calibration Certificates</span><span></span></div>` : ''}
    </div>
    
    ${tocImage ? `
    <div class="toc-image">
      <img src="${tocImage.url}" alt="Site Image" />
    </div>
    ` : ''}
  </div>

  <!-- Page 3: General -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">1.0 General</h2>
      <p>
        1.1 ${client} decided to carry out static pile testing work on ${pileDiameterMm}mm diameter pile 
        to estimate load carrying capacity in vertical direction and settlement. This is the Initial 
        Vertical Pile Load Test at ${location}.
      </p>
      <p>
        1.2 This report covers data for one vertical pile load test. This report covers calculation of 
        safe load capacity for pile based on data collected during fieldwork.
      </p>
      <p>
        1.3 The following codes of practices have been adopted:
      </p>
      <ul>
        <li>IS 2911 (Part 4) - 2013 "Code of Practice for Design and Construction of Pile Foundations - Load Tests on Piles"</li>
        <li>IS 14593 - 1998 (Reaffirmed 2003) "Design and Construction of Bored Cast-in-Situ Piles Founded on Rocks – Guidelines"</li>
      </ul>
    </div>
  </div>

  <!-- Page 4: Scope of Work -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">2.0 Scope of Work</h2>
      <p>Pile details are tabulated as below.</p>
      
      <h3>2.1 Pile Details for Initial Pile (Vertical Load Test)</h3>
      <table class="specs-table">
        <tr><td>Location</td><td>${location}</td></tr>
        <tr><td>Pile ID</td><td>${pileId}</td></tr>
        <tr><td>Pile Diameter</td><td>${pileDiameterMm} mm</td></tr>
        <tr><td>Pile Depth</td><td>${pileDepthM} m</td></tr>
        <tr><td>Concrete Grade</td><td>${concreteGrade}</td></tr>
        <tr><td>Maximum Vertical Safe Capacity</td><td>${designLoadT} MT</td></tr>
      </table>
      
      <h3>2.2 Vertical Test Load for Initial Pile</h3>
      <p>The design vertical load on the pile is <strong>${designLoadT} MT</strong>.</p>
      <p>The pile is required to be tested to a load of <strong>${testLoadT} MT</strong> (2.5 × design load).</p>
      
      <h3>2.3 Equipment Details</h3>
      <table class="specs-table">
        <tr><td>Hydraulic Jack</td><td>${jackName || 'As per site specifications'}</td></tr>
        <tr><td>Ram Area</td><td>${ramAreaCm2} cm²</td></tr>
        <tr><td>Dial Gauge Least Count</td><td>${gaugeLeastCountMm} mm</td></tr>
      </table>
    </div>
  </div>

  <!-- Page 5: Methodology -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">3.0 Methodology</h2>
      <p>
        The Initial Vertical Pile Load Test was conducted in accordance with IS 2911 (Part 4) - 2013 
        "Code of Practice for Design and Construction of Pile Foundations - Load Test on Piles".
      </p>
      
      <h3>3.1 Test Setup</h3>
      <p>
        A hydraulic jack of adequate capacity was used to apply the load, reacting against a sturdy 
        reaction frame. Four dial gauges (${gaugeLeastCountMm} mm least count) were fixed on the pile head 
        to record settlements.
      </p>
      
      <h3>3.2 Test Procedure</h3>
      <ol>
        <li>Load was applied in increments of approximately 20% of design load (${(designLoadT * 0.2).toFixed(1)} MT) up to the test load of ${testLoadT} MT.</li>
        <li>Each load increment was maintained until the rate of settlement was less than 0.1mm/hour, or for a minimum of 1 hour.</li>
        <li>Maximum load was maintained for 24 hours as per IS 2911 requirements for initial tests.</li>
        <li>Load was released in the same increments as the loading phase.</li>
        <li>Settlement readings were recorded at each load increment using four dial gauges positioned at 90° intervals.</li>
      </ol>
      
      <h3>3.3 Acceptance Criteria (IS 2911 Part 4)</h3>
      <p>As per IS 2911 (Part 4) - 2013, the acceptance criteria for Initial Vertical Pile Load Test are:</p>
      <ol>
        <li>Net settlement at design load shall not exceed 12mm or 2% of pile diameter (${(0.02 * pileDiameterMm).toFixed(1)}mm), whichever is less.</li>
        <li>Safe load shall be taken as two-thirds of the load at which total settlement equals 12mm.</li>
        <li>Safe load shall not exceed half the load at which total settlement equals 10% of pile diameter (${(0.1 * pileDiameterMm).toFixed(1)}mm).</li>
      </ol>
    </div>
  </div>

  <!-- Page 6: Load Increment Summary / Load Sequence -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">3.4 Load Increment Summary</h2>
      
      <div class="load-sequence-intro">
        <p><span class="param-label">Jack Ram Area:</span> <span class="param-value">${ramAreaCm2} cm²</span></p>
        <p><span class="param-label">Design Load:</span> <span class="param-value">${designLoadT} MT</span></p>
        <p><span class="param-label">Test Load (2.5× Design):</span> <span class="param-value">${testLoadT} MT</span></p>
        <p><span class="param-label">Load Increment (20% of Design):</span> <span class="param-value">${(designLoadT * 0.2).toFixed(1)} MT</span></p>
        <p style="margin-top: 10px; font-size: 9pt; color: #64748b; font-style: italic;">
          Note: As the least count of the pressure gauge is limited, exact incremental loads may not be attained. 
          Hence, values close to the incremental load are considered.
        </p>
      </div>
      
      <h3>Table 1 – Load Sequence</h3>
      <p style="margin-bottom: 10px; font-size: 10pt;">
        The sequence of loading and unloading shall be as described below for 
        <strong>IVPLT on ${pileDiameterMm}mm Dia Pile (${designLoadT} MT Design Load)</strong>.
      </p>
      
      <table class="load-sequence-table">
        <thead>
          <tr>
            <th style="width: 50px;">Sr. No.</th>
            <th style="width: 100px;">Pressure (kg/cm²)</th>
            <th style="width: 100px;">Load (MT)</th>
            <th>Reading Time</th>
          </tr>
        </thead>
        <tbody>
          ${generateLoadSequenceTableHtml(designLoadT, testLoadT, ramAreaCm2)}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Page 7: Results -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">4.0 Results</h2>
      
      <h3>4.1 Test Results Summary</h3>
      <table class="specs-table">
        <tr><td>Maximum Settlement Recorded</td><td>${result.maxSettlementMm.toFixed(2)} mm</td></tr>
        <tr><td>Elastic Rebound</td><td>${result.elasticReboundMm.toFixed(2)} mm</td></tr>
        <tr><td>Net Settlement (Max - Rebound)</td><td>${result.netSettlementMm.toFixed(2)} mm</td></tr>
        <tr><td>Settlement Limit (IS 2911)</td><td>${result.settlementLimitMm} mm</td></tr>
        <tr><td>Safe Load Adopted</td><td>${result.safeLoadAdoptedT.toFixed(1)} MT</td></tr>
        <tr><td>Governing Criterion</td><td>${result.governingCriterion}</td></tr>
        <tr><td>Test Status</td><td style="color: ${result.isPassed ? '#16a34a' : '#dc2626'}; font-weight: bold;">${result.isPassed ? 'PASSED' : 'FAILED'}</td></tr>
      </table>
      
      <h3>4.2 Assessment</h3>
      <p>
        The net settlement of ${result.netSettlementMm.toFixed(2)} mm is 
        ${result.netSettlementMm <= result.settlementLimitMm ? 'within' : 'exceeding'} 
        the permissible limit of ${result.settlementLimitMm} mm as per IS 2911 (Part 4) - 2013.
      </p>
      <p>
        The safe load adopted for the pile is <strong>${result.safeLoadAdoptedT.toFixed(1)} MT</strong> 
        based on the ${result.governingCriterion.toLowerCase()} criterion.
      </p>
    </div>
  </div>

  <!-- Page 7: Chart Page (KEY PAGE) -->
  <div class="page chart-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">5.0 Load vs Settlement Curve</h2>
      
      <div class="chart-container" style="border: 2px solid #000; padding: 2px; background: #fff; min-height: 400px; height: 450px;">
        <canvas id="loadSettlementChart" style="width: 100%; height: 100%;"></canvas>
      </div>
      
      ${generateChartScript(readings)}
      
      <div style="text-align: center; margin-top: 8px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <p style="font-size: 11pt; font-weight: 600; color: #1e293b; margin: 0;">
          Maximum Settlement at ${Math.max(...readings.map(r => r.loadT)).toFixed(2)} T: ${result.maxSettlementMm.toFixed(2)} mm
        </p>
      </div>
      
      <div class="chart-kpi-grid" style="grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0;">
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Test Load</div>
          <div class="value" style="font-size: 16pt;">${testLoadT.toFixed(1)}</div>
          <div class="unit">MT</div>
        </div>
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Max Settlement</div>
          <div class="value" style="font-size: 16pt;">${result.maxSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Net Settlement</div>
          <div class="value" style="font-size: 16pt;">${result.netSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Total Rebound</div>
          <div class="value" style="font-size: 16pt;">${result.elasticReboundMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
      </div>
      
      <div class="chart-summary" style="padding: 10px 15px; margin-top: 10px;">
        <h3 style="font-size: 14pt;">TEST ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</h3>
        <p style="font-size: 10pt;">Net settlement ${result.netSettlementMm.toFixed(2)}mm is ${result.netSettlementMm <= result.settlementLimitMm ? 'within' : 'exceeding'} the ${result.settlementLimitMm}mm limit (IS 2911 Part 4)</p>
      </div>
    </div>
  </div>

  <!-- Page 8: Loading/Unloading Deflection Summary -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">5.1 Record of Pile Load Test</h2>
      
      <div style="display: flex; gap: 30px; margin-top: 20px;">
        <!-- Loading Table -->
        <div style="flex: 1;">
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 10px; text-transform: uppercase;">Loading</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
            <thead>
              <tr>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Load<br/>(T)</th>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Average<br/>Deflection<br/>(mm)</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                // Loading table should use only LOADING rows, plus final HOLD row at max load.
                const loadingOnly = readings.filter(r => r.phase === 'LOADING');
                const loadingByLoad: Record<string, number> = {};
                loadingOnly.forEach(r => {
                  const loadKey = r.loadT.toFixed(2);
                  loadingByLoad[loadKey] = r.avgSettlementMm;
                });

                // Replace max-load point with end-of-hold value when HOLD exists.
                const holdRows = readings.filter(r => r.phase === 'HOLD');
                if (holdRows.length > 0) {
                  const maxLoad = Math.max(...loadingOnly.map(r => r.loadT));
                  const endHold = holdRows[holdRows.length - 1];
                  loadingByLoad[maxLoad.toFixed(2)] = endHold.avgSettlementMm;
                }

                const loadingData = Object.entries(loadingByLoad)
                  .map(([load, settlement]) => ({ load: parseFloat(load), settlement }))
                  .sort((a, b) => a.load - b.load);
                return loadingData.map(d => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.load.toFixed(2)}</td>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.settlement.toFixed(2)}</td>
                  </tr>
                `).join('');
              })()}
            </tbody>
          </table>
        </div>
        
        <!-- Unloading Table -->
        <div style="flex: 1;">
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 10px; text-transform: uppercase;">Unloading</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
            <thead>
              <tr>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Load<br/>(T)</th>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Average<br/>Deflection<br/>(mm)</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const unloadingReadings = readings.filter(r => r.phase === 'UNLOADING');
                const unloadingByLoad: Record<string, number> = {};
                unloadingReadings.forEach(r => {
                  const loadKey = r.loadT.toFixed(2);
                  unloadingByLoad[loadKey] = r.avgSettlementMm;
                });
                const unloadingData = Object.entries(unloadingByLoad)
                  .map(([load, settlement]) => ({ load: parseFloat(load), settlement }))
                  .sort((a, b) => b.load - a.load);
                return unloadingData.map(d => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.load.toFixed(2)}</td>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.settlement.toFixed(2)}</td>
                  </tr>
                `).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Page 9: Conclusion -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">6.0 Conclusion</h2>
      ${conclusion ? `<p>${conclusion}</p>` : `
        <p>
          Based on the Initial Vertical Pile Load Test conducted on pile ${pileId} at ${location}, 
          the following observations and conclusions are drawn:
        </p>
        <ol>
          <li>The pile was loaded up to ${testLoadT.toFixed(1)} MT (2.5 times the design load of ${designLoadT} MT) as per IS 2911 (Part 4) - 2013.</li>
          <li>The maximum settlement recorded at test load was ${result.maxSettlementMm.toFixed(2)} mm.</li>
          <li>After complete unloading, the elastic rebound was ${result.elasticReboundMm.toFixed(2)} mm.</li>
          <li>The net settlement (residual) is ${result.netSettlementMm.toFixed(2)} mm, which is ${result.netSettlementMm <= result.settlementLimitMm ? 'within' : 'exceeding'} the permissible limit of ${result.settlementLimitMm} mm.</li>
          <li>The safe load adopted for the pile is ${result.safeLoadAdoptedT.toFixed(1)} MT based on the ${result.governingCriterion.toLowerCase()} criterion.</li>
          <li><strong>The pile ${result.isPassed ? 'HAS PASSED' : 'HAS FAILED'} the Initial Vertical Pile Load Test as per IS 2911 (Part 4) - 2013.</strong></li>
        </ol>
        ${result.isPassed ? `
          <p style="margin-top: 20px;">
            Therefore, the design safe load of ${designLoadT} MT can be adopted as the working load capacity for this pile.
          </p>
        ` : `
          <p style="margin-top: 20px; color: #dc2626;">
            Further investigation and remedial measures are recommended before adopting the design load.
          </p>
        `}
      `}
    </div>
  </div>

  <!-- Page 9+: Observation Sheet - Field Sheet Style -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">7.0 Observation Sheet</h2>
      <p style="font-size: 10pt; color: #64748b; margin-bottom: 15px;">Load increment readings as per IS 2911 (Part 4)</p>
      
      ${generateObservationSheetHtml(readings)}
    </div>
  </div>

  ${siteImages.length > 0 ? `
  <!-- Site Images Page - Full A4 page divided into 4 equal quadrants -->
  <div class="page" style="padding: 0; margin: 0; height: 100vh; box-sizing: border-box; overflow: hidden;">
    <!-- Page header -->
    <div style="position: absolute; top: 15px; left: 40px; right: 40px; display: flex; justify-content: space-between; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; z-index: 10;">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <!-- Section title -->
    <div style="position: absolute; top: 45px; left: 40px; right: 40px; z-index: 10;">
      <h2 style="font-size: 14pt; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin: 0;">8.0 Site Images</h2>
    </div>
    
    <!-- 2x2 Grid - Fixed height to fit A4 page (842pt height - header/title/margins) -->
    <div style="position: absolute; top: 90px; left: 40px; right: 40px; bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px;">
      ${[0, 1, 2, 3].map(idx => {
        const img = siteImages[idx];
        return `
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; background: #f8fafc;">
            ${img ? `
              <div style="flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 8px; min-height: 0;">
                <img src="${img.url}" alt="Site Image ${idx + 1}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
              </div>
              <div style="padding: 6px 8px; font-size: 8pt; color: #475569; text-align: center; background: #e2e8f0; border-top: 1px solid #cbd5e1; flex-shrink: 0;">
                ${img.caption || `Image ${idx + 1}`}
              </div>
            ` : `
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10pt;">
                No Image
              </div>
            `}
          </div>
        `;
      }).join('')}
    </div>
  </div>
  ` : ''}

  ${fieldReadings.length > 0 ? `
  <!-- Field Readings Reference Page -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section" style="display: flex; align-items: center; justify-content: center; min-height: 60vh;">
      <div style="text-align: center; max-width: 600px;">
        <h2 class="section-title" style="text-align: center; margin-bottom: 30px;">9.0 Field Readings</h2>
        <p style="font-size: 12pt; line-height: 1.8; color: #334155;">
          This section contains the original field recording sheets that were used to record the test data during execution. 
          These scanned documents serve as supporting evidence for the test results presented in this report.
        </p>
      </div>
    </div>
  </div>
  ` : ''}

  ${calibrationCertificates.length > 0 ? `
  <!-- Calibration Certificates Reference Page -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section" style="display: flex; align-items: center; justify-content: center; min-height: 60vh;">
      <div style="text-align: center; max-width: 600px;">
        <h2 class="section-title" style="text-align: center; margin-bottom: 30px;">10.0 Calibration Certificates</h2>
        <p style="font-size: 12pt; line-height: 1.8; color: #334155;">
          This section contains the calibration certificates for the equipment used during the pile load test. 
          These certificates verify that all measuring instruments were properly calibrated and meet the required standards.
        </p>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Signature Page -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="signature-section">
      <div class="signature-row">
        <div class="signature-box">
          <p>Prepared by:</p>
          <div class="signature-line">Site Engineer</div>
        </div>
        <div class="signature-box" style="text-align: right;">
          <p>Checked by:</p>
          <div class="signature-line">Quality Engineer</div>
        </div>
      </div>
      
      <div class="signature-row">
        <div class="signature-box">
          <p>Reviewed by:</p>
          <div class="signature-line">Project Manager</div>
        </div>
        <div class="signature-box" style="text-align: right;">
          <p>Approved by:</p>
          <div class="signature-line">Client Representative</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
