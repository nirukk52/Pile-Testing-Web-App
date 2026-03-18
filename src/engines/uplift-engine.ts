/**
 * Uplift (Pullout / Uplift Pile Load Test) Engine
 * Why: Implements IS 2911 Part 4 - 2013, Clause 9.4 calculations for uplift tests.
 * Key differences from IVPLT: upward displacement direction, 12mm uplift limit,
 * safe load = min(2/3 × load at 12mm, 0.5 × load at yield if detected).
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
  determinePassFail,
  roundTo,
  formatNumber,
  interpolateLoadAtSettlement,
} from '@/lib/calculations';

/**
 * Uplift Engine - Pullout / Uplift Pile Load Test
 * Why: Tests upward resistance of piles against uplift forces.
 * Uses same DB column (avgSettlementMm) to store uplift displacement.
 */
export class UpliftEngine implements ITestEngine {
  readonly testType: TestType = 'UPLIFT';
  readonly displayName = 'Uplift';
  readonly fullName = 'Uplift / Pullout Load Test';
  readonly testLoadMultiplier = 2.5;
  readonly settlementLimitMm = 12;

  calculate(readings: ReadingInput[], meta: TestMeta): CalculationResult {
    if (readings.length === 0) {
      return this.getEmptyResult(meta.designLoadT);
    }

    const maxSettlementMm = roundTo(findMaxSettlement(readings));
    const elasticReboundMm = roundTo(calculateElasticRebound(readings));
    const netSettlementMm = roundTo(calculateNetSettlement(readings));

    // Safe load from 12mm uplift criterion: (2/3) × load at 12mm
    const loadAtLimitT = interpolateLoadAtSettlement(
      readings,
      this.settlementLimitMm,
      'LOADING'
    );
    const safeLoadFromSettlementT = loadAtLimitT
      ? roundTo((2 / 3) * loadAtLimitT)
      : null;

    // Yield/break detection: look for a sudden jump in displacement.
    // A jump > 2mm between consecutive readings at same load suggests yield.
    const yieldLoadT = this.detectYieldLoad(readings);
    const safeLoadFromYield = yieldLoadT ? roundTo(0.5 * yieldLoadT) : null;

    const { safeLoadAdoptedT, governingCriterion } = determineSafeLoad(
      meta.designLoadT,
      safeLoadFromSettlementT,
      safeLoadFromYield
    );

    const isPassed = determinePassFail(
      netSettlementMm,
      this.settlementLimitMm,
      meta.pileDiameterMm
    );

    return {
      maxSettlementMm,
      elasticReboundMm,
      netSettlementMm,
      loadAtLimitT: loadAtLimitT ? roundTo(loadAtLimitT) : null,
      safeLoadFromSettlementT,
      loadAt10PercentDiaT: null,
      safeLoadFromUltimateT: safeLoadFromYield,
      governingCriterion,
      safeLoadAdoptedT: roundTo(safeLoadAdoptedT),
      isPassed,
      settlementLimitMm: this.settlementLimitMm,
    };
  }

  /**
   * Detect yield load from sudden uplift displacement jumps.
   * Why: IS 2911 Clause 9.4 considers yield/break point for safe load determination.
   * Returns the load at which yield is detected, or null if no clear yield.
   */
  private detectYieldLoad(readings: ReadingInput[]): number | null {
    const loadingReadings = readings
      .filter((r) => r.phase === 'LOADING')
      .sort((a, b) => a.sequence - b.sequence);

    if (loadingReadings.length < 3) return null;

    for (let i = 1; i < loadingReadings.length; i++) {
      const prev = loadingReadings[i - 1];
      const curr = loadingReadings[i];
      const displacementJump = Math.abs(curr.avgSettlementMm - prev.avgSettlementMm);

      // A jump > 2mm at the same or similar load suggests yield
      if (displacementJump > 2 && Math.abs(curr.loadT - prev.loadT) < 1) {
        return curr.loadT;
      }
    }

    return null;
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
        'As per IS 2911 (Part 4) - 2013, Clause 9.4, the acceptance criteria for Uplift / Pullout Load Test are:',
      criteria: [
        `Net uplift displacement shall not exceed 12mm.`,
        `Safe uplift load shall be taken as two-thirds of the load at which total uplift equals 12mm.`,
        `If a yield/break point is observed, safe load shall not exceed half the yield load.`,
        `The pile should sustain the test load (${meta.testLoadT.toFixed(1)} T) without exceeding the uplift limit.`,
      ],
      settlementLimitMm: this.settlementLimitMm,
      ultimateLimitMm: 0.1 * meta.pileDiameterMm,
    };
  }

  getGraphConfig(_meta: TestMeta): GraphConfig {
    return {
      title: 'Load vs Uplift Curve',
      xAxisLabel: 'Load (MT)',
      yAxisLabel: 'Uplift (mm)',
      yAxisInverted: false,
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
        id: 'maxUplift',
        label: 'Max Uplift',
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
        id: 'netUplift',
        label: 'Net Uplift',
        unit: 'mm',
        getValue: (result) =>
          `${formatNumber(result.netSettlementMm)} / ${result.settlementLimitMm}`,
        color: 'default',
      },
      {
        id: 'safeLoad',
        label: 'Safe Uplift Load',
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
      errors.push('Uplift displacement cannot be negative');
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
          <p>This report presents the results of Uplift / Pullout Pile Load Test conducted on pile ${data.pileId}
          at ${data.location} for the project "${data.projectName}".</p>
          <p>The test was performed in accordance with IS 2911 (Part 4) - 2013, Clause 9.4 "Code of Practice for Design and
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
            <tr><td>Design Uplift Load</td><td>${data.designLoadT} MT</td></tr>
            <tr><td>Test Load (2.5 × Design Load)</td><td>${data.testLoadT} MT</td></tr>
          </table>
        `,
      },
      {
        id: 'methodology',
        title: '3. METHODOLOGY',
        content: `
          <p>The uplift load test was conducted as per IS 2911 (Part 4) - 2013.</p>
          <h4>Equipment Used:</h4>
          <ul>
            <li>Hydraulic Jack: ${data.jackName || 'As per site specifications'}</li>
            <li>Ram Area: ${data.ramAreaCm2} cm²</li>
            <li>Dial Gauge Least Count: ${data.gaugeLeastCountMm} mm</li>
          </ul>
          <h4>Test Procedure:</h4>
          <ol>
            <li>Uplift load was applied in increments up to the test load.</li>
            <li>Each load increment was maintained until rate of uplift was less than 0.1mm/hour.</li>
            <li>Maximum load was maintained for the required hold duration.</li>
            <li>Load was released in the same increments as loading, and rebound was measured.</li>
          </ol>
        `,
      },
      {
        id: 'results',
        title: '4. RESULTS',
        pageBreakBefore: true,
        content: `
          <h4>Uplift Analysis:</h4>
          <table>
            <tr><td>Maximum Uplift</td><td>${formatNumber(result.maxSettlementMm)} mm</td></tr>
            <tr><td>Elastic Recovery</td><td>${formatNumber(result.elasticReboundMm)} mm</td></tr>
            <tr><td>Net Uplift</td><td>${formatNumber(result.netSettlementMm)} mm</td></tr>
          </table>

          <h4>Safe Uplift Load Determination:</h4>
          <p>As per IS 2911 (Part 4) - 2013, Clause 9.4:</p>
          <ul>
            ${result.safeLoadFromSettlementT !== null ? `<li>Two-thirds of load at 12mm uplift: ${formatNumber(result.safeLoadFromSettlementT)} MT</li>` : ''}
            ${result.safeLoadFromUltimateT !== null ? `<li>Half of yield/break load: ${formatNumber(result.safeLoadFromUltimateT)} MT</li>` : ''}
          </ul>
          <p><strong>Safe Uplift Load Adopted: ${formatNumber(result.safeLoadAdoptedT)} MT</strong></p>

          <h4>Acceptance Criteria Check:</h4>
          <p>Net Uplift (${formatNumber(result.netSettlementMm)} mm) ${result.isPassed ? '≤' : '>'} Limit (${result.settlementLimitMm} mm)</p>
          <p><strong>Test Result: ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</strong></p>
        `,
      },
    ];
  }

  getAIConclusionPrompt(result: CalculationResult, data: ReportData): string {
    return `Generate a professional conclusion paragraph for an Uplift / Pullout Pile Load Test report.

Test Details:
- Pile ID: ${data.pileId}
- Pile Diameter: ${data.pileDiameterMm} mm
- Design Uplift Load: ${data.designLoadT} MT
- Test Load (2.5×): ${data.testLoadT} MT

Test Results:
- Maximum Uplift: ${result.maxSettlementMm} mm
- Elastic Recovery: ${result.elasticReboundMm} mm
- Net Uplift: ${result.netSettlementMm} mm
- Uplift Limit (IS 2911): ${result.settlementLimitMm} mm
- Safe Uplift Load Adopted: ${result.safeLoadAdoptedT} MT
- Test Status: ${result.isPassed ? 'PASSED' : 'FAILED'}

Requirements:
1. Reference IS 2911 (Part 4) - 2013, Clause 9.4
2. State the maximum uplift, elastic recovery, and net uplift
3. Confirm or deny that net uplift is within the 12mm limit
4. State the safe uplift load that can be adopted
5. ${result.isPassed ? 'Confirm the pile is suitable for the design uplift load' : 'Recommend further investigation or remedial measures'}
6. Keep the conclusion to 2-3 paragraphs
7. Use formal engineering language`;
  }
}
