/**
 * IVPLT (Initial Vertical Pile Load Test) Engine
 * Why: Implements IS 2911 Part 4 - 2013 calculations for initial vertical pile load tests.
 * Test load multiplier: 2.5x design load
 * Settlement limit: 12mm
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
  calculateSafeLoadFromSettlement,
  calculateSafeLoadFromUltimate,
  determineSafeLoad,
  determinePassFail,
  roundTo,
  formatNumber,
  interpolateLoadAtSettlement,
} from '@/lib/calculations';

/**
 * IVPLT Engine - Initial Vertical Pile Load Test
 * Why: Concrete implementation of ITestEngine for IVPLT tests per IS 2911.
 */
export class IvpltEngine implements ITestEngine {
  readonly testType: TestType = 'IVPLT';
  readonly displayName = 'IVPLT';
  readonly fullName = 'Initial Vertical Pile Load Test';
  readonly testLoadMultiplier = 2.5;
  readonly settlementLimitMm = 12;

  /**
   * Calculate all IS 2911 metrics from readings.
   * Why: Core calculation logic that produces all KPIs and report data.
   */
  calculate(readings: ReadingInput[], meta: TestMeta): CalculationResult {
    if (readings.length === 0) {
      return this.getEmptyResult(meta.designLoadT);
    }

    // Basic settlement calculations
    const maxSettlementMm = roundTo(findMaxSettlement(readings));
    const elasticReboundMm = roundTo(calculateElasticRebound(readings));
    const netSettlementMm = roundTo(calculateNetSettlement(readings));

    // Safe load from settlement limit (12mm for IVPLT)
    const loadAtLimitT = interpolateLoadAtSettlement(
      readings,
      this.settlementLimitMm,
      'LOADING'
    );
    const safeLoadFromSettlementT = loadAtLimitT
      ? roundTo((2 / 3) * loadAtLimitT)
      : null;

    // Safe load from ultimate capacity (10% of pile diameter)
    const ultimateLimitMm = 0.1 * meta.pileDiameterMm;
    const loadAt10PercentDiaT = interpolateLoadAtSettlement(
      readings,
      ultimateLimitMm,
      'LOADING'
    );
    const safeLoadFromUltimateT = loadAt10PercentDiaT
      ? roundTo(0.5 * loadAt10PercentDiaT)
      : null;

    // Determine governing safe load
    const { safeLoadAdoptedT, governingCriterion } = determineSafeLoad(
      meta.designLoadT,
      safeLoadFromSettlementT,
      safeLoadFromUltimateT
    );

    // Pass/fail determination
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
      loadAt10PercentDiaT: loadAt10PercentDiaT
        ? roundTo(loadAt10PercentDiaT)
        : null,
      safeLoadFromUltimateT,
      governingCriterion,
      safeLoadAdoptedT: roundTo(safeLoadAdoptedT),
      isPassed,
      settlementLimitMm: this.settlementLimitMm,
    };
  }

  /**
   * Get empty result when no readings exist.
   * Why: Provides safe defaults for UI display.
   */
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

  /**
   * Get IS 2911 acceptance criteria for IVPLT.
   * Why: Standard text for report and UI display.
   */
  getAcceptanceCriteria(meta: TestMeta): AcceptanceCriteria {
    const ultimateLimitMm = 0.1 * meta.pileDiameterMm;
    const twoPercentDia = 0.02 * meta.pileDiameterMm;

    return {
      description:
        'As per IS 2911 (Part 4) - 2013, Clause 6.3, the acceptance criteria for Initial Vertical Pile Load Test are:',
      criteria: [
        `Net settlement at design load shall not exceed 12mm or 2% of pile diameter (${twoPercentDia.toFixed(1)}mm), whichever is less.`,
        `Safe load shall be taken as two-thirds of the load at which total settlement equals 12mm.`,
        `Safe load shall not exceed half the load at which total settlement equals 10% of pile diameter (${ultimateLimitMm.toFixed(1)}mm).`,
        `The pile should sustain the test load (${meta.testLoadT.toFixed(1)} T) for 24 hours without exceeding the settlement limit.`,
      ],
      settlementLimitMm: this.settlementLimitMm,
      ultimateLimitMm,
    };
  }

  /**
   * Get chart configuration for Load vs Settlement graph.
   * Why: IVPLT uses standard load-settlement curve with Y-axis inverted.
   */
  getGraphConfig(meta: TestMeta): GraphConfig {
    return {
      title: 'Load vs Settlement Curve',
      xAxisLabel: 'Load (MT)',
      yAxisLabel: 'Settlement (mm)',
      yAxisInverted: true, // Settlement goes down
      loadingCurveColor: '#2563eb', // Blue
      holdCurveColor: '#f59e0b', // Amber
      unloadingCurveColor: '#10b981', // Green
      annotations: {
        safeLoadLine: true,
        settlementLimitLine: true,
        settlementLimitValue: this.settlementLimitMm,
      },
    };
  }

  /**
   * Get KPI configuration for dashboard display.
   * Why: Standard KPIs for vertical pile load tests.
   */
  getKPIConfig(): KPIConfig[] {
    return [
      {
        id: 'testLoad',
        label: 'Test Load',
        unit: 'MT',
        getValue: () => '-', // Set from meta, not result
        color: 'default',
      },
      {
        id: 'maxSettlement',
        label: 'Max Settlement',
        unit: 'mm',
        getValue: (result) => formatNumber(result.maxSettlementMm),
        color: 'default',
      },
      {
        id: 'elasticRebound',
        label: 'Elastic Rebound',
        unit: 'mm',
        getValue: (result) => formatNumber(result.elasticReboundMm),
        color: 'default',
      },
      {
        id: 'netSettlement',
        label: 'Net Settlement',
        unit: 'mm',
        getValue: (result) =>
          `${formatNumber(result.netSettlementMm)} / ${result.settlementLimitMm}`,
        color: 'default', // Dynamic coloring handled by UI
      },
      {
        id: 'safeLoad',
        label: 'Safe Load Adopted',
        unit: 'MT',
        getValue: (result) => formatNumber(result.safeLoadAdoptedT),
        color: 'success',
      },
      {
        id: 'status',
        label: 'Status',
        unit: '',
        getValue: (result) => (result.isPassed ? 'PASSED' : 'FAILED'),
        color: 'default', // Dynamic coloring handled by UI based on isPassed
      },
    ];
  }

  /**
   * Validate a reading before submission.
   * Why: Ensures data quality per IS 2911 requirements.
   */
  validateReading(reading: Partial<ReadingInput>): ValidationResult {
    const errors: string[] = [];

    if (reading.loadT !== undefined && reading.loadT < 0) {
      errors.push('Load cannot be negative');
    }

    if (reading.avgSettlementMm !== undefined && reading.avgSettlementMm < 0) {
      errors.push('Settlement cannot be negative');
    }

    if (reading.sequence !== undefined && reading.sequence < 1) {
      errors.push('Sequence number must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate test load from design load.
   * Formula: testLoad = designLoad × 2.5 (for IVPLT)
   */
  calculateTestLoad(designLoadT: number): number {
    return designLoadT * this.testLoadMultiplier;
  }

  /**
   * Get report sections with IS 2911 compliant wording.
   * Why: Professional report content matching sample reports.
   */
  getReportSections(data: ReportData): ReportSection[] {
    const { result } = data;

    return [
      {
        id: 'general',
        title: '1. GENERAL',
        content: `
          <p>This report presents the results of Initial Vertical Pile Load Test (IVPLT) conducted on pile ${data.pileId} 
          at ${data.location} for the project "${data.projectName}".</p>
          <p>The test was performed in accordance with IS 2911 (Part 4) - 2013 "Code of Practice for Design and 
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
            <tr><td>Design Safe Load</td><td>${data.designLoadT} MT</td></tr>
            <tr><td>Test Load (2.5 × Design Load)</td><td>${data.testLoadT} MT</td></tr>
          </table>
        `,
      },
      {
        id: 'methodology',
        title: '3. METHODOLOGY',
        content: `
          <p>The load test was conducted using the maintained load method as per IS 2911 (Part 4) - 2013.</p>
          <h4>Equipment Used:</h4>
          <ul>
            <li>Hydraulic Jack: ${data.jackName || 'As per site specifications'}</li>
            <li>Ram Area: ${data.ramAreaCm2} cm²</li>
            <li>Dial Gauge Least Count: ${data.gaugeLeastCountMm} mm</li>
          </ul>
          <h4>Test Procedure:</h4>
          <ol>
            <li>Load was applied in increments of 20% of design load up to test load.</li>
            <li>Each load increment was maintained until rate of settlement was less than 0.1mm/hour.</li>
            <li>Maximum load was maintained for 24 hours.</li>
            <li>Load was released in the same increments as loading.</li>
          </ol>
        `,
      },
      {
        id: 'results',
        title: '4. RESULTS',
        pageBreakBefore: true,
        content: `
          <h4>Settlement Analysis:</h4>
          <table>
            <tr><td>Maximum Settlement</td><td>${formatNumber(result.maxSettlementMm)} mm</td></tr>
            <tr><td>Elastic Rebound</td><td>${formatNumber(result.elasticReboundMm)} mm</td></tr>
            <tr><td>Net Settlement</td><td>${formatNumber(result.netSettlementMm)} mm</td></tr>
          </table>
          
          <h4>Safe Load Determination:</h4>
          <p>As per IS 2911 (Part 4) - 2013:</p>
          <ul>
            ${result.safeLoadFromSettlementT !== null ? `<li>Safe load from 12mm settlement criterion: ${formatNumber(result.safeLoadFromSettlementT)} MT</li>` : ''}
            ${result.safeLoadFromUltimateT !== null ? `<li>Safe load from 10% diameter criterion: ${formatNumber(result.safeLoadFromUltimateT)} MT</li>` : ''}
          </ul>
          <p><strong>Safe Load Adopted: ${formatNumber(result.safeLoadAdoptedT)} MT</strong></p>
          
          <h4>Acceptance Criteria Check:</h4>
          <p>Net Settlement (${formatNumber(result.netSettlementMm)} mm) ${result.isPassed ? '≤' : '>'} Limit (${this.settlementLimitMm} mm)</p>
          <p><strong>Test Result: ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</strong></p>
        `,
      },
    ];
  }

  /**
   * Get AI prompt for conclusion generation.
   * Why: Structured prompt produces consistent IS 2911-compliant conclusions.
   */
  getAIConclusionPrompt(result: CalculationResult, data: ReportData): string {
    return `Generate a professional conclusion paragraph for an Initial Vertical Pile Load Test (IVPLT) report.

Test Details:
- Pile ID: ${data.pileId}
- Pile Diameter: ${data.pileDiameterMm} mm
- Design Load: ${data.designLoadT} MT
- Test Load: ${data.testLoadT} MT

Test Results:
- Maximum Settlement: ${result.maxSettlementMm} mm
- Elastic Rebound: ${result.elasticReboundMm} mm
- Net Settlement: ${result.netSettlementMm} mm
- Settlement Limit (IS 2911): ${result.settlementLimitMm} mm
- Safe Load Adopted: ${result.safeLoadAdoptedT} MT
- Test Status: ${result.isPassed ? 'PASSED' : 'FAILED'}

Requirements:
1. Reference IS 2911 (Part 4) - 2013 standard
2. State the maximum settlement, elastic rebound, and net settlement
3. Confirm or deny that net settlement is within the 12mm limit
4. State the safe load that can be adopted
5. ${result.isPassed ? 'Confirm the pile is suitable for the design load' : 'Recommend further investigation or remedial measures'}
6. Keep the conclusion to 2-3 paragraphs
7. Use formal engineering language`;
  }
}

