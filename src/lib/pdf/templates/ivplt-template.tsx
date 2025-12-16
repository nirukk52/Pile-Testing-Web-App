/**
 * IVPLT Report HTML Template V2
 * Why: Generates professional HTML for PDF conversion matching IS 2911 report format.
 * Updated to match report-generation-v2.md spec with new section structure.
 */

import type { CalculationResult, ReadingInput } from '@/engines';

/**
 * Site image data for the report.
 */
export interface ReportImage {
  url: string;
  caption?: string;
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

  // Get specific images
  const coverImage = siteImages[0];
  const tocImage = siteImages[1];
  const remainingImages = siteImages.slice(2);

  // Calculate page numbers (approximate)
  const pageCount = {
    cover: 1,
    toc: 2,
    general: 3,
    scope: 4,
    methodology: 5,
    results: 6,
    chart: 7,
    conclusion: 8,
    dataTableStart: 9,
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
      padding-top: 60px;
    }
    
    .cover-title {
      margin-bottom: 30px;
    }
    
    .cover-title h1 {
      font-size: 24pt;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 1px;
      line-height: 1.3;
      margin-bottom: 10px;
    }
    
    .cover-title h2 {
      font-size: 16pt;
      color: #334155;
      font-weight: 500;
    }
    
    .cover-image {
      width: 70%;
      max-width: 400px;
      height: 250px;
      margin: 30px auto;
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
      object-fit: cover;
    }
    
    .cover-image-placeholder {
      color: #94a3b8;
      font-size: 10pt;
    }
    
    .cover-info {
      text-align: left;
      width: 80%;
      max-width: 450px;
      margin: 20px auto;
    }
    
    .cover-info p {
      margin: 8px 0;
      font-size: 11pt;
    }
    
    .cover-info strong {
      display: inline-block;
      width: 120px;
      color: #64748b;
    }
    
    .cover-badge {
      margin-top: 40px;
      padding: 15px 30px;
      border: 2px solid #1e40af;
      border-radius: 8px;
    }
    
    .cover-badge p {
      font-size: 12pt;
      font-weight: 600;
      color: #1e40af;
    }

    /* TOC Page Styles */
    .toc-page {
      padding-top: 60px;
    }
    
    .toc-title {
      font-size: 18pt;
      color: #1e40af;
      text-align: center;
      margin-bottom: 30px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .toc-list {
      width: 80%;
      max-width: 500px;
      margin: 0 auto 40px;
    }
    
    .toc-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px dotted #cbd5e1;
      font-size: 11pt;
    }
    
    .toc-item span:first-child {
      color: #334155;
    }
    
    .toc-item span:last-child {
      color: #64748b;
    }
    
    .toc-image {
      width: 60%;
      max-width: 350px;
      margin: 30px auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .toc-image img {
      width: 100%;
      height: auto;
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
      height: 380px;
      margin: 20px 0;
      text-align: center;
    }
    
    .chart-container img {
      max-width: 100%;
      max-height: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
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
    
    .signature-column {
      width: 80px;
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
      <div class="toc-item"><span>1.0 General</span><span>Page ${pageCount.general}</span></div>
      <div class="toc-item"><span>2.0 Scope of Work</span><span>Page ${pageCount.scope}</span></div>
      <div class="toc-item"><span>3.0 Methodology</span><span>Page ${pageCount.methodology}</span></div>
      <div class="toc-item"><span>4.0 Results</span><span>Page ${pageCount.results}</span></div>
      <div class="toc-item"><span>5.0 Readings and Graph</span><span>Page ${pageCount.chart}</span></div>
      <div class="toc-item"><span>6.0 Conclusion</span><span>Page ${pageCount.conclusion}</span></div>
      <div class="toc-item"><span>7.0 Load Test Data</span><span>Page ${pageCount.dataTableStart}</span></div>
      ${remainingImages.length > 0 ? `<div class="toc-item"><span>8.0 Site Images</span><span>Page --</span></div>` : ''}
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

  <!-- Page 6: Results -->
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
      
      <div class="chart-container">
        ${chartImageBase64 ? `<img src="${chartImageBase64}" alt="Load vs Settlement Curve" />` : '<p style="padding: 100px; color: #94a3b8;">Chart not available</p>'}
      </div>
      
      <div class="chart-kpi-grid">
        <div class="chart-kpi">
          <div class="label">Test Load</div>
          <div class="value">${testLoadT.toFixed(1)}</div>
          <div class="unit">MT</div>
        </div>
        <div class="chart-kpi">
          <div class="label">Max Settlement</div>
          <div class="value">${result.maxSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
        <div class="chart-kpi">
          <div class="label">Net Settlement</div>
          <div class="value">${result.netSettlementMm.toFixed(2)}</div>
          <div class="unit">mm</div>
        </div>
      </div>
      
      <div class="chart-summary">
        <h3>TEST ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</h3>
        <p>Net settlement ${result.netSettlementMm.toFixed(2)}mm is ${result.netSettlementMm <= result.settlementLimitMm ? 'within' : 'exceeding'} the ${result.settlementLimitMm}mm limit (IS 2911 Part 4)</p>
      </div>
    </div>
  </div>

  <!-- Page 8: Conclusion -->
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

  <!-- Page 9+: Data Table -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">7.0 Load Test Data</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Phase</th>
            <th>Load (MT)</th>
            <th>Settlement (mm)</th>
            <th class="signature-column">Signature</th>
          </tr>
        </thead>
        <tbody>
          ${readings.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="phase-${r.phase.toLowerCase()}">${r.phase}</td>
              <td>${r.loadT.toFixed(2)}</td>
              <td>${r.avgSettlementMm.toFixed(2)}</td>
              <td class="signature-column"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  ${remainingImages.length > 0 ? `
  <!-- Site Images Page -->
  <div class="page content-page">
    <div class="page-header">
      <span>${formatDate(testDate)}</span>
      <span>IVPLT Report - ${pileId}</span>
    </div>
    
    <div class="section">
      <h2 class="section-title">8.0 Site Images</h2>
      <div class="images-grid">
        ${remainingImages.map((img, i) => `
          <div class="image-card">
            <img src="${img.url}" alt="Site Image ${i + 3}" />
            ${img.caption ? `<div class="caption">${img.caption}</div>` : ''}
          </div>
        `).join('')}
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
