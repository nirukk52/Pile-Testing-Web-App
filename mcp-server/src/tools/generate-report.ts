/**
 * generate_report MCP Tool
 * Why: Reads all test data from the DB (SSOT), generates the HTML report,
 * converts to PDF, merges attachments, and returns the result.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs/promises";
import path from "path";

const GenerateReportInputSchema = z.object({
  test_id: z.string().uuid().describe("UUID of the test to generate a report for"),
  chart_image_base64: z
    .string()
    .optional()
    .describe("Optional base64-encoded chart image (PNG). If omitted, chart section is left blank."),
  output_path: z
    .string()
    .optional()
    .describe("Optional path to write the PDF. If omitted, PDF is returned as base64."),
});

type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

/**
 * Register the piletest_generate_report tool on the given MCP server.
 */
export function registerGenerateReport(server: McpServer): void {
  server.registerTool(
    "piletest_generate_report",
    {
      title: "Generate PDF Report",
      description: `Generate an IS 2911-compliant PDF report for a pile load test.

Reads ALL data from the database (SSOT): project info, readings, site images,
field readings, and calibration certificates. Generates HTML from template,
converts to PDF with page numbers, and merges any attached PDFs.

Args:
  - test_id (string): UUID of the test
  - chart_image_base64 (string, optional): Chart image to embed
  - output_path (string, optional): Write PDF to this path instead of returning base64

Returns:
  { filename, pdf_base64?, output_path?, page_count }`,
      inputSchema: GenerateReportInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: GenerateReportInput) => {
      try {
        const prisma = (await import("@/lib/prisma")).default;
        const { getTestEngine } = await import("@/engines");
        const { generatePDFWithPageNumbers } = await import("@/lib/pdf/generator");
        const { toSlug, resolveReportPath } = await import("@/lib/report-paths");
        const { generateIvpltReportHtml } = await import("@/lib/pdf/templates/ivplt-template");
        const { generateRvpltReportHtml } = await import("@/lib/pdf/templates/rvplt-template");
        const { generateLateralReportHtml } = await import("@/lib/pdf/templates/lateral-template");
        const { generateUpliftReportHtml } = await import("@/lib/pdf/templates/uplift-template");
        const { mergePdfs } = await import("@/lib/pdf/merge");
        const { getPublicUrl, STORAGE_BUCKETS } = await import("@/lib/storage");

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

        if (test.readings.length === 0) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Error: No readings recorded for this test." }],
          };
        }

        type TestType = Parameters<typeof getTestEngine>[0];
        const engine = getTestEngine(test.testType as TestType);

        const readingInputs = test.readings.map((r) => ({
          sequence: r.sequence,
          phase: r.phase as "LOADING" | "HOLD" | "UNLOADING",
          loadT: r.loadT,
          avgSettlementMm: r.avgSettlementMm,
        }));

        const extendedReadings = test.readings.map((r) => ({
          sequence: r.sequence,
          phase: r.phase as "LOADING" | "HOLD" | "UNLOADING",
          loadT: r.loadT,
          avgSettlementMm: r.avgSettlementMm,
          dialGauge1: r.dg1.toString(),
          dialGauge2: r.dg2.toString(),
          dialGauge3: r.dg3.toString(),
          dialGauge4: r.dg4.toString(),
          timestamp: r.recordedAt?.toISOString(),
          pressureGauge: r.pressureKgCm2.toString(),
          remark: r.remark || undefined,
        }));

        const meta = {
          pileDiameterMm: test.pileDiameterMm,
          pileDepthM: test.pileDepthM,
          designLoadT: test.designLoadT,
          testLoadT: test.testLoadT,
          ramAreaCm2: test.ramAreaCm2,
        };

        const result = engine.calculate(readingInputs, meta);

        const siteImages = test.siteImages.map((img) => ({
          url: getPublicUrl(STORAGE_BUCKETS.SITE_IMAGES, img.storagePath),
          caption: img.caption || undefined,
        }));

        const reportData = {
          projectName: test.project.name,
          client: test.project.client,
          contractor: test.project.contractor,
          pmc: test.project.pmc || undefined,
          location: test.project.location,
          pileId: test.pileId,
          reportNo: test.reportNo || undefined,
          testDate: test.testDate.toISOString(),
          pileDiameterMm: test.pileDiameterMm,
          pileDepthM: test.pileDepthM,
          concreteGrade: test.concreteGrade,
          designLoadT: test.designLoadT,
          testLoadT: test.testLoadT,
          jackName: test.jackName || undefined,
          ramAreaCm2: test.ramAreaCm2,
          gaugeLeastCountMm: test.gaugeLeastCountMm,
          result,
          readings: extendedReadings,
          conclusion: test.conclusion || undefined,
          chartImageBase64: params.chart_image_base64 || undefined,
          siteImages,
          fieldReadings: test.fieldReadings.map((fr) => ({
            id: fr.id,
            filename: fr.fileName,
            url: getPublicUrl(STORAGE_BUCKETS.FIELD_READINGS, fr.storagePath),
          })),
          calibrationCertificates: test.certificates.map((cert) => ({
            id: cert.id,
            filename: cert.fileName,
            url: getPublicUrl(STORAGE_BUCKETS.CERTIFICATES, cert.storagePath),
          })),
        };

        /**
         * Why: Dispatch to the correct HTML template based on test type,
         * so each test type gets its IS 2911-compliant report layout.
         */
        const templateByType: Record<string, (data: typeof reportData) => string> = {
          IVPLT: generateIvpltReportHtml,
          RVPLT: generateRvpltReportHtml,
          LATERAL: generateLateralReportHtml,
          UPLIFT: generateUpliftReportHtml,
        };
        const reportLabelByType: Record<string, string> = {
          IVPLT: 'IVPLT Report',
          RVPLT: 'RVPLT Report',
          LATERAL: 'Lateral Load Test Report',
          UPLIFT: 'Uplift Load Test Report',
        };
        const generateHtml = templateByType[test.testType] || generateIvpltReportHtml;
        const html = generateHtml(reportData);
        const reportLabel = reportLabelByType[test.testType] || 'IVPLT Report';
        let pdfBuffer = await generatePDFWithPageNumbers(html, { reportLabel });

        if (test.fieldReadings.length > 0) {
          pdfBuffer = await mergePdfs(
            pdfBuffer,
            test.fieldReadings.map((fr) => ({ storagePath: fr.storagePath }))
          );
        }

        if (test.certificates.length > 0) {
          pdfBuffer = await mergePdfs(
            pdfBuffer,
            test.certificates.map((c) => ({ storagePath: c.storagePath })),
            "certificates"
          );
        }

        const slug = toSlug(test.pileId, test.testType);
        const resolved = await resolveReportPath(slug);
        await fs.writeFile(resolved.fullPath, pdfBuffer);

        if (params.output_path) {
          await fs.mkdir(path.dirname(params.output_path), { recursive: true });
          await fs.writeFile(params.output_path, pdfBuffer);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                filename: resolved.filename,
                batch_path: resolved.fullPath,
                output_path: params.output_path || undefined,
                version: resolved.version,
                slug,
                size_bytes: pdfBuffer.length,
                pdf_base64: params.output_path ? undefined : pdfBuffer.toString("base64"),
              }),
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
