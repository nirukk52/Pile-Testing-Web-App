/**
 * HTML template for PDF generation.
 * Why: Generates a complete HTML document that Playwright renders to PDF.
 * Uses inline styles since external CSS won't be available during PDF generation.
 */

import type { ReportData } from '@/types';

/**
 * CSS styles for the PDF report.
 * Why: Inline styles ensure consistent rendering across different environments.
 * Matches the report.html design system.
 */
const styles = `
  :root {
    --primary: #2563eb;
    --primary-dark: #1e40af;
    --secondary: #64748b;
    --bg: #ffffff;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-light: #64748b;
    --success: #10b981;
    --warning: #f59e0b;
    --destructive: #ef4444;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', Inter, Roboto, -apple-system, sans-serif;
  }

  body {
    background-color: var(--bg);
    color: var(--text-main);
    font-size: 12px;
    line-height: 1.5;
    padding: 20px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e2e8f0;
  }

  .brand {
    font-size: 18px;
    font-weight: 700;
  }

  .brand-blue { color: var(--primary); }
  .brand-dark { color: var(--text-main); }

  .report-title h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 8px;
  }

  .report-meta {
    color: var(--text-light);
    font-size: 11px;
  }

  .report-meta strong {
    color: var(--text-main);
  }

  /* KPI Cards */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
    margin-bottom: 30px;
  }

  .kpi-card {
    background: var(--card-bg);
    border-radius: 10px;
    padding: 15px;
    border: 1px solid #e2e8f0;
  }

  .kpi-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-light);
  }

  .kpi-value {
    font-size: 24px;
    font-weight: 700;
    margin-top: 8px;
    color: var(--text-main);
  }

  .kpi-unit {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-light);
  }

  .kpi-sub {
    font-size: 10px;
    margin-top: 4px;
  }

  .text-blue { color: var(--primary); }
  .text-green { color: var(--success); }
  .text-red { color: var(--destructive); }

  /* Specs Panel */
  .specs-section {
    margin-bottom: 30px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 15px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .spec-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .spec-label {
    color: var(--text-light);
    font-size: 11px;
  }

  .spec-value {
    font-weight: 600;
    font-size: 11px;
  }

  /* Table */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-top: 20px;
  }

  .data-table th {
    text-align: left;
    padding: 10px 8px;
    background-color: #f8fafc;
    color: var(--text-light);
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
  }

  .data-table td {
    padding: 8px;
    border-bottom: 1px solid #e2e8f0;
    color: var(--text-main);
  }

  .data-table tr.peak-row {
    background-color: #ecfdf5;
  }

  .data-table tr.peak-row td {
    font-weight: 600;
  }

  .text-right { text-align: right; }

  /* Status Badge */
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .badge-pass {
    background-color: #dcfce7;
    color: #166534;
  }

  .badge-fail {
    background-color: #fee2e2;
    color: #991b1b;
  }

  /* Footer */
  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    color: var(--text-light);
    font-size: 10px;
  }

  /* Page Break */
  .page-break {
    page-break-before: always;
  }

  /* Chart Placeholder */
  .chart-placeholder {
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    color: var(--text-light);
    margin: 20px 0;
  }
`;

/**
 * Generates complete HTML document for PDF rendering.
 * Why: Creates a self-contained HTML page with all styles and data
 * that Playwright can render to a high-quality PDF.
 */
export function generateReportHTML(data: ReportData): string {
  const { projectInfo, readings, summary } = data;

  // Generate current date for footer
  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Format readings for table
  const tableRows = readings
    .map((reading, index) => {
      const isPeak = Math.abs(reading.load - summary.maxLoad) < 0.01;
      const isLast = index === readings.length - 1 && reading.cycle === 'unloading';

      let remark = reading.remark || '';
      if (index === 0) remark = 'Initial Reading';
      else if (isPeak) remark = '24hr Hold Period';
      else if (isLast) remark = 'Net Settlement';
      else if (reading.cycle === 'unloading') remark = 'Rebound Phase';

      return `
        <tr class="${isPeak ? 'peak-row' : ''}">
          <td>${isPeak ? '<strong>Peak Hold</strong>' : reading.cycle}</td>
          <td class="text-right">${reading.load.toFixed(2)}</td>
          <td class="text-right">${reading.pressure.toFixed(2)}</td>
          <td class="text-right">${reading.avgSettlement.toFixed(2)}</td>
          <td>${isPeak ? `<strong>${remark}</strong>` : remark}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${summary.testTypeName} Report - ${projectInfo.testNo || 'Report'}</title>
  <style>${styles}</style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="brand">
      <span class="brand-blue">PILE</span><span class="brand-dark">TEST</span>
      <span style="font-weight: 400; color: #64748b; font-size: 12px; margin-left: 10px;">Pro</span>
    </div>
    <div class="report-title" style="text-align: right;">
      <h1>${summary.testTypeName}</h1>
      <div class="report-meta">
        Report ID: <strong>${projectInfo.testNo || '—'}</strong> | 
        Location: <strong>${projectInfo.location || '—'}</strong> | 
        Client: <strong>${projectInfo.clientName || '—'}</strong>
      </div>
    </div>
  </header>

  <!-- KPI Cards -->
  <section class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Test Load</div>
      <div class="kpi-value">${summary.testLoad.toFixed(2)} <span class="kpi-unit">MT</span></div>
      <div class="kpi-sub text-blue">${summary.loadMultiplier}x Design Load (${summary.designLoad} MT)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Max Settlement</div>
      <div class="kpi-value">${summary.grossSettlement.toFixed(2)} <span class="kpi-unit">mm</span></div>
      <div class="kpi-sub">At ${summary.maxLoad.toFixed(2)} MT Load</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Net Settlement</div>
      <div class="kpi-value">${summary.netSettlement.toFixed(2)} <span class="kpi-unit">mm</span></div>
      <div class="kpi-sub ${summary.passed ? 'text-green' : 'text-red'}">
        ${summary.passed ? 'Safe' : 'Exceeded'} (Limit: ${summary.settlementLimit}mm)
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Test Status</div>
      <div class="kpi-value ${summary.passed ? 'text-green' : 'text-red'}">${summary.passed ? 'PASSED' : 'FAILED'}</div>
      <div class="kpi-sub">Safe Load: ${summary.safeLoadCapacity} MT</div>
    </div>
  </section>

  <!-- Pile Specifications -->
  <section class="specs-section">
    <h2 class="section-title">Pile Specifications</h2>
    <div class="specs-grid">
      <div class="spec-row">
        <span class="spec-label">Pile Diameter</span>
        <span class="spec-value">${projectInfo.pileDiameter || '—'}</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Pile Depth</span>
        <span class="spec-value">${projectInfo.pileDepth || '—'}</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Concrete Grade</span>
        <span class="spec-value">${projectInfo.concreteGrade || '—'}</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Ram Area</span>
        <span class="spec-value">${projectInfo.ramArea || '—'}</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Design Load</span>
        <span class="spec-value">${projectInfo.designLoad || '—'}</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Test Load</span>
        <span class="spec-value">${projectInfo.testLoad || '—'}</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Date of Casting</span>
        <span class="spec-value">${projectInfo.dateOfCasting || '—'}</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Method</span>
        <span class="spec-value">IS 2911 (Part 4)</span>
      </div>
    </div>
  </section>

  <!-- Chart Placeholder -->
  <div class="chart-placeholder">
    <p style="font-size: 14px; font-weight: 600;">Load vs. Settlement Curve</p>
    <p style="margin-top: 10px;">Chart visualization available in interactive report</p>
    <p style="margin-top: 5px; font-size: 10px;">Max Load: ${summary.maxLoad.toFixed(2)} MT | Max Settlement: ${summary.grossSettlement.toFixed(2)} mm</p>
  </div>

  <!-- Data Table -->
  <section>
    <h2 class="section-title">Load Increment Summary</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Cycle</th>
          <th class="text-right">Load (MT)</th>
          <th class="text-right">Pressure (kg/cm²)</th>
          <th class="text-right">Avg Settlement (mm)</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <p style="margin-top: 15px; font-size: 10px; color: #64748b;">
      Total readings: ${readings.length} | 
      Loading: ${readings.filter((r) => r.cycle === 'loading' || r.cycle === 'holding').length} | 
      Unloading: ${readings.filter((r) => r.cycle === 'unloading').length}
    </p>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <p>Generated by PileTest Pro on ${generatedDate}</p>
    <p style="margin-top: 5px;">IS 2911 (Part 4) Compliant Report</p>
  </footer>
</body>
</html>
  `.trim();
}


