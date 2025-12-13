/**
 * AI Conclusion Agent for IVPLT Reports
 * Why: Generates IS 2911-compliant conclusions using OpenAI Agents SDK.
 * Falls back to static template when API key is missing or API fails.
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
 */
const conclusionAgent = new Agent({
  name: 'IVPLT Conclusion Generator',
  model: 'gpt-4o-mini',
  instructions: `You are a professional civil engineering report writer specializing in pile load tests per IS 2911 (Part 4) - 2013.

Your task is to write a formal conclusion paragraph for an Initial Vertical Pile Load Test (IVPLT) report.

REQUIREMENTS:
1. Reference IS 2911 (Part 4) - 2013 standard explicitly
2. State the acceptance criteria for vertical pile load test
3. Report the maximum settlement, elastic rebound, and net settlement values
4. Compare net settlement against the 12mm limit
5. State whether the pile PASSED or FAILED the test
6. Conclude with the safe load that can be adopted for working piles
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
 * Template based on reference report: report-ivplt-tp-02 600m.md
 */
function generateStaticConclusion(
  result: CalculationResult,
  data: ReportData
): string {
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

