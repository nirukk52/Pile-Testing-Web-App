/**
 * store_file MCP Tool
 * Why: Saves an uploaded file to local storage without associating it to a test yet.
 * Returns the storage path for later use with attach_file.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";

const StoreFileInputSchema = z.object({
  file_path: z
    .string()
    .optional()
    .describe("Absolute path to the file on disk"),
  file_base64: z
    .string()
    .optional()
    .describe("Base64-encoded file contents"),
  file_name: z.string().describe("Original filename with extension"),
  bucket: z
    .enum(["site-images", "certificates", "field-readings", "source-files"])
    .describe("Storage bucket/category for the file"),
  subfolder: z
    .string()
    .optional()
    .describe("Optional subfolder (typically testId) within the bucket"),
});

type StoreFileInput = z.infer<typeof StoreFileInputSchema>;

/**
 * Register the piletest_store_file tool on the given MCP server.
 */
export function registerStoreFile(server: McpServer): void {
  server.registerTool(
    "piletest_store_file",
    {
      title: "Store File to Local Storage",
      description: `Save a file to the local uploads directory.

Returns the storage path that can be used with piletest_attach_file to
associate the file with a test record in the database.

Args:
  - file_path (string, optional): Absolute path to file
  - file_base64 (string, optional): Base64-encoded contents
  - file_name (string): Original filename
  - bucket: site-images | certificates | field-readings | source-files
  - subfolder (string, optional): Subfolder within bucket

Returns:
  { storage_path, bucket, full_path }`,
      inputSchema: StoreFileInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: StoreFileInput) => {
      try {
        const { uploadFile } = await import("@/lib/storage");

        if (!params.file_path && !params.file_base64) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Error: Provide either file_path or file_base64." }],
          };
        }

        let buffer: Buffer;
        if (params.file_path) {
          buffer = await fs.readFile(params.file_path);
        } else {
          buffer = Buffer.from(params.file_base64!, "base64");
        }

        const timestamp = Date.now();
        const safeFileName = params.file_name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const relativePath = params.subfolder
          ? `${params.subfolder}/${timestamp}_${safeFileName}`
          : `${timestamp}_${safeFileName}`;

        const { path: storagePath, error } = await uploadFile(params.bucket, relativePath, buffer);

        if (error) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          };
        }

        const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(process.cwd(), "uploads");
        const fullPath = path.join(STORAGE_ROOT, params.bucket, storagePath);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ storage_path: storagePath, bucket: params.bucket, full_path: fullPath }),
            },
          ],
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
