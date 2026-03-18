/**
 * AI Conclusion Agent for Pile Load Test Reports
 * Why: Generates IS 2911-compliant conclusions using OpenAI Agents SDK.
 * Falls back to static template when API key is missing or API fails.
 * Supports all test types: IVPLT, RVPLT, Lateral, and Uplift.
 */

import { Agent, run } from '@openai/agents';
import type { CalculationResult, ReportData } from '@/engines';

/**
 * Response from the conclusion generator.
 * Why: Includes metadata about generation source for UI display.
 */
export interface ConclusionResponse {
  conclusion: string;
  isAIGenerated: boolean;
  error?: string;
}

/**
 * The Pile Load Test Conclusion Agent.
 * Why: Specialized agent for generating IS 2911 compliant conclusions.
 * Works for all test types — the engine passes a type-specific prompt.
 */
const conclusionAgent = new Agent({
  name: 'Pile Load Test Conclusion Generator',
  model: 'gpt-4o-mini',
  instructions: `You are a professional civil engineering report writer specializing in pile load tests per IS 2911 (Part 4) - 2013.

Your task is to write a formal conclusion paragraph for a pile load test report.

REQUIREMENTS:
1. Reference IS 2911 (Part 4) - 2013 standard and the applicable clause explicitly
2. State the acceptance criteria relevant to the specific test type
3. Report the key measurement values from the test data
4. Compare results against the applicable limits
5. State whether the pile PASSED or FAILED the test
6. Where applicable, conclude with the safe load that can be adopted
7. Use formal, technical engineering language
8. Keep the conclusion to 2-3 concise paragraphs
9. Do not use bullet points in the conclusion - write in prose

STYLE:
- Professional and authoritative tone
- Reference specific numerical values from the test data
- Avoid hedging language - be definitive in conclusions
- Use metric units (mm, MT, meters)`,
});

/**
 * Generate a static fallback conclusion when AI is unavailable.
 * Why: Ensures report can always have a conclusion even without API access.
 * Branches by test type so RVPLT/Lateral/Uplift get appropriate wording.
 */
function generateStaticConclusion(
  result: CalculationResult,
  data: ReportData
): string {
  const testType = data.testType;

  if (testType === 'RVPLT') {
    return generateRvpltStaticConclusion(result, data);
  }
  if (testType === 'LATERAL') {
    return generateLateralStaticConclusion(result, data);
  }
  if (testType === 'UPLIFT') {
    return generateUpliftStaticConclusion(result, data);
  }

  return generateIvpltStaticConclusion(result, data);
}

/**
 * Why: IVPLT uses 12mm settlement limit and safe load from two IS 2911 criteria.
 */
function generateIvpltStaticConclusion(result: CalculationResult, data: ReportData): string {
  const passFailStatement = result.isPassed
    ? `the test pile has shown adequate load carrying capacity for the design load of ${data.designLoadT}T`
    : `the test pile has not met the acceptance criteria and further investigation is recommended`;

  const safeLoadStatement = result.isPassed
    ? `${result.safeLoadAdoptedT}T can be adopted as the safe vertical load for working piles.`
    : `The pile requires remedial measures or design review before adoption.`;

  return `The Safe Capacity of Piles is considered to be the least of the following as per IS 2911 (Part 4) - 2013:
• Two thirds of load at which total settlement attains a value of 12mm or maximum of 2% of the pile diameter (${(0.02 * data.pileDiameterMm).toFixed(1)}mm), whichever is less.
• 50% of the load corresponding to a settlement of 10% of pile diameter (${(0.1 * data.pileDiameterMm).toFixed(1)}mm).

The Maximum settlement as per our field record at ${data.testLoadT}T = ${result.maxSettlementMm.toFixed(2)}mm.
Total Rebound = ${result.elasticReboundMm.toFixed(2)}mm.
The net settlement = ${result.netSettlementMm.toFixed(2)}mm.

As per the test data and the load-settlement graph, ${passFailStatement}. ${safeLoadStatement}`;
}

/**
 * Why: RVPLT is pass/fail only — no safe load determination. References Clause 7.1.5.1.
 */
function generateRvpltStaticConclusion(result: CalculationResult, data: ReportData): string {
  const passFailStatement = result.isPassed
    ? `the pile has satisfactorily withstood the routine test load and is adequate for the design load of ${data.designLoadT}T`
    : `the pile has not met the acceptance criteria under routine testing and further investigation is recommended`;

  return `As per IS 2911 (Part 4) - 2013, Clause 7.1.5.1, the routine vertical pile load test was conducted at 1.5 times the design load (${data.testLoadT}T).

The Maximum settlement as per our field record at ${data.testLoadT}T = ${result.maxSettlementMm.toFixed(2)}mm.
Total Rebound = ${result.elasticReboundMm.toFixed(2)}mm.
The net settlement = ${result.netSettlementMm.toFixed(2)}mm, against the permissible limit of ${result.settlementLimitMm}mm.

As per the test data, ${passFailStatement}.`;
}

/**
 * Why: Lateral uses deflection (not settlement), 5mm/12mm criteria. References Clause 8.4.
 */
function generateLateralStaticConclusion(result: CalculationResult, data: ReportData): string {
  const passFailStatement = result.isPassed
    ? `the pile has demonstrated adequate lateral load carrying capacity for the design lateral load of ${data.designLoadT}T`
    : `the pile has not met the lateral acceptance criteria and further investigation is recommended`;

  const safeLoadStatement = result.isPassed
    ? `${result.safeLoadAdoptedT}T can be adopted as the safe lateral load for working piles.`
    : `The pile requires remedial measures or design review before adoption.`;

  return `As per IS 2911 (Part 4) - 2013, Clause 8.4, the safe lateral load is the least of: the load at 5mm deflection, and half the load at 12mm deflection.

The Maximum deflection as per our field record at ${data.testLoadT}T = ${result.maxSettlementMm.toFixed(2)}mm.
Elastic Recovery = ${result.elasticReboundMm.toFixed(2)}mm.
The net deflection = ${result.netSettlementMm.toFixed(2)}mm, against the permissible limit of ${result.settlementLimitMm}mm.

As per the test data and the load-deflection graph, ${passFailStatement}. ${safeLoadStatement}`;
}

/**
 * Why: Uplift uses 12mm uplift limit with optional yield consideration. References Clause 9.4.
 */
function generateUpliftStaticConclusion(result: CalculationResult, data: ReportData): string {
  const passFailStatement = result.isPassed
    ? `the pile has demonstrated adequate uplift resistance for the design uplift load of ${data.designLoadT}T`
    : `the pile has not met the uplift acceptance criteria and further investigation is recommended`;

  const safeLoadStatement = result.isPassed
    ? `${result.safeLoadAdoptedT}T can be adopted as the safe uplift load for working piles.`
    : `The pile requires remedial measures or design review before adoption.`;

  return `As per IS 2911 (Part 4) - 2013, Clause 9.4, the safe uplift load is the least of: two-thirds of the load at 12mm uplift, and half the load at yield/break point (if observed).

The Maximum uplift as per our field record at ${data.testLoadT}T = ${result.maxSettlementMm.toFixed(2)}mm.
Elastic Recovery = ${result.elasticReboundMm.toFixed(2)}mm.
The net uplift = ${result.netSettlementMm.toFixed(2)}mm, against the permissible limit of ${result.settlementLimitMm}mm.

As per the test data and the load-uplift graph, ${passFailStatement}. ${safeLoadStatement}`;
}

/**
 * Generate a conclusion using AI or fallback to static template.
 * Why: Main entry point for conclusion generation with graceful degradation.
 */
export async function generateConclusion(
  prompt: string,
  result: CalculationResult,
  data: ReportData
): Promise<ConclusionResponse> {
  // Check if OpenAI API key is available
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-...' || apiKey.length < 20) {
    console.log('OpenAI API key not configured, using static template');
    return {
      conclusion: generateStaticConclusion(result, data),
      isAIGenerated: false,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    // Run the AI agent with the prompt from engine.getAIConclusionPrompt()
    const response = await run(conclusionAgent, prompt);

    if (!response.finalOutput) {
      throw new Error('No output from AI agent');
    }

    return {
      conclusion: response.finalOutput,
      isAIGenerated: true,
    };
  } catch (error) {
    console.error('AI conclusion generation failed:', error);

    // Fallback to static template on any error
    return {
      conclusion: generateStaticConclusion(result, data),
      isAIGenerated: false,
      error: error instanceof Error ? error.message : 'AI generation failed',
    };
  }
}

/**
 * Export static generator for testing purposes.
 * Why: Allows unit testing of fallback template.
 */
export { generateStaticConclusion };

