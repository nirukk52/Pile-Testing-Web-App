/**
 * Lateral (Lateral Pile Load Test) Engine
 * Why: Implements IS 2911 Part 4 - 2013, Clause 8.4 calculations for lateral load tests.
 * Key differences from IVPLT: uses deflection (not settlement), 5mm primary limit,
 * safe load = min(load at 5mm, 0.5 × load at 12mm), net = test pile - reaction pile.
 */

import type {
  ITestEngine,
  TestType,
  TestMeta,
  ReadingInput,
  CalculationResult,
  AcceptanceCriteria,
  GraphConfig,
  ReportSection,
  KPIConfig,
  ValidationResult,
  ReportData,
} from './types';

import {
  findMaxSettlement,
  calculateElasticRebound,
  calculateNetSettlement,
  determineSafeLoad,
  roundTo,
  formatNumber,
  interpolateLoadAtSettlement,
} from '@/lib/calculations';

/**
 * Lateral Engine - Lateral Pile Load Test
 * Why: Horizontal resistance testing uses deflection limits (5mm/12mm) and
 * reaction pile subtraction, distinct from vertical settlement tests.
 */
export class LateralEngine implements ITestEngine {
  readonly testType: TestType = 'LATERAL';
  readonly displayName = 'Lateral';
  readonly fullName = 'Lateral Pile Load Test';
  readonly testLoadMultiplier = 2.5;
  readonly settlementLimitMm = 5;

  private readonly secondaryLimitMm = 12;

  calculate(readings: ReadingInput[], meta: TestMeta): CalculationResult {
    if (readings.length === 0) {
      return this.getEmptyResult(meta.designLoadT);
    }

    const maxSettlementMm = roundTo(findMaxSettlement(readings));
    const elasticReboundMm = roundTo(calculateElasticRebound(readings));
    const netSettlementMm = roundTo(calculateNetSettlement(readings));

    // Safe load from 5mm deflection criterion
    const loadAt5mm = interpolateLoadAtSettlement(
      readings,
      this.settlementLimitMm,
      'LOADING'
    );
    const safeLoadFrom5mm = loadAt5mm ? roundTo(loadAt5mm) : null;

    // Safe load from 12mm deflection criterion (half of load at 12mm)
    const loadAt12mm = interpolateLoadAtSettlement(
      readings,
      this.secondaryLimitMm,
      'LOADING'
    );
    const safeLoadFrom12mm = loadAt12mm ? roundTo(0.5 * loadAt12mm) : null;

    // Governing safe load = min of 5mm criterion, 12mm criterion, and design load
    const { safeLoadAdoptedT, governingCriterion } = determineSafeLoad(
      meta.designLoadT,
      safeLoadFrom5mm,
      safeLoadFrom12mm
    );

    const isPassed = netSettlementMm <= this.settlementLimitMm;

    return {
      maxSettlementMm,
      elasticReboundMm,
      netSettlementMm,
      loadAtLimitT: loadAt5mm ? roundTo(loadAt5mm) : null,
      safeLoadFromSettlementT: safeLoadFrom5mm,
      loadAt10PercentDiaT: loadAt12mm ? roundTo(loadAt12mm) : null,
      safeLoadFromUltimateT: safeLoadFrom12mm,
      governingCriterion,
      safeLoadAdoptedT: roundTo(safeLoadAdoptedT),
      isPassed,
      settlementLimitMm: this.settlementLimitMm,
    };
  }

  private getEmptyResult(designLoadT: number): CalculationResult {
    return {
      maxSettlementMm: 0,
      elasticReboundMm: 0,
      netSettlementMm: 0,
      loadAtLimitT: null,
      safeLoadFromSettlementT: null,
      loadAt10PercentDiaT: null,
      safeLoadFromUltimateT: null,
      governingCriterion: 'NONE',
      safeLoadAdoptedT: designLoadT,
      isPassed: false,
      settlementLimitMm: this.settlementLimitMm,
    };
  }

  getAcceptanceCriteria(meta: TestMeta): AcceptanceCriteria {
    return {
      description:
        'As per IS 2911 (Part 4) - 2013, Clause 8.4, the acceptance criteria for Lateral Pile Load Test are:',
      criteria: [
        `Net lateral deflection at ground level shall not exceed 5mm.`,
        `Safe lateral load shall be taken as the load corresponding to 5mm deflection.`,
        `Safe lateral load shall not exceed half the load at which deflection reaches 12mm.`,
        `The pile should sustain the test load (${meta.testLoadT.toFixed(1)} T) without excessive deflection.`,
      ],
      settlementLimitMm: this.settlementLimitMm,
      ultimateLimitMm: this.secondaryLimitMm,
    };
  }

  getGraphConfig(_meta: TestMeta): GraphConfig {
    return {
      title: 'Load vs Deflection Curve',
      xAxisLabel: 'Load (MT)',
      yAxisLabel: 'Deflection (mm)',
      yAxisInverted: true,
      loadingCurveColor: '#2563eb',
      holdCurveColor: '#f59e0b',
      unloadingCurveColor: '#10b981',
      annotations: {
        safeLoadLine: true,
        settlementLimitLine: true,
        settlementLimitValue: this.settlementLimitMm,
      },
    };
  }

  getKPIConfig(): KPIConfig[] {
    return [
      {
        id: 'testLoad',
        label: 'Test Load',
        unit: 'MT',
        getValue: () => '-',
        color: 'default',
      },
      {
        id: 'maxDeflection',
        label: 'Max Deflection',
        unit: 'mm',
        getValue: (result) => formatNumber(result.maxSettlementMm),
        color: 'default',
      },
      {
        id: 'elasticRebound',
        label: 'Elastic Recovery',
        unit: 'mm',
        getValue: (result) => formatNumber(result.elasticReboundMm),
        color: 'default',
      },
      {
        id: 'netDeflection',
        label: 'Net Deflection',
        unit: 'mm',
        getValue: (result) =>
          `${formatNumber(result.netSettlementMm)} / ${result.settlementLimitMm}`,
        color: 'default',
      },
      {
        id: 'safeLoad',
        label: 'Safe Lateral Load',
        unit: 'MT',
        getValue: (result) => formatNumber(result.safeLoadAdoptedT),
        color: 'success',
      },
      {
        id: 'status',
        label: 'Status',
        unit: '',
        getValue: (result) => (result.isPassed ? 'PASSED' : 'FAILED'),
        color: 'default',
      },
    ];
  }

  validateReading(reading: Partial<ReadingInput>): ValidationResult {
    const errors: string[] = [];
    if (reading.loadT !== undefined && reading.loadT < 0) {
      errors.push('Load cannot be negative');
    }
    if (reading.avgSettlementMm !== undefined && reading.avgSettlementMm < 0) {
      errors.push('Deflection cannot be negative');
    }
    if (reading.sequence !== undefined && reading.sequence < 1) {
      errors.push('Sequence number must be at least 1');
    }
    return { isValid: errors.length === 0, errors };
  }

  calculateTestLoad(designLoadT: number): number {
    return designLoadT * this.testLoadMultiplier;
  }

  getReportSections(data: ReportData): ReportSection[] {
    const { result } = data;
    return [
      {
        id: 'general',
        title: '1. GENERAL',
        content: `
          <p>This report presents the results of Lateral Pile Load Test conducted on pile ${data.pileId}
          at ${data.location} for the project "${data.projectName}".</p>
          <p>The test was performed in accordance with IS 2911 (Part 4) - 2013, Clause 8.4 "Code of Practice for Design and
          Construction of Pile Foundations - Load Test on Piles".</p>
        `,
      },
      {
        id: 'scope',
        title: '2. SCOPE OF WORK',
        content: `
          <table>
            <tr><td>Pile ID</td><td>${data.pileId}</td></tr>
            <tr><td>Pile Diameter</td><td>${data.pileDiameterMm} mm</td></tr>
            <tr><td>Pile Depth</td><td>${data.pileDepthM} m</td></tr>
            <tr><td>Concrete Grade</td><td>${data.concreteGrade}</td></tr>
            <tr><td>Design Lateral Load</td><td>${data.designLoadT} MT</td></tr>
            <tr><td>Test Load (2.5 × Design Load)</td><td>${data.testLoadT} MT</td></tr>
          </table>
        `,
      },
      {
        id: 'methodology',
        title: '3. METHODOLOGY',
        content: `
          <p>The lateral load test was conducted as per IS 2911 (Part 4) - 2013.</p>
          <h4>Equipment Used:</h4>
          <ul>
            <li>Hydraulic Jack: ${data.jackName || 'As per site specifications'}</li>
            <li>Ram Area: ${data.ramAreaCm2} cm²</li>
            <li>Dial Gauge Least Count: ${data.gaugeLeastCountMm} mm</li>
          </ul>
          <h4>Test Procedure:</h4>
          <ol>
            <li>Lateral load was applied in increments up to the test load.</li>
            <li>Deflections were measured on the test pile and the reaction pile.</li>
            <li>Net deflection = test pile deflection − reaction pile deflection.</li>
            <li>Load was released in the same increments as loading.</li>
          </ol>
        `,
      },
      {
        id: 'results',
        title: '4. RESULTS',
        pageBreakBefore: true,
        content: `
          <h4>Deflection Analysis:</h4>
          <table>
            <tr><td>Maximum Deflection</td><td>${formatNumber(result.maxSettlementMm)} mm</td></tr>
            <tr><td>Elastic Recovery</td><td>${formatNumber(result.elasticReboundMm)} mm</td></tr>
            <tr><td>Net Deflection</td><td>${formatNumber(result.netSettlementMm)} mm</td></tr>
          </table>

          <h4>Safe Lateral Load Determination:</h4>
          <p>As per IS 2911 (Part 4) - 2013, Clause 8.4:</p>
          <ul>
            ${result.safeLoadFromSettlementT !== null ? `<li>Load at 5mm deflection: ${formatNumber(result.safeLoadFromSettlementT)} MT</li>` : ''}
            ${result.safeLoadFromUltimateT !== null ? `<li>Half of load at 12mm deflection: ${formatNumber(result.safeLoadFromUltimateT)} MT</li>` : ''}
          </ul>
          <p><strong>Safe Lateral Load Adopted: ${formatNumber(result.safeLoadAdoptedT)} MT</strong></p>

          <h4>Acceptance Criteria Check:</h4>
          <p>Net Deflection (${formatNumber(result.netSettlementMm)} mm) ${result.isPassed ? '≤' : '>'} Limit (${result.settlementLimitMm} mm)</p>
          <p><strong>Test Result: ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</strong></p>
        `,
      },
    ];
  }

  getAIConclusionPrompt(result: CalculationResult, data: ReportData): string {
    return `Generate a professional conclusion paragraph for a Lateral Pile Load Test report.

Test Details:
- Pile ID: ${data.pileId}
- Pile Diameter: ${data.pileDiameterMm} mm
- Design Lateral Load: ${data.designLoadT} MT
- Test Load (2.5×): ${data.testLoadT} MT

Test Results:
- Maximum Deflection: ${result.maxSettlementMm} mm
- Elastic Recovery: ${result.elasticReboundMm} mm
- Net Deflection: ${result.netSettlementMm} mm
- Deflection Limit (IS 2911): ${result.settlementLimitMm} mm
- Safe Lateral Load Adopted: ${result.safeLoadAdoptedT} MT
- Test Status: ${result.isPassed ? 'PASSED' : 'FAILED'}

Requirements:
1. Reference IS 2911 (Part 4) - 2013, Clause 8.4
2. State the maximum deflection, elastic recovery, and net deflection
3. Confirm or deny that net deflection is within the 5mm limit
4. State the safe lateral load that can be adopted
5. ${result.isPassed ? 'Confirm the pile is suitable for the design lateral load' : 'Recommend further investigation or remedial measures'}
6. Keep the conclusion to 2-3 paragraphs
7. Use formal engineering language`;
  }
}
