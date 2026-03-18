/**
 * Uplift / Pullout Pile Load Test Report HTML Template
 * Why: Generates professional HTML for PDF conversion matching IS 2911 Clause 9.4 report format.
 * Follows same structure as IVPLT template with uplift-specific terminology and acceptance criteria.
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
 * Data structure for Uplift report generation.
 * Why: Same fields as IvpltReportData; CalculationResult reuses settlement field names for uplift displacement.
 */
export interface UpliftReportData {
  projectName: string;
  client: string;
  contractor: string;
  pmc?: string;
  location: string;
  pileId: string;
  reportNo?: string;
  testDate: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;
  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;
  result: CalculationResult;
  readings: ReadingInput[];
  conclusion?: string;
  chartImageBase64?: string;
  siteImages?: ReportImage[];
  fieldReadings?: FieldReadingFile[];
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

function generateLoadSequence(
  designLoadT: number,
  testLoadT: number,
  ramAreaCm2: number
): LoadSequenceStep[] {
  const steps: LoadSequenceStep[] = [];
  const incrementT = designLoadT * 0.2;
  const loadToPressure = (loadMT: number): number =>
    Math.round((loadMT * 1000) / ramAreaCm2);
  let srNo = 1;

  steps.push({ srNo: srNo++, pressureKgCm2: 0, loadMT: 0, readingTime: '0', isUnloading: false });
  let currentLoad = incrementT;
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
  steps.push({
    srNo: srNo++,
    pressureKgCm2: loadToPressure(testLoadT),
    loadMT: parseFloat(testLoadT.toFixed(2)),
    readingTime: '24 hours (1440 mins)',
    isUnloading: false,
    isMaxHold: true,
  });
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
  steps.push({ srNo: srNo++, pressureKgCm2: 0, loadMT: 0, readingTime: '1, 5, 15 mins', isUnloading: true });
  return steps;
}

function generateLoadSequenceTableHtml(
  designLoadT: number,
  testLoadT: number,
  ramAreaCm2: number
): string {
  const loadSequence = generateLoadSequence(designLoadT, testLoadT, ramAreaCm2);
  const loadingSteps = loadSequence.filter((s) => !s.isUnloading);
  const unloadingSteps = loadSequence.filter((s) => s.isUnloading);
  let html = '';
  html += '<tr class="section-header"><td colspan="4">Loading Phase</td></tr>';
  loadingSteps.forEach((step) => {
    const rowClass = step.isMaxHold ? 'row-max-hold' : 'row-loading';
    html += '<tr class="' + rowClass + '">';
    html += '<td>' + step.srNo + '</td>';
    html += '<td>' + step.pressureKgCm2 + '</td>';
    html += '<td>' + step.loadMT.toFixed(2) + '</td>';
    html += '<td>' + step.readingTime + '</td>';
    html += '</tr>';
  });
  html += '<tr class="section-header"><td colspan="4">Unloading Phase</td></tr>';
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
 * Generate HTML for the observation sheet table with uplift column label.
 * Why: Creates a field-sheet style table identical to IVPLT but with "Uplift" terminology.
 */
function generateObservationSheetHtml(readings: ReadingInput[]): string {
  const extendedReadings = readings as ExtendedReadingInput[];
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
          <th style="border: 1px solid #cbd5e1; padding: 8px 6px; min-width: 70px;">AVERAGE<br/>UPLIFT<br/>IN MM</th>
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
    let dateStr = '-';
    let timeStr = '-';
    if (reading.timestamp) {
      try {
        const date = new Date(reading.timestamp);
        dateStr = date
          .toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Kolkata',
          })
          .replace(/\//g, '/');
        timeStr = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        });
      } catch {
        // Keep defaults
      }
    }
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
    const showDate = dateStr !== prevDate || index === 0;
    prevDate = dateStr;
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
        <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center; color: #16a34a; font-weight: 600;">${(reading.avgSettlementMm ?? 0).toFixed(2)}</td>
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
 * Generate the complete Uplift report HTML.
 * Why: Creates a professional, printable HTML document for PDF conversion per IS 2911 Clause 9.4.
 */
export function generateUpliftReportHtml(data: UpliftReportData): string {
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
    siteImages = [],
    fieldReadings = [],
    calibrationCertificates = [],
  } = data;

  const formatDate = (dateStr: string) => {
    try {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]);
        const day = Number(isoMatch[3]);
        const name = monthNames[month - 1];
        if (name) return `${String(day).padStart(2, '0')} ${name} ${year}`;
      }
      const dmyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (dmyMatch) {
        const day = Number(dmyMatch[1]);
        const month = Number(dmyMatch[2]);
        const year = Number(dmyMatch[3]);
        const name = monthNames[month - 1];
        if (name) return `${String(day).padStart(2, '0')} ${name} ${year}`;
      }
      const shortMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
      if (shortMatch) {
        const day = Number(shortMatch[1]);
        const month = Number(shortMatch[2]);
        const year = 2000 + Number(shortMatch[3]);
        const name = monthNames[month - 1];
        if (name) return `${String(day).padStart(2, '0')} ${name} ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const coverImage = siteImages[0];
  const tocImage = siteImages[1];
  const reportLabel = 'Uplift Load Test';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportLabel} - ${pileId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; background: white; }
    .page { page-break-after: always; min-height: 100vh; padding: 40px; position: relative; }
    .page:last-child { page-break-after: auto; }
    .page-header { position: absolute; top: 15px; left: 40px; right: 40px; display: flex; justify-content: space-between; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .cover-page { display: flex; flex-direction: column; justify-content: flex-start; align-items: center; text-align: center; padding-top: 30px; }
    .cover-title { margin-bottom: 15px; }
    .cover-title h1 { font-size: 22pt; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; line-height: 1.2; margin-bottom: 8px; }
    .cover-title h2 { font-size: 14pt; color: #334155; font-weight: 500; }
    .cover-image { width: 85%; max-width: 500px; height: 320px; margin: 15px auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; }
    .cover-image img { width: 100%; height: 100%; object-fit: contain; }
    .cover-image-placeholder { color: #94a3b8; font-size: 10pt; }
    .cover-info { text-align: left; width: 80%; max-width: 450px; margin: 12px auto; }
    .cover-info p { margin: 6px 0; font-size: 11pt; }
    .cover-info strong { display: inline-block; width: 120px; color: #64748b; }
    .cover-badge { margin-top: 20px; padding: 12px 25px; border: 2px solid #1e40af; border-radius: 8px; }
    .cover-badge p { font-size: 11pt; font-weight: 600; color: #1e40af; }
    .toc-page { padding-top: 50px; }
    .toc-title { font-size: 16pt; color: #1e40af; text-align: center; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
    .toc-list { width: 80%; max-width: 500px; margin: 0 auto 20px; }
    .toc-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #cbd5e1; font-size: 10pt; }
    .toc-item span:first-child { color: #334155; }
    .toc-item span:last-child { color: #64748b; }
    .toc-image { width: 85%; max-width: 500px; max-height: 400px; margin: 15px auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; break-inside: avoid; }
    .toc-image img { width: 100%; height: auto; max-height: 400px; object-fit: contain; }
    .content-page { padding-top: 50px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14pt; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 15px; }
    .section h3 { font-size: 12pt; color: #334155; margin: 15px 0 10px; }
    .section p { margin: 8px 0; text-align: justify; }
    .section ol, .section ul { margin-left: 25px; margin-top: 10px; }
    .section li { margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    .specs-table td:first-child { width: 50%; color: #64748b; }
    .specs-table td:last-child { font-weight: 600; }
    .chart-page { padding-top: 50px; }
    .chart-container { width: 100%; margin: 15px 0; text-align: center; background: #fff; }
    .chart-container canvas { max-width: 100%; }
    .chart-container img { max-width: 100%; max-height: 100%; border: 2px solid #000; }
    .chart-kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .chart-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .chart-kpi .label { font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .chart-kpi .value { font-size: 20pt; font-weight: 700; color: #1e293b; }
    .chart-kpi .unit { font-size: 9pt; color: #94a3b8; }
    .chart-summary { background: ${result.isPassed ? '#dcfce7' : '#fee2e2'}; border: 2px solid ${result.isPassed ? '#22c55e' : '#ef4444'}; border-radius: 8px; padding: 15px 20px; text-align: center; margin-top: 20px; }
    .chart-summary h3 { font-size: 18pt; color: ${result.isPassed ? '#166534' : '#991b1b'}; margin-bottom: 5px; }
    .chart-summary p { font-size: 11pt; color: ${result.isPassed ? '#15803d' : '#b91c1c'}; }
    .data-table { font-size: 9pt; }
    .data-table th { background: #1e40af; color: white; font-size: 8pt; text-transform: uppercase; padding: 8px 6px; }
    .data-table td { padding: 6px; }
    .data-table tr:nth-child(even) { background: #f8fafc; }
    .load-sequence-section { margin-top: 25px; }
    .load-sequence-intro { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 18px; margin-bottom: 20px; }
    .load-sequence-intro p { margin: 6px 0; font-size: 10pt; }
    .load-sequence-intro .param-label { display: inline-block; width: 180px; color: #64748b; font-weight: 500; }
    .load-sequence-intro .param-value { font-weight: 600; color: #1e293b; }
    .load-sequence-table { font-size: 9pt; margin-top: 15px; }
    .load-sequence-table th { background: #1e40af; color: white; font-size: 8pt; text-transform: uppercase; padding: 8px 10px; text-align: center; }
    .load-sequence-table td { padding: 6px 10px; text-align: center; }
    .load-sequence-table tr:nth-child(even) { background: #f8fafc; }
    .load-sequence-table .row-loading { color: #1e293b; }
    .load-sequence-table .row-max-hold { background: #fef3c7 !important; font-weight: 600; color: #92400e; }
    .load-sequence-table .row-unloading { background: #ecfdf5 !important; color: #065f46; }
    .load-sequence-table .section-header { background: #334155 !important; color: white; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 8pt; }
    .signature-column { width: 160px; text-align: center; }
    .images-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
    .image-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .image-card img { width: 100%; height: 200px; object-fit: cover; }
    .image-card .caption { padding: 10px; font-size: 9pt; color: #64748b; text-align: center; background: #f8fafc; }
    .signature-section { margin-top: 60px; }
    .signature-row { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { width: 45%; }
    .signature-box p { margin-bottom: 50px; }
    .signature-line { border-top: 1px solid #1e293b; padding-top: 5px; font-size: 10pt; }
    @media print { .page { page-break-after: always; } }
  </style>
</head>
<body>
  <div class="page cover-page">
    <div class="cover-title">
      <h1>INITIAL STATIC PULLOUT / UPLIFT PILE LOAD TEST</h1>
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
      <p>Test conducted as per IS 2911 (Part 4) - 2013, Clause 9.4</p>
    </div>
  </div>

  <div class="page toc-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
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
    ${tocImage ? `<div class="toc-image"><img src="${tocImage.url}" alt="Site Image" /></div>` : ''}
  </div>

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">1.0 General</h2>
      <p>
        1.1 ${client} decided to carry out static pile testing work on ${pileDiameterMm}mm diameter pile
        to estimate uplift resistance capacity. This is the Uplift / Pullout Pile Load Test at ${location}.
      </p>
      <p>
        1.2 This report covers data for one uplift pile load test. This report covers calculation of
        safe uplift load capacity for pile based on data collected during fieldwork.
      </p>
      <p>1.3 The following codes of practices have been adopted:</p>
      <ul>
        <li>IS 2911 (Part 4) - 2013 "Code of Practice for Design and Construction of Pile Foundations - Load Tests on Piles" (Clause 9.4)</li>
        <li>IS 14593 - 1998 (Reaffirmed 2003) "Design and Construction of Bored Cast-in-Situ Piles Founded on Rocks – Guidelines"</li>
      </ul>
    </div>
  </div>

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">2.0 Scope of Work</h2>
      <p>Pile details are tabulated as below.</p>
      <h3>2.1 Pile Details for Uplift Load Test</h3>
      <table class="specs-table">
        <tr><td>Location</td><td>${location}</td></tr>
        <tr><td>Pile ID</td><td>${pileId}</td></tr>
        <tr><td>Pile Diameter</td><td>${pileDiameterMm} mm</td></tr>
        <tr><td>Pile Depth</td><td>${pileDepthM} m</td></tr>
        <tr><td>Concrete Grade</td><td>${concreteGrade}</td></tr>
        <tr><td>Maximum Uplift Safe Capacity</td><td>${designLoadT} MT</td></tr>
      </table>
      <h3>2.2 Uplift Test Load</h3>
      <p>The design uplift load on the pile is <strong>${designLoadT} MT</strong>.</p>
      <p>The pile is required to be tested to a load of <strong>${testLoadT} MT</strong> (2.5 × design load).</p>
      <h3>2.3 Equipment Details</h3>
      <table class="specs-table">
        <tr><td>Hydraulic Jack</td><td>${jackName || 'As per site specifications'}</td></tr>
        <tr><td>Ram Area</td><td>${ramAreaCm2} cm²</td></tr>
        <tr><td>Dial Gauge Least Count</td><td>${gaugeLeastCountMm} mm</td></tr>
      </table>
    </div>
  </div>

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">3.0 Methodology</h2>
      <p>
        The Uplift / Pullout Pile Load Test was conducted in accordance with IS 2911 (Part 4) - 2013,
        Clause 9.4 "Code of Practice for Design and Construction of Pile Foundations - Load Test on Piles".
      </p>
      <h3>3.1 Test Setup</h3>
      <p>
        A hydraulic jack of adequate capacity was used to apply uplift load, reacting against a sturdy
        reaction frame. Four dial gauges (${gaugeLeastCountMm} mm least count) were fixed on the pile head
        to record upward displacement (uplift).
      </p>
      <h3>3.2 Test Procedure</h3>
      <ol>
        <li>Uplift load was applied in increments of approximately 20% of design load (${(designLoadT * 0.2).toFixed(1)} MT) up to the test load of ${testLoadT} MT.</li>
        <li>Each load increment was maintained until the rate of uplift was less than 0.1mm/hour, or for a minimum of 1 hour.</li>
        <li>Maximum load was maintained for 24 hours as per IS 2911 requirements for initial tests.</li>
        <li>Load was released in the same increments as the loading phase.</li>
        <li>Upward displacement (uplift) readings were recorded at each load increment using four dial gauges positioned at 90° intervals.</li>
      </ol>
      <h3>3.3 Acceptance Criteria (IS 2911 Part 4, Clause 9.4)</h3>
      <p>As per IS 2911 (Part 4) - 2013, Clause 9.4, the acceptance criteria for Uplift / Pullout Load Test are:</p>
      <ol>
        <li>Net uplift displacement shall not exceed 12mm.</li>
        <li>Safe uplift load shall be taken as two-thirds of the load at which total uplift equals 12mm.</li>
        <li>If a yield or break point is observed, safe load shall not exceed half the yield/break load.</li>
      </ol>
    </div>
  </div>

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
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
        <strong>Uplift Load Test on ${pileDiameterMm}mm Dia Pile (${designLoadT} MT Design Load)</strong>.
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

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">4.0 Results</h2>
      <h3>4.1 Uplift Analysis</h3>
      <table class="specs-table">
        <tr><td>Max Uplift</td><td>${result.maxSettlementMm.toFixed(2)} mm</td></tr>
        <tr><td>Elastic Recovery</td><td>${result.elasticReboundMm.toFixed(2)} mm</td></tr>
        <tr><td>Net Uplift</td><td>${result.netSettlementMm.toFixed(2)} mm</td></tr>
        <tr><td>Uplift Limit (IS 2911 Clause 9.4)</td><td>${result.settlementLimitMm} mm</td></tr>
        <tr><td>Safe Uplift Load Adopted</td><td>${result.safeLoadAdoptedT.toFixed(1)} MT</td></tr>
        <tr><td>Governing Criterion</td><td>${result.governingCriterion}</td></tr>
        <tr><td>Test Status</td><td style="color: ${result.isPassed ? '#16a34a' : '#dc2626'}; font-weight: bold;">${result.isPassed ? 'PASSED' : 'FAILED'}</td></tr>
      </table>
      <h3>4.2 Assessment</h3>
      <p>
        The net uplift of ${result.netSettlementMm.toFixed(2)} mm is
        ${result.netSettlementMm <= result.settlementLimitMm ? 'within' : 'exceeding'}
        the permissible limit of ${result.settlementLimitMm} mm as per IS 2911 (Part 4) - 2013, Clause 9.4.
      </p>
      <p>
        The safe uplift load adopted for the pile is <strong>${result.safeLoadAdoptedT.toFixed(1)} MT</strong>
        based on the ${result.governingCriterion.toLowerCase()} criterion
        (two-thirds of load at 12mm uplift${result.safeLoadFromUltimateT != null ? ', or half of yield/break load if applicable' : ''}).
      </p>
    </div>
  </div>

  <div class="page chart-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">5.0 Load vs Uplift Curve</h2>
      <div class="chart-container" style="border: 2px solid #000; padding: 2px; background: #fff; min-height: 400px; height: 450px;">
        <canvas id="loadUpliftChart" style="width: 100%; height: 100%;"></canvas>
      </div>
      ${generateChartScript(readings, {
        chartTitle: 'LOAD VS UPLIFT',
        yAxisLabel: 'UPLIFT (mm)',
        subtitle: 'UPLIFT',
        canvasId: 'loadUpliftChart',
      })}
      <div style="text-align: center; margin-top: 8px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <p style="font-size: 11pt; font-weight: 600; color: #1e293b; margin: 0;">
          Maximum Uplift at ${readings.length > 0 ? Math.max(...readings.map((r) => r.loadT)).toFixed(2) : '0.00'} T: ${result.maxSettlementMm.toFixed(2)} mm
        </p>
      </div>
      <div class="chart-kpi-grid" style="grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0;">
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Test Load</div>
          <div class="value" style="font-size: 16pt;">${testLoadT.toFixed(1)}</div>
          <div class="unit">MT</div>
        </div>
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Max Uplift</div>
          <div class="value" style="font-size: 16pt;">${result.maxSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Net Uplift</div>
          <div class="value" style="font-size: 16pt;">${result.netSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="chart-kpi" style="padding: 8px;">
          <div class="label">Safe Uplift Load</div>
          <div class="value" style="font-size: 16pt;">${result.safeLoadAdoptedT.toFixed(1)}</div>
          <div class="unit">MT</div>
        </div>
      </div>
      <div class="chart-summary" style="padding: 10px 15px; margin-top: 10px;">
        <h3 style="font-size: 14pt;">TEST ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</h3>
        <p style="font-size: 10pt;">Net uplift ${result.netSettlementMm.toFixed(2)}mm is ${result.netSettlementMm <= result.settlementLimitMm ? 'within' : 'exceeding'} the ${result.settlementLimitMm}mm limit (IS 2911 Part 4, Clause 9.4)</p>
      </div>
    </div>
  </div>

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">5.1 Record of Pile Load Test</h2>
      <div style="display: flex; gap: 30px; margin-top: 20px;">
        <div style="flex: 1;">
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 10px; text-transform: uppercase;">Loading</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
            <thead>
              <tr>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Load<br/>(T)</th>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Average<br/>Uplift<br/>(mm)</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const loadingOnly = readings.filter((r) => r.phase === 'LOADING');
                const loadingByLoad: Record<string, number> = {};
                loadingOnly.forEach((r) => {
                  loadingByLoad[r.loadT.toFixed(2)] = r.avgSettlementMm;
                });
                const holdRows = readings.filter((r) => r.phase === 'HOLD');
                if (holdRows.length > 0 && loadingOnly.length > 0) {
                  const maxLoad = Math.max(...loadingOnly.map((r) => r.loadT));
                  loadingByLoad[maxLoad.toFixed(2)] = holdRows[holdRows.length - 1].avgSettlementMm;
                }
                const loadingData = Object.entries(loadingByLoad)
                  .map(([load, uplift]) => ({ load: parseFloat(load), uplift }))
                  .sort((a, b) => a.load - b.load);
                return loadingData
                  .map(
                    (d) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.load.toFixed(2)}</td>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.uplift.toFixed(2)}</td>
                  </tr>
                `
                  )
                  .join('');
              })()}
            </tbody>
          </table>
        </div>
        <div style="flex: 1;">
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 10px; text-transform: uppercase;">Unloading</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
            <thead>
              <tr>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Load<br/>(T)</th>
                <th style="border: 2px solid #000; padding: 8px; text-align: center; background: #f8fafc; font-weight: bold;">Average<br/>Uplift<br/>(mm)</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const unloadingReadings = readings.filter((r) => r.phase === 'UNLOADING');
                const unloadingByLoad: Record<string, number> = {};
                unloadingReadings.forEach((r) => {
                  unloadingByLoad[r.loadT.toFixed(2)] = r.avgSettlementMm;
                });
                const unloadingData = Object.entries(unloadingByLoad)
                  .map(([load, uplift]) => ({ load: parseFloat(load), uplift }))
                  .sort((a, b) => b.load - a.load);
                return unloadingData
                  .map(
                    (d) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.load.toFixed(2)}</td>
                    <td style="border: 1px solid #000; padding: 6px 10px; text-align: center;">${d.uplift.toFixed(2)}</td>
                  </tr>
                `
                  )
                  .join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">6.0 Conclusion</h2>
      ${conclusion ? `<p>${conclusion}</p>` : `
        <p>
          Based on the Uplift / Pullout Pile Load Test conducted on pile ${pileId} at ${location},
          the following observations and conclusions are drawn:
        </p>
        <ol>
          <li>The pile was loaded up to ${testLoadT.toFixed(1)} MT (2.5 times the design uplift load of ${designLoadT} MT) as per IS 2911 (Part 4) - 2013, Clause 9.4.</li>
          <li>The maximum uplift recorded at test load was ${result.maxSettlementMm.toFixed(2)} mm.</li>
          <li>After complete unloading, the elastic recovery was ${result.elasticReboundMm.toFixed(2)} mm.</li>
          <li>The net uplift (residual) is ${result.netSettlementMm.toFixed(2)} mm, which is ${result.netSettlementMm <= result.settlementLimitMm ? 'within' : 'exceeding'} the permissible limit of ${result.settlementLimitMm} mm.</li>
          <li>The safe uplift load adopted for the pile is ${result.safeLoadAdoptedT.toFixed(1)} MT based on the ${result.governingCriterion.toLowerCase()} criterion.</li>
          <li><strong>The pile ${result.isPassed ? 'HAS PASSED' : 'HAS FAILED'} the Uplift / Pullout Pile Load Test as per IS 2911 (Part 4) - 2013, Clause 9.4.</strong></li>
        </ol>
        ${result.isPassed ? `
          <p style="margin-top: 20px;">
            Therefore, the design safe uplift load of ${designLoadT} MT can be adopted as the working uplift capacity for this pile.
          </p>
        ` : `
          <p style="margin-top: 20px; color: #dc2626;">
            Further investigation and remedial measures are recommended before adopting the design uplift load.
          </p>
        `}
      `}
    </div>
  </div>

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div class="section">
      <h2 class="section-title">7.0 Observation Sheet</h2>
      <p style="font-size: 10pt; color: #64748b; margin-bottom: 15px;">Load increment readings as per IS 2911 (Part 4), Clause 9.4</p>
      ${generateObservationSheetHtml(readings)}
    </div>
  </div>

  ${siteImages.length > 0 ? `
  <div class="page" style="padding: 0; margin: 0; height: 100vh; box-sizing: border-box; overflow: hidden;">
    <div style="position: absolute; top: 15px; left: 40px; right: 40px; display: flex; justify-content: space-between; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; z-index: 10;">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
    </div>
    <div style="position: absolute; top: 45px; left: 40px; right: 40px; z-index: 10;">
      <h2 style="font-size: 14pt; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin: 0;">8.0 Site Images</h2>
    </div>
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
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
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
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
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

  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>${reportLabel} - ${pileId}</span>
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
