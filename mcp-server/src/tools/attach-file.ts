/**
 * attach_file MCP Tool
 * Why: Associates a stored file with a test record in the database.
 * Creates the appropriate DB record (SiteImage, FieldReading, or CalibrationCertificate).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const AttachFileInputSchema = z.object({
  test_id: z.string().uuid().describe("UUID of the test to attach the file to"),
  storage_path: z.string().describe("Storage path returned by piletest_store_file"),
  file_name: z.string().describe("Original filename"),
  attachment_type: z
    .enum(["site_image", "field_reading", "certificate"])
    .describe("Type of attachment"),
  caption: z
    .string()
    .max(200)
    .optional()
    .describe("Caption for site images (max 200 chars)"),
});

type AttachFileInput = z.infer<typeof AttachFileInputSchema>;

/**
 * Register the piletest_attach_file tool on the given MCP server.
 */
export function registerAttachFile(server: McpServer): void {
  server.registerTool(
    "piletest_attach_file",
    {
      title: "Attach File to Test",
      description: `Associate a stored file with a test by creating the appropriate DB record.

Supports three attachment types:
- site_image: Creates SiteImage record (max 4 per test)
- field_reading: Creates FieldReading record (max 5 per test)
- certificate: Creates CalibrationCertificate record (max 6 per test)

Args:
  - test_id (string): UUID of the test
  - storage_path (string): Path from piletest_store_file
  - file_name (string): Original filename
  - attachment_type: site_image | field_reading | certificate
  - caption (string, optional): Caption for site images

Returns:
  The created database record.`,
      inputSchema: AttachFileInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: AttachFileInput) => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const test = await prisma.test.findUnique({
          where: { id: params.test_id },
          select: { id: true },
        });

        if (!test) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Test ${params.test_id} not found.` }],
          };
        }

        let record: unknown;

        switch (params.attachment_type) {
          case "site_image": {
            const count = await prisma.siteImage.count({ where: { testId: params.test_id } });
            if (count >= 4) {
              return {
                isError: true,
                content: [{ type: "text" as const, text: "Error: Maximum 4 site images per test." }],
              };
            }
            const lastImg = await prisma.siteImage.findFirst({
              where: { testId: params.test_id },
              orderBy: { displayOrder: "desc" },
              select: { displayOrder: true },
            });
            record = await prisma.siteImage.create({
              data: {
                testId: params.test_id,
                storagePath: params.storage_path,
                fileName: params.file_name,
                caption: params.caption || null,
                displayOrder: (lastImg?.displayOrder ?? 0) + 1,
              },
            });
            break;
          }
          case "field_reading": {
            const count = await prisma.fieldReading.count({ where: { testId: params.test_id } });
            if (count >= 5) {
              return {
                isError: true,
                content: [{ type: "text" as const, text: "Error: Maximum 5 field readings per test." }],
              };
            }
            record = await prisma.fieldReading.create({
              data: {
                testId: params.test_id,
                storagePath: params.storage_path,
                fileName: params.file_name,
              },
            });
            break;
          }
          case "certificate": {
            const count = await prisma.calibrationCertificate.count({ where: { testId: params.test_id } });
            if (count >= 6) {
              return {
                isError: true,
                content: [{ type: "text" as const, text: "Error: Maximum 6 certificates per test." }],
              };
            }
            record = await prisma.calibrationCertificate.create({
              data: {
                testId: params.test_id,
                storagePath: params.storage_path,
                fileName: params.file_name,
              },
            });
            break;
          }
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }],
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
