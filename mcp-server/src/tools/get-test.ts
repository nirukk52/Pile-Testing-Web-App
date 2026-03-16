/**
 * get_test MCP Tool
 * Why: Reads full test data from DB including all related records,
 * allowing the agent to inspect or present test details to the user.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const GetTestInputSchema = z.object({
  test_id: z.string().uuid().describe("UUID of the test to retrieve"),
});

type GetTestInput = z.infer<typeof GetTestInputSchema>;

/**
 * Register the piletest_get_test tool on the given MCP server.
 */
export function registerGetTest(server: McpServer): void {
  server.registerTool(
    "piletest_get_test",
    {
      title: "Get Test Data",
      description: `Retrieve full test data from the database including project, readings,
site images, field readings, and calibration certificates.

Args:
  - test_id (string): UUID of the test

Returns:
  Complete test record with all relations (project, readings, siteImages,
  fieldReadings, certificates). Returns error if test not found.`,
      inputSchema: GetTestInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: GetTestInput) => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const test = await prisma.test.findUnique({
          where: { id: params.test_id },
          include: {
            project: true,
            readings: { orderBy: { sequence: "asc" } },
            siteImages: { orderBy: { displayOrder: "asc" } },
            fieldReadings: { orderBy: { createdAt: "asc" } },
            certificates: { orderBy: { createdAt: "asc" } },
          },
        });

        if (!test) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Test ${params.test_id} not found.` }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(test, null, 2) }],
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
