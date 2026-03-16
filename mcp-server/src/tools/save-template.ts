/**
 * save_template MCP Tool
 * Why: Saves reusable project presets (client, contractor, pile specs, equipment)
 * so repeated tests for the same project don't require re-entering common fields.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SaveTemplateInputSchema = z.object({
  name: z.string().min(1).max(100).describe("Unique template name, e.g. 'Site A - 900mm IVPLT'"),
  test_type: z.enum(["IVPLT", "RVPLT", "LATERAL", "UPLIFT"]).default("IVPLT"),
  client: z.string().optional().describe("Client / Owner name"),
  contractor: z.string().optional().describe("Contractor name"),
  pmc: z.string().optional().describe("Project Management Consultant"),
  location: z.string().optional().describe("Project location"),
  pile_diameter_mm: z.number().positive().optional(),
  pile_depth_m: z.number().positive().optional(),
  concrete_grade: z.string().optional(),
  design_load_t: z.number().positive().optional(),
  ram_area_cm2: z.number().positive().optional(),
  jack_name: z.string().optional(),
});

type SaveTemplateInput = z.infer<typeof SaveTemplateInputSchema>;

/**
 * Register the piletest_save_template tool on the given MCP server.
 */
export function registerSaveTemplate(server: McpServer): void {
  server.registerTool(
    "piletest_save_template",
    {
      title: "Save Project Template",
      description: `Save a reusable project template with common fields (client, contractor,
pile specs, equipment). Future tests can apply this template to auto-fill fields.

Args:
  - name (string): Unique template name
  - test_type: IVPLT | RVPLT | LATERAL | UPLIFT
  - client, contractor, pmc, location, pile specs, equipment (all optional)

Returns:
  The saved template record. Returns error if name already exists.`,
      inputSchema: SaveTemplateInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: SaveTemplateInput) => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const template = await prisma.template.create({
          data: {
            name: params.name,
            testType: params.test_type,
            client: params.client || null,
            contractor: params.contractor || null,
            pmc: params.pmc || null,
            location: params.location || null,
            pileDiameterMm: params.pile_diameter_mm || null,
            pileDepthM: params.pile_depth_m || null,
            concreteGrade: params.concrete_grade || null,
            designLoadT: params.design_load_t || null,
            ramAreaCm2: params.ram_area_cm2 || null,
            jackName: params.jack_name || null,
          },
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(template, null, 2) }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Unique constraint")) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error: Template '${params.name}' already exists. Use a different name or update the existing one.`,
              },
            ],
          };
        }
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
        };
      }
    }
  );
}
