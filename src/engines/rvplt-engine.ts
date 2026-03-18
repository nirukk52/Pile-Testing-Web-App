/**
 * RVPLT (Routine Vertical Pile Load Test) Engine
 * Why: Implements IS 2911 Part 4 - 2013, Clause 7.1.5.1 calculations for routine vertical tests.
 * Key difference from IVPLT: 1.5x multiplier, pass/fail only (no safe load interpolation),
 * variable settlement limit based on pile diameter.
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
  determinePassFail,
  roundTo,
  formatNumber,
} from '@/lib/calculations';

/**
 * RVPLT Engine - Routine Vertical Pile Load Test
 * Why: Production piles are tested at 1.5x design load with pass/fail criteria only.
 * No safe load interpolation is performed — the pile either passes or fails.
 */
export class RvpltEngine implements ITestEngine {
  readonly testType: TestType = 'RVPLT';
  readonly displayName = 'RVPLT';
  readonly fullName = 'Routine Vertical Pile Load Test';
  readonly testLoadMultiplier = 1.5;
  readonly settlementLimitMm = 12;

  /**
   * Effective settlement limit depends on pile diameter.
   * IS 2911 Clause 7.1.5.1: 12mm for dia <= 600mm, min(18mm, 2% dia) for dia > 600mm.
   */
  private getEffectiveLimit(pileDiameterMm: number): number {
    if (pileDiameterMm <= 600) return 12;
    return Math.min(18, 0.02 * pileDiameterMm);
  }

  calculate(readings: ReadingInput[], meta: TestMeta): CalculationResult {
    if (readings.length === 0) {
      return this.getEmptyResult(meta.designLoadT);
    }

    const effectiveLimit = this.getEffectiveLimit(meta.pileDiameterMm);
    const maxSettlementMm = roundTo(findMaxSettlement(readings));
    const elasticReboundMm = roundTo(calculateElasticRebound(readings));
    const netSettlementMm = roundTo(calculateNetSettlement(readings));

    const isPassed = determinePassFail(
      netSettlementMm,
      effectiveLimit,
      meta.pileDiameterMm
    );

    return {
      maxSettlementMm,
      elasticReboundMm,
      netSettlementMm,
      loadAtLimitT: null,
      safeLoadFromSettlementT: null,
      loadAt10PercentDiaT: null,
      safeLoadFromUltimateT: null,
      governingCriterion: 'DESIGN',
      safeLoadAdoptedT: meta.designLoadT,
      isPassed,
      settlementLimitMm: effectiveLimit,
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
    const effectiveLimit = this.getEffectiveLimit(meta.pileDiameterMm);
    const ultimateLimitMm = 0.1 * meta.pileDiameterMm;

    return {
      description:
        'As per IS 2911 (Part 4) - 2013, Clause 7.1.5.1, the acceptance criteria for Routine Vertical Pile Load Test are:',
      criteria: [
        `Net settlement at test load (1.5× design load) shall not exceed ${effectiveLimit.toFixed(1)}mm.`,
        `The pile should sustain the test load (${meta.testLoadT.toFixed(1)} T) for the required hold duration without exceeding the settlement limit.`,
        `If net settlement exceeds the limit, the pile is deemed to have failed the routine test.`,
      ],
      settlementLimitMm: effectiveLimit,
      ultimateLimitMm,
    };
  }

  getGraphConfig(_meta: TestMeta): GraphConfig {
    return {
      title: 'Load vs Settlement Curve',
      xAxisLabel: 'Load (MT)',
      yAxisLabel: 'Settlement (mm)',
      yAxisInverted: true,
      loadingCurveColor: '#2563eb',
      holdCurveColor: '#f59e0b',
      unloadingCurveColor: '#10b981',
      annotations: {
        safeLoadLine: false,
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
        color: 'default',
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
      errors.push('Settlement cannot be negative');
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
          <p>This report presents the results of Routine Vertical Pile Load Test (RVPLT) conducted on pile ${data.pileId}
          at ${data.location} for the project "${data.projectName}".</p>
          <p>The test was performed in accordance with IS 2911 (Part 4) - 2013, Clause 7.1.5.1 "Code of Practice for Design and
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
            <tr><td>Test Load (1.5 × Design Load)</td><td>${data.testLoadT} MT</td></tr>
          </table>
        `,
      },
      {
        id: 'methodology',
        title: '3. METHODOLOGY',
        content: `
          <p>The routine load test was conducted using the maintained load method as per IS 2911 (Part 4) - 2013.</p>
          <h4>Equipment Used:</h4>
          <ul>
            <li>Hydraulic Jack: ${data.jackName || 'As per site specifications'}</li>
            <li>Ram Area: ${data.ramAreaCm2} cm²</li>
            <li>Dial Gauge Least Count: ${data.gaugeLeastCountMm} mm</li>
          </ul>
          <h4>Test Procedure:</h4>
          <ol>
            <li>Load was applied in increments of 25% of design load up to test load (1.5× design load).</li>
            <li>Each load increment was maintained until rate of settlement was less than 0.1mm/hour.</li>
            <li>Maximum load was maintained for the required hold duration.</li>
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

          <h4>Acceptance Criteria Check (Pass/Fail):</h4>
          <p>Net Settlement (${formatNumber(result.netSettlementMm)} mm) ${result.isPassed ? '≤' : '>'} Limit (${result.settlementLimitMm} mm)</p>
          <p><strong>Test Result: ${result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}</strong></p>
        `,
      },
    ];
  }

  getAIConclusionPrompt(result: CalculationResult, data: ReportData): string {
    return `Generate a professional conclusion paragraph for a Routine Vertical Pile Load Test (RVPLT) report.

Test Details:
- Pile ID: ${data.pileId}
- Pile Diameter: ${data.pileDiameterMm} mm
- Design Load: ${data.designLoadT} MT
- Test Load (1.5×): ${data.testLoadT} MT

Test Results:
- Maximum Settlement: ${result.maxSettlementMm} mm
- Elastic Rebound: ${result.elasticReboundMm} mm
- Net Settlement: ${result.netSettlementMm} mm
- Settlement Limit: ${result.settlementLimitMm} mm
- Test Status: ${result.isPassed ? 'PASSED' : 'FAILED'}

Requirements:
1. Reference IS 2911 (Part 4) - 2013, Clause 7.1.5.1
2. State the maximum settlement, elastic rebound, and net settlement
3. Confirm or deny that net settlement is within the limit
4. This is a pass/fail test — no safe load calculation is needed
5. ${result.isPassed ? 'Confirm the pile is suitable for the design load' : 'Recommend further investigation or remedial measures'}
6. Keep the conclusion to 2-3 paragraphs
7. Use formal engineering language`;
  }
}
