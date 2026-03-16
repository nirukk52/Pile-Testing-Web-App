/**
 * apply_template MCP Tool
 * Why: Loads a saved project template and returns the field values,
 * allowing the agent to pre-fill test creation with known defaults.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ApplyTemplateInputSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("Template name to load. If omitted, lists all available templates."),
});

type ApplyTemplateInput = z.infer<typeof ApplyTemplateInputSchema>;

/**
 * Register the piletest_apply_template tool on the given MCP server.
 */
export function registerApplyTemplate(server: McpServer): void {
  server.registerTool(
    "piletest_apply_template",
    {
      title: "Apply / List Project Templates",
      description: `Load a saved project template or list all available templates.

If name is provided: returns the template fields to pre-fill test creation.
If name is omitted: returns a list of all available template names.

Args:
  - name (string, optional): Template name to load

Returns:
  Template fields or list of template names.`,
      inputSchema: ApplyTemplateInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ApplyTemplateInput) => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        if (!params.name) {
          const templates = await prisma.template.findMany({
            select: { name: true, testType: true, client: true, location: true },
            orderBy: { name: "asc" },
          });

          if (templates.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No templates saved yet. Use piletest_save_template to create one." }],
            };
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify({ templates }, null, 2) }],
          };
        }

        const template = await prisma.template.findUnique({
          where: { name: params.name },
        });

        if (!template) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error: Template '${params.name}' not found. Use piletest_apply_template without a name to list available templates.`,
              },
            ],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(template, null, 2) }],
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
