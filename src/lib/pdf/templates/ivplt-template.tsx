/**
 * IVPLT Report HTML Template
 * Why: Generates professional HTML for PDF conversion matching IS 2911 report format.
 */

import type { CalculationResult, ReadingInput } from '@/engines';

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
  
  // Optional
  conclusion?: string;
  chartImageBase64?: string;
}

/**
 * Generate the complete IVPLT report HTML.
 * Why: Creates a professional, printable HTML document for PDF conversion.
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
  } = data;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

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
      line-height: 1.5;
      color: #1e293b;
      background: white;
    }
    
    .page {
      page-break-after: always;
      padding: 0;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    /* Title Page */
    .title-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
      padding: 40px;
    }
    
    .title-page h1 {
      font-size: 28pt;
      color: #1e40af;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .title-page h2 {
      font-size: 18pt;
      color: #334155;
      margin-bottom: 40px;
    }
    
    .title-info {
      margin-top: 40px;
      text-align: left;
      width: 80%;
      max-width: 500px;
    }
    
    .title-info p {
      margin: 10px 0;
      font-size: 12pt;
    }
    
    .title-info strong {
      display: inline-block;
      width: 140px;
      color: #64748b;
    }
    
    /* Content Pages */
    .content-page {
      padding: 40px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section h2 {
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
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10pt;
    }
    
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
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
    
    /* Results Box */
    .result-box {
      background: ${result.isPassed ? '#dcfce7' : '#fee2e2'};
      border: 2px solid ${result.isPassed ? '#22c55e' : '#ef4444'};
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    
    .result-box h3 {
      font-size: 16pt;
      color: ${result.isPassed ? '#166534' : '#991b1b'};
      margin-bottom: 10px;
    }
    
    .result-box p {
      font-size: 12pt;
      color: ${result.isPassed ? '#15803d' : '#b91c1c'};
    }
    
    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    
    .kpi-card .label {
      font-size: 9pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .kpi-card .value {
      font-size: 18pt;
      font-weight: 700;
      color: #1e293b;
      margin: 5px 0;
    }
    
    .kpi-card .unit {
      font-size: 10pt;
      color: #94a3b8;
    }
    
    /* Chart */
    .chart-container {
      text-align: center;
      margin: 20px 0;
    }
    
    .chart-container img {
      max-width: 100%;
      height: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
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
    }
    
    .data-table tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .phase-loading { color: #2563eb; font-weight: 600; }
    .phase-hold { color: #d97706; font-weight: 600; }
    .phase-unloading { color: #16a34a; font-weight: 600; }
    
    /* Footer */
    .page-footer {
      position: fixed;
      bottom: 20px;
      left: 40px;
      right: 40px;
      font-size: 9pt;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    
    @media print {
      .page {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <!-- Title Page -->
  <div class="page title-page">
    <h1>Initial Vertical Pile Load Test</h1>
    <h2>Test Report</h2>
    
    <div class="title-info">
      <p><strong>Pile ID:</strong> ${pileId}</p>
      <p><strong>Report No:</strong> ${reportNo || '-'}</p>
      <p><strong>Project:</strong> ${projectName}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Client:</strong> ${client}</p>
      <p><strong>Contractor:</strong> ${contractor}</p>
      ${pmc ? `<p><strong>PMC:</strong> ${pmc}</p>` : ''}
      <p><strong>Test Date:</strong> ${formatDate(testDate)}</p>
    </div>
    
    <div style="margin-top: 60px; padding: 20px; border: 2px solid #1e40af; border-radius: 8px;">
      <p style="font-size: 14pt; font-weight: 600; color: #1e40af;">
        Test conducted as per IS 2911 (Part 4) - 2013
      </p>
    </div>
  </div>

  <!-- Results Summary Page -->
  <div class="page content-page">
    <div class="section">
      <h2>1. Test Results Summary</h2>
      
      <div class="result-box">
        <h3>TEST ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</h3>
        <p>Net Settlement: ${result.netSettlementMm.toFixed(2)} mm (Limit: ${result.settlementLimitMm} mm)</p>
      </div>
      
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="label">Test Load</div>
          <div class="value">${testLoadT.toFixed(1)}</div>
          <div class="unit">MT (${(testLoadT / designLoadT).toFixed(1)}× Design)</div>
        </div>
        <div class="kpi-card">
          <div class="label">Max Settlement</div>
          <div class="value">${result.maxSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="kpi-card">
          <div class="label">Elastic Rebound</div>
          <div class="value">${result.elasticReboundMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="kpi-card">
          <div class="label">Net Settlement</div>
          <div class="value">${result.netSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="kpi-card">
          <div class="label">Safe Load Adopted</div>
          <div class="value">${result.safeLoadAdoptedT.toFixed(1)}</div>
          <div class="unit">MT</div>
        </div>
        <div class="kpi-card">
          <div class="label">Design Load</div>
          <div class="value">${designLoadT.toFixed(1)}</div>
          <div class="unit">MT</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>2. Pile Specifications</h2>
      <table class="specs-table">
        <tr><td>Pile ID</td><td>${pileId}</td></tr>
        <tr><td>Pile Diameter</td><td>${pileDiameterMm} mm</td></tr>
        <tr><td>Pile Depth</td><td>${pileDepthM} m</td></tr>
        <tr><td>Concrete Grade</td><td>${concreteGrade}</td></tr>
        <tr><td>Design Safe Load</td><td>${designLoadT} MT</td></tr>
        <tr><td>Test Load (2.5× Design)</td><td>${testLoadT} MT</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>3. Equipment Details</h2>
      <table class="specs-table">
        <tr><td>Hydraulic Jack</td><td>${jackName || 'As per site specifications'}</td></tr>
        <tr><td>Ram Area</td><td>${ramAreaCm2} cm²</td></tr>
        <tr><td>Dial Gauge Least Count</td><td>${gaugeLeastCountMm} mm</td></tr>
        <tr><td>Test Method</td><td>IS 2911 (Part 4) - 2013</td></tr>
      </table>
    </div>
  </div>

  <!-- Methodology & Acceptance Page -->
  <div class="page content-page">
    <div class="section">
      <h2>4. Methodology</h2>
      <p>
        The Initial Vertical Pile Load Test was conducted in accordance with IS 2911 (Part 4) - 2013 
        "Code of Practice for Design and Construction of Pile Foundations - Load Test on Piles".
      </p>
      
      <h3>Test Procedure:</h3>
      <ol style="margin-left: 20px; margin-top: 10px;">
        <li>Load was applied in increments of 20% of design load up to test load (${testLoadT} MT).</li>
        <li>Each load increment was maintained until rate of settlement was less than 0.1mm/hour.</li>
        <li>Maximum load was maintained for 24 hours as per IS 2911 requirements.</li>
        <li>Load was released in the same increments as loading phase.</li>
        <li>Settlement readings were recorded using four dial gauges at each load increment.</li>
      </ol>
    </div>

    <div class="section">
      <h2>5. Acceptance Criteria (IS 2911 Part 4)</h2>
      <p>As per IS 2911 (Part 4) - 2013, the acceptance criteria for Initial Vertical Pile Load Test are:</p>
      <ol style="margin-left: 20px; margin-top: 10px;">
        <li>Net settlement at design load shall not exceed 12mm or 2% of pile diameter (${(0.02 * pileDiameterMm).toFixed(1)}mm), whichever is less.</li>
        <li>Safe load shall be taken as two-thirds of the load at which total settlement equals 12mm.</li>
        <li>Safe load shall not exceed half the load at which total settlement equals 10% of pile diameter (${(0.1 * pileDiameterMm).toFixed(1)}mm).</li>
      </ol>
    </div>

    <div class="section">
      <h2>6. Results Analysis</h2>
      <table class="specs-table">
        <tr><td>Maximum Settlement Recorded</td><td>${result.maxSettlementMm.toFixed(2)} mm</td></tr>
        <tr><td>Elastic Rebound</td><td>${result.elasticReboundMm.toFixed(2)} mm</td></tr>
        <tr><td>Net Settlement (Max - Rebound)</td><td>${result.netSettlementMm.toFixed(2)} mm</td></tr>
        <tr><td>Settlement Limit (IS 2911)</td><td>${result.settlementLimitMm} mm</td></tr>
        <tr><td>Safe Load Adopted</td><td>${result.safeLoadAdoptedT.toFixed(1)} MT</td></tr>
        <tr><td>Governing Criterion</td><td>${result.governingCriterion}</td></tr>
        <tr><td>Test Status</td><td style="color: ${result.isPassed ? '#16a34a' : '#dc2626'}; font-weight: bold;">${result.isPassed ? 'PASSED' : 'FAILED'}</td></tr>
      </table>
    </div>
  </div>

  <!-- Chart Page -->
  ${chartImageBase64 ? `
  <div class="page content-page">
    <div class="section">
      <h2>7. Load vs Settlement Curve</h2>
      <div class="chart-container">
        <img src="${chartImageBase64}" alt="Load vs Settlement Curve" />
      </div>
      <p style="text-align: center; font-style: italic; color: #64748b; margin-top: 10px;">
        Blue: Loading Phase | Amber: Hold Phase | Green: Unloading Phase
      </p>
    </div>
  </div>
  ` : ''}

  <!-- Data Table Page -->
  <div class="page content-page">
    <div class="section">
      <h2>${chartImageBase64 ? '8' : '7'}. Load Test Data</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Phase</th>
            <th>Load (MT)</th>
            <th>Settlement (mm)</th>
          </tr>
        </thead>
        <tbody>
          ${readings.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="phase-${r.phase.toLowerCase()}">${r.phase}</td>
              <td>${r.loadT.toFixed(2)}</td>
              <td>${r.avgSettlementMm.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Conclusion Page -->
  <div class="page content-page">
    <div class="section">
      <h2>${chartImageBase64 ? '9' : '8'}. Conclusion</h2>
      ${conclusion ? `<p>${conclusion}</p>` : `
        <p>
          Based on the Initial Vertical Pile Load Test conducted on pile ${pileId} at ${location}, 
          the following observations and conclusions are drawn:
        </p>
        <ol style="margin-left: 20px; margin-top: 15px; line-height: 2;">
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

    <div style="margin-top: 60px;">
      <table style="width: 100%; border: none;">
        <tr style="border: none;">
          <td style="border: none; width: 50%; vertical-align: top;">
            <p style="margin-bottom: 60px;">Prepared by:</p>
            <p>_________________________</p>
            <p>Site Engineer</p>
          </td>
          <td style="border: none; width: 50%; vertical-align: top; text-align: right;">
            <p style="margin-bottom: 60px;">Approved by:</p>
            <p>_________________________</p>
            <p>Project Manager</p>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>
  `;
}


