/**
 * Verifier Agent (3-file comparator)
 * - Uses Gemini model (default: gemini-2.5-pro; override with VERIFIER_MODEL)
 * - Always compares 3 PDFs: input field sheet, agent output, reference report
 * - Uses fixed verification prompt and returns strict JSON
 */
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { batchDir, verifierFilename } from '../src/lib/report-paths';

const PROMPT = `You are a Pile Test Report Verification Agent.

I will provide 3 PDFs:
1) input_field_sheet.pdf → raw field sheet/observation data (ground truth for readings)
2) agent_generated_report.pdf → report produced by the assistant
3) reference_report.pdf → expected/correct final report

Your job is to verify whether the generated report matches the expected report with at least 90% accuracy, while staying consistent with the field-sheet input.

## Verification Objectives
A) Structural Match
Compare generated vs reference for:
- Cover page fields
- Section order/headings
- Methodology/acceptance text
- Results summary
- Load sequence tables
- Record of pile load test tables
- Observation sheet inclusion
- Conclusion section

B) Data Match (Critical)
Validate all key engineering values using input field sheet as source of truth:
- Pile ID, project, location, client, contractor
- Pile diameter, pile depth, concrete grade
- Design load, test load, ram area, gauge least count
- Loading table values (load vs avg deflection)
- Holding/max settlement values
- Unloading table values
- Max settlement, elastic rebound, net settlement
- Safe load adopted, governing criterion, pass/fail
- Dates, report no

C) Numerical Tolerance Rules
- Exact match preferred
- For settlement/readings: allow ±0.01 mm as minor difference
- For load values: allow ±0.01 MT
- Any wrong phase mapping (loading/unloading mix-up) = major issue
- Any wrong formula/result affecting pass/fail = critical issue

D) Scoring
Produce:
1. overall_score_percent (0–100)
2. section_scores:
   - structure_score
   - metadata_score
   - readings_score
   - calculations_score
   - compliance_score
3. pass_threshold_90 = true/false

Weighting:
- Readings + calculations = 60%
- Metadata + structure + compliance = 40%

E) Output Format (STRICT JSON ONLY)
Return only this JSON schema:
{
  "overall_score_percent": number,
  "pass_threshold_90": boolean,
  "section_scores": {
    "structure_score": number,
    "metadata_score": number,
    "readings_score": number,
    "calculations_score": number,
    "compliance_score": number
  },
  "critical_failures": [{ "field": "string", "generated_value": "string", "expected_value": "string", "reason": "string" }],
  "major_differences": [{ "section": "string", "issue": "string", "impact": "string" }],
  "minor_differences": [{ "section": "string", "issue": "string" }],
  "matched_highlights": ["string"],
  "final_verdict": "MATCHED_90_PLUS | BELOW_90_REVISE",
  "revision_instructions": ["string"]
}

Important:
- Do not hallucinate values.
- If a value is missing in input field sheet but present in reference, mark as “requires external metadata”.
- Prioritize engineering correctness over wording similarity.`;

function toBase64(buf: Buffer) {
  return buf.toString('base64');
}

async function main() {
  const inputPath = process.argv[2];
  const generatedPath = process.argv[3];
  const referencePath = process.argv[4];
  const slug = process.argv[5];

  if (!inputPath || !generatedPath || !referencePath) {
    console.error('Usage: npx tsx scripts/verifier-agent.ts <input.pdf> <generated.pdf> <reference.pdf> [slug]');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY/GOOGLE_API_KEY');
  }

  const modelName = process.env.VERIFIER_MODEL || 'gemini-2.5-pro';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 65536,
    },
  });

  const [inputBuf, generatedBuf, referenceBuf] = await Promise.all([
    fs.readFile(inputPath),
    fs.readFile(generatedPath),
    fs.readFile(referencePath),
  ]);

  const parts = [
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: toBase64(inputBuf),
      },
    },
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: toBase64(generatedBuf),
      },
    },
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: toBase64(referenceBuf),
      },
    },
    { text: PROMPT },
  ];

  const result = await model.generateContent(parts as any);
  const text = result.response.text() || '{}';

  // best-effort parse & pretty-print
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  let outDir: string;
  let outFilename: string;
  if (slug) {
    outDir = batchDir(slug);
    outFilename = verifierFilename(slug);
  } else {
    outDir = '/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    outFilename = `verifier-output-${stamp}.json`;
  }
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, outFilename);
  await fs.writeFile(outPath, JSON.stringify(parsed, null, 2));

  console.log(JSON.stringify({ model: modelName, outputPath: outPath, result: parsed }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
