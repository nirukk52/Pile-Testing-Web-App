/**
 * ingest_file MCP Tool
 * Why: Routes uploaded files to the correct parser (Vision AI for PDF/images,
 * xlsx parser for Excel) and returns structured extraction results with confidence scores.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";

const IngestFileInputSchema = z.object({
  file_path: z
    .string()
    .optional()
    .describe("Absolute path to the file on disk. Provide either file_path or file_base64."),
  file_base64: z
    .string()
    .optional()
    .describe("Base64-encoded file contents. Provide either file_path or file_base64."),
  mime_type: z
    .string()
    .describe("MIME type of the file, e.g. application/pdf, image/jpeg, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  file_name: z
    .string()
    .optional()
    .describe("Original filename (used for Excel sheet naming)"),
});

type IngestFileInput = z.infer<typeof IngestFileInputSchema>;

/**
 * Register the piletest_ingest_file tool on the given MCP server.
 * Why: Single registration function keeps index.ts clean.
 */
export function registerIngestFile(server: McpServer): void {
  server.registerTool(
    "piletest_ingest_file",
    {
      title: "Ingest Field Sheet / Excel",
      description: `Extract project info and readings from a pile load test document.

Routes PDF/image files to the Gemini Vision extraction pipeline and Excel files
to the deterministic xlsx parser. Returns structured JSON with confidence scores.

Args:
  - file_path (string, optional): Absolute path to file on disk
  - file_base64 (string, optional): Base64-encoded file contents
  - mime_type (string): MIME type of the file
  - file_name (string, optional): Original filename

Returns:
  Structured extraction result with projectInfo, readings, and confidence metadata.
  Shape matches training-data expected.json for parity testing.

Error Handling:
  - Returns error if neither file_path nor file_base64 is provided
  - Returns error if GEMINI_API_KEY is missing for PDF/image files
  - Returns error if file cannot be read or parsed`,
      inputSchema: IngestFileInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: IngestFileInput) => {
      try {
        if (!params.file_path && !params.file_base64) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Error: Provide either file_path or file_base64." }],
          };
        }

        const isExcel =
          params.mime_type.includes("spreadsheet") ||
          params.mime_type.includes("excel") ||
          params.mime_type === "text/csv";

        if (isExcel) {
          return await handleExcel(params);
        } else {
          return await handleVisionExtraction(params);
        }
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

/**
 * Handle Excel/CSV files via the deterministic xlsx parser.
 */
async function handleExcel(params: IngestFileInput) {
  const { parseExcelBuffer } = await import("@/lib/parsers/excel-parser");

  let buffer: Buffer;
  if (params.file_path) {
    buffer = await fs.readFile(params.file_path);
  } else {
    buffer = Buffer.from(params.file_base64!, "base64");
  }

  const fileName = params.file_name || path.basename(params.file_path || "upload.xlsx");
  const result = parseExcelBuffer(buffer, fileName);

  const output = {
    source: "excel-parser",
    extractedProjectInfo: result.extractedProjectInfo,
    extractedReadings: result.extractedReadings,
    overallConfidence: result.overallConfidence,
    lowConfidenceFields: result.lowConfidenceFields,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
  };
}

/**
 * Handle PDF/image files via the Gemini Vision agent swarm.
 */
async function handleVisionExtraction(params: IngestFileInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: "Error: GEMINI_API_KEY environment variable is required for PDF/image extraction.",
        },
      ],
    };
  }

  const { runAgentSwarm } = await import("@/lib/ai/agent-swarm");

  let pageImages: string[];

  if (params.mime_type.startsWith("image/")) {
    // Single image — wrap as base64 data URI
    let base64: string;
    if (params.file_path) {
      const buf = await fs.readFile(params.file_path);
      base64 = buf.toString("base64");
    } else {
      base64 = params.file_base64!;
    }
    pageImages = [`data:${params.mime_type};base64,${base64}`];
  } else {
    // PDF — convert pages to images
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfToImgModule: any = await import("pdf-to-img");
    const convert = pdfToImgModule.default ?? pdfToImgModule;

    let pdfBuffer: Buffer;
    if (params.file_path) {
      pdfBuffer = await fs.readFile(params.file_path);
    } else {
      pdfBuffer = Buffer.from(params.file_base64!, "base64");
    }

    pageImages = [];
    const doc = await (convert as (buf: Buffer, opts: { scale: number }) => AsyncIterable<Uint8Array>)(pdfBuffer, { scale: 2.0 });
    for await (const page of doc) {
      const b64 = Buffer.from(page).toString("base64");
      pageImages.push(`data:image/png;base64,${b64}`);
    }
  }

  const result = await runAgentSwarm(pageImages, apiKey);

  const output = {
    source: "agent-swarm",
    projectInfo: result.projectInfo,
    readings: result.readings,
    extractedRowCount: result.extractedRowCount,
    lowConfidenceCount: result.lowConfidenceCount,
    model: result.model,
    extractedAt: result.extractedAt,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
  };
}
