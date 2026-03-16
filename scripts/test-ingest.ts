/**
 * Test ingest_file extraction on TP-01 PDF
 * Compares agent swarm output vs manual extraction
 */
import { runAgentSwarm } from '../src/lib/ai/agent-swarm';
import fs from 'fs/promises';
import path from 'path';

const PDF_PATH = '/Users/priyankalalge/.openclaw/media/inbound/PDF_image2pdf_20260108080733---5b0d8529-41b8-4724-a67f-924a0a4165c5.pdf';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    process.exit(1);
  }

  // Convert PDF to images (same as ingest_file does)
  const { pdf: pdfToImg } = await import('pdf-to-img');

  const pdfBuffer = await fs.readFile(PDF_PATH);
  const pageImages: string[] = [];

  const doc = await pdfToImg(pdfBuffer, { scale: 2.0 });
  for await (const page of doc) {
    const b64 = Buffer.from(page).toString('base64');
    pageImages.push(b64);
  }

  console.log(`Converted ${pageImages.length} pages to images`);

  // Run agent swarm
  const result = await runAgentSwarm(pageImages, apiKey);

  // Write full result
  const outputPath = '/tmp/tp01-ingest-result.json';
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nFull result written to: ${outputPath}`);

  // Print summary
  console.log('\n=== PROJECT INFO ===');
  console.log(JSON.stringify(result.projectInfo.value, null, 2));

  console.log('\n=== READINGS SUMMARY ===');
  console.log(`Total readings: ${result.extractedRowCount}`);
  console.log(`Low confidence: ${result.lowConfidenceCount}`);

  // Print loading phase final readings (one per load stage)
  console.log('\n=== LOADING STAGE ENDPOINTS ===');
  let lastPressure = -1;
  for (const r of result.readings) {
    if (r.phase === 'loading' || r.phase === 'holding' || r.phase === 'unloading') {
      // Print phase transitions and last reading at each pressure
      const nextIdx = result.readings.indexOf(r) + 1;
      const nextReading = nextIdx < result.readings.length ? result.readings[nextIdx] : null;
      
      if (!nextReading || nextReading.pressure !== r.pressure || nextReading.phase !== r.phase) {
        const conf = r.confidence === 'low' ? ' ⚠️ LOW CONFIDENCE' : '';
        console.log(`  [${r.phase?.toUpperCase().padEnd(9)}] ${String(r.pressure).padStart(3)} kg/cm² | DG: ${r.dg1.toFixed(2)}, ${r.dg2.toFixed(2)}, ${r.dg3.toFixed(2)}, ${r.dg4.toFixed(2)} | Avg: ${r.calculatedAvg.toFixed(2)} (extracted: ${r.extractedAvg?.toFixed(2) ?? 'N/A'}) | Diff: ${r.avgDiff.toFixed(3)}${conf}`);
      }
    }
  }

  // Print all low confidence rows
  const lowConf = result.readings.filter(r => r.confidence === 'low');
  if (lowConf.length > 0) {
    console.log('\n=== LOW CONFIDENCE ROWS ===');
    for (const r of lowConf) {
      const fields = Object.entries(r.fieldConfidence)
        .filter(([_, v]) => v === 'low')
        .map(([k]) => k);
      console.log(`  Seq ${r.sequence}: pressure=${r.pressure}, DG: ${r.dg1}, ${r.dg2}, ${r.dg3}, ${r.dg4} | calcAvg=${r.calculatedAvg} extractedAvg=${r.extractedAvg} | Low fields: ${fields.join(', ') || 'avg mismatch'}`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
