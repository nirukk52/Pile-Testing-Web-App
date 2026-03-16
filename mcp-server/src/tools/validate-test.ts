/**
 * validate_test MCP Tool
 * Why: Runs IS 2911 calculations via the test engine and then runs the
 * verification agent to check data integrity and compliance. Returns
 * computation results, pass/fail, and any issues found.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ReadingInputSchema = z.object({
  sequence: z.number().int().min(1).describe("Reading sequence number"),
  phase: z.enum(["LOADING", "HOLD", "UNLOADING"]).describe("Test phase"),
  loadT: z.number().min(0).describe("Applied load in metric tons"),
  avgSettlementMm: z.number().describe("Average settlement from dial gauges in mm"),
});

const ValidateTestInputSchema = z.object({
  test_type: z
    .enum(["IVPLT", "RVPLT", "LATERAL", "UPLIFT"])
    .default("IVPLT")
    .describe("Pile load test type"),
  pile_diameter_mm: z.number().positive().describe("Pile diameter in mm"),
  pile_depth_m: z.number().positive().describe("Pile depth in metres"),
  design_load_t: z.number().positive().describe("Design load in metric tons"),
  test_load_t: z.number().positive().describe("Test load in metric tons"),
  ram_area_cm2: z.number().positive().describe("Hydraulic ram area in cm²"),
  readings: z
    .array(ReadingInputSchema)
    .min(1)
    .describe("Array of test readings in sequence order"),
  project_info: z
    .record(z.unknown())
    .optional()
    .describe("Optional project info for verification agent (legacy format)"),
});

type ValidateTestInput = z.infer<typeof ValidateTestInputSchema>;

/**
 * Register the piletest_validate_test tool on the given MCP server.
 */
export function registerValidateTest(server: McpServer): void {
  server.registerTool(
    "piletest_validate_test",
    {
      title: "Validate Pile Load Test",
      description: `Run IS 2911 calculations and verification checks on test data.

Calculates settlement, rebound, safe load, and pass/fail per IS 2911 Part 4.
Then runs the verification agent for data integrity and compliance scoring.

Args:
  - test_type: IVPLT | RVPLT | LATERAL | UPLIFT
  - pile_diameter_mm, pile_depth_m, design_load_t, test_load_t, ram_area_cm2
  - readings: array of {sequence, phase, loadT, avgSettlementMm}
  - project_info: optional legacy project info for verification

Returns:
  {
    calculation: CalculationResult (maxSettlement, netSettlement, safeLoad, isPassed...),
    verification: VerificationReport (score, status, issues[])
  }`,
      inputSchema: ValidateTestInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ValidateTestInput) => {
      try {
        const { getTestEngine } = await import("@/engines");
        const { verifyTest } = await import("@/lib/ai/verification-agent");

        const engine = getTestEngine(params.test_type);

        const readingInputs = params.readings.map((r) => ({
          sequence: r.sequence,
          phase: r.phase as "LOADING" | "HOLD" | "UNLOADING",
          loadT: r.loadT,
          avgSettlementMm: r.avgSettlementMm,
        }));

        const meta = {
          pileDiameterMm: params.pile_diameter_mm,
          pileDepthM: params.pile_depth_m,
          designLoadT: params.design_load_t,
          testLoadT: params.test_load_t,
          ramAreaCm2: params.ram_area_cm2,
        };

        const calculation = engine.calculate(readingInputs, meta);

        // Run verification if project info is provided
        let verification = null;
        if (params.project_info) {
          const legacyProjectInfo = params.project_info as Record<string, unknown>;
          const legacyEntries = params.readings.map((r) => ({
            id: `reading-${r.sequence}`,
            phase: r.phase.toLowerCase() as "loading" | "holding" | "unloading",
            loadAppliedTons: r.loadT,
            averageSettlementMm: r.avgSettlementMm,
            timestamp: new Date().toISOString(),
            pressureGauge: 0,
            dialGauge1: 0,
            dialGauge2: 0,
            dialGauge3: 0,
            dialGauge4: 0,
            createdAt: new Date().toISOString(),
          }));

          verification = verifyTest(
            "mcp-validation",
            legacyProjectInfo as unknown as Parameters<typeof verifyTest>[1],
            legacyEntries as unknown as Parameters<typeof verifyTest>[2]
          );
        }

        const output = {
          calculation,
          verification,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
