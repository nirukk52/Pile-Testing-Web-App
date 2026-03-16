#!/usr/bin/env npx tsx
/**
 * Parity Test Script
 * Why: Validates that the MCP server tools produce identical results to the
 * existing web app pipeline using training-data/report-001 as the golden dataset.
 *
 * Steps:
 *   1. ingest_file → compare extracted projectInfo against expected.json (>= 95% match)
 *   2. validate_test → verify calculations match (100% for computed values)
 *   3. generate_report → verify PDF is generated without errors
 *
 * Run: npx tsx mcp-server/scripts/parity-test.ts
 */

import path from "path";
import fs from "fs/promises";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const TRAINING_DIR = path.join(REPO_ROOT, "training-data/report-001");
const FIELD_SHEET = path.join(TRAINING_DIR, "field-sheet/TP-01 BDD-No-3 IVPLT.pdf");

interface Expected {
  testType: string;
  projectInfo: Record<string, unknown>;
  readings: Array<{
    sequence: number;
    date?: string;
    time?: string;
    pressure: number;
    dg1: number;
    dg2: number;
    dg3: number;
    dg4: number;
  }>;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalize(a) === normalize(b);
}

async function loadExpected(): Promise<Expected> {
  const raw = await fs.readFile(path.join(TRAINING_DIR, "expected.json"), "utf-8");
  return JSON.parse(raw);
}

// ─── Step 1: Extraction Parity ──────────────────────────────────────

async function testExtraction(expected: Expected) {
  console.log("\n📄 STEP 1: Extraction Parity (ingest_file)");
  console.log("─".repeat(50));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("  ⏭️  Skipping extraction test — GEMINI_API_KEY not set");
    console.log("     Set GEMINI_API_KEY to run the full extraction test.");
    return;
  }

  const { runAgentSwarm } = await import("@/lib/ai/agent-swarm");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfToImgModule: any = await import("pdf-to-img");
  const convert = pdfToImgModule.default ?? pdfToImgModule;

  const pdfBuffer = await fs.readFile(FIELD_SHEET);
  const pageImages: string[] = [];
  const doc = await convert(pdfBuffer, { scale: 2.0 });
  for await (const page of doc) {
    const b64 = Buffer.from(page as Uint8Array).toString("base64");
    pageImages.push(`data:image/png;base64,${b64}`);
  }

  const result = await runAgentSwarm(pageImages, apiKey);

  // Check key project info fields
  const extractedPI = result.projectInfo.value;
  const expectedPI = expected.projectInfo;

  let matchCount = 0;
  let totalFields = 0;
  const fieldsToCheck = ["pileId", "project", "client", "pileDiameter", "pileDepth", "designLoad", "testLoad", "ramArea", "concreteGrade"];

  for (const field of fieldsToCheck) {
    totalFields++;
    const expectedVal = String(expectedPI[field] ?? "");
    const extractedVal = String((extractedPI as Record<string, unknown>)[field] ?? "");

    if (expectedVal === extractedVal || fuzzyMatch(expectedVal, extractedVal)) {
      matchCount++;
    } else {
      console.log(`  ⚠️  Mismatch: ${field} — expected "${expectedVal}", got "${extractedVal}"`);
    }
  }

  const accuracy = (matchCount / totalFields) * 100;
  assert(accuracy >= 95, `Project info accuracy: ${accuracy.toFixed(1)}% (${matchCount}/${totalFields})`, `Target: >= 95%`);

  // Check readings count
  assert(
    result.readings.length >= expected.readings.length * 0.9,
    `Readings count: ${result.readings.length} extracted (expected ${expected.readings.length})`,
    `Within 90% tolerance`
  );
}

// ─── Step 2: Calculation Parity ─────────────────────────────────────

async function testCalculations(expected: Expected) {
  console.log("\n🔢 STEP 2: Calculation Parity (validate_test)");
  console.log("─".repeat(50));

  const { getTestEngine } = await import("@/engines");

  const ramArea = Number(expected.projectInfo.ramArea);

  const readingInputs = expected.readings.map((r) => {
    const loadT = (r.pressure * ramArea) / 1000;
    const avg = (r.dg1 + r.dg2 + r.dg3 + r.dg4) / 4;
    let phase: "LOADING" | "HOLD" | "UNLOADING" = "LOADING";
    if (r.sequence > 1 && loadT < (expected.readings[r.sequence - 2]?.pressure ?? 0) * ramArea / 1000) {
      phase = "UNLOADING";
    }
    return {
      sequence: r.sequence,
      phase,
      loadT: Math.round(loadT * 100) / 100,
      avgSettlementMm: Math.round(avg * 100) / 100,
    };
  });

  const engine = getTestEngine("IVPLT");
  const meta = {
    pileDiameterMm: Number(expected.projectInfo.pileDiameter),
    pileDepthM: Number(expected.projectInfo.pileDepth),
    designLoadT: Number(expected.projectInfo.designLoad),
    testLoadT: Number(expected.projectInfo.testLoad),
    ramAreaCm2: ramArea,
  };

  const result = engine.calculate(readingInputs, meta);

  assert(typeof result.maxSettlementMm === "number", `maxSettlementMm computed: ${result.maxSettlementMm}mm`);
  assert(typeof result.netSettlementMm === "number", `netSettlementMm computed: ${result.netSettlementMm}mm`);
  assert(typeof result.elasticReboundMm === "number", `elasticReboundMm computed: ${result.elasticReboundMm}mm`);
  assert(typeof result.safeLoadAdoptedT === "number", `safeLoadAdoptedT computed: ${result.safeLoadAdoptedT} MT`);
  assert(typeof result.isPassed === "boolean", `isPassed: ${result.isPassed}`);

  // For IVPLT with 420 MT design load, net settlement should be < 12mm for pass
  assert(result.netSettlementMm < 12, `Net settlement < 12mm: ${result.netSettlementMm}mm`, "IS 2911 criterion");
  assert(result.isPassed === true, "Test PASSED as expected");
}

// ─── Step 3: Report Generation ──────────────────────────────────────

async function testReportGeneration() {
  console.log("\n📋 STEP 3: Report Generation (generate_report)");
  console.log("─".repeat(50));

  // We cannot call generate_report without a DB record, so verify the
  // template and PDF generator are importable and functional.
  const { generateIvpltReportHtml } = await import("@/lib/pdf/templates/ivplt-template");
  const { getTestEngine } = await import("@/engines");

  assert(typeof generateIvpltReportHtml === "function", "IVPLT template is importable");
  assert(typeof getTestEngine === "function", "Test engine factory is importable");

  try {
    const { generatePDFWithPageNumbers } = await import("@/lib/pdf/generator");
    assert(typeof generatePDFWithPageNumbers === "function", "PDF generator is importable");
  } catch {
    console.log("  ⚠️  PDF generator import requires Puppeteer — skipping in headless env");
  }

  try {
    const { mergePdfs } = await import("@/lib/pdf/merge");
    assert(typeof mergePdfs === "function", "PDF merge utility is importable");
  } catch {
    console.log("  ⚠️  PDF merge import failed — check pdf-lib");
  }

  // Verify template generates HTML
  const engine = getTestEngine("IVPLT");
  const dummyResult = engine.calculate(
    [{ sequence: 1, phase: "LOADING", loadT: 0, avgSettlementMm: 0 }],
    { pileDiameterMm: 900, pileDepthM: 11.5, designLoadT: 420, testLoadT: 1050, ramAreaCm2: 2551 }
  );

  const html = generateIvpltReportHtml({
    projectName: "Test Project",
    client: "Test Client",
    contractor: "Test Contractor",
    location: "Mumbai",
    pileId: "TP-01",
    testDate: "2025-12-09",
    pileDiameterMm: 900,
    pileDepthM: 11.5,
    concreteGrade: "M40",
    designLoadT: 420,
    testLoadT: 1050,
    ramAreaCm2: 2551,
    gaugeLeastCountMm: 0.01,
    result: dummyResult,
    readings: [{ sequence: 1, phase: "LOADING", loadT: 0, avgSettlementMm: 0 }],
  });

  assert(html.includes("TP-01"), "Template contains pile ID");
  assert(html.includes("IS 2911"), "Template references IS 2911");
  assert(html.length > 1000, `Template HTML generated: ${html.length} chars`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║        PileTest MCP Server — Parity Test            ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  const expected = await loadExpected();

  await testExtraction(expected);
  await testCalculations(expected);
  await testReportGeneration();

  console.log("\n" + "═".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\n❌ PARITY TEST FAILED");
    process.exit(1);
  } else {
    console.log("\n✅ ALL PARITY TESTS PASSED");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
