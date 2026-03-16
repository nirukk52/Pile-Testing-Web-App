/**
 * Run agent swarm extraction on TP-01 field sheet - proper pipeline
 */
import { runAgentSwarm } from '../src/lib/ai/agent-swarm';
import { pdf as pdfToImg } from 'pdf-to-img';
import fs from 'fs/promises';

const PDF_PATH = '/Users/priyankalalge/.openclaw/media/inbound/PDF_image2pdf_20260108080733---350b8143-69b4-4cad-8608-9141637ed094.pdf';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

  const pdfBuffer = await fs.readFile(PDF_PATH);
  const pageImages: string[] = [];
  const doc = await pdfToImg(pdfBuffer, { scale: 2.0 });
  for await (const page of doc) {
    pageImages.push(Buffer.from(page).toString('base64'));
  }
  console.log(`Pages: ${pageImages.length}`);

  const result = await runAgentSwarm(pageImages, apiKey);
  await fs.writeFile('/tmp/tp01-v2-ingest.json', JSON.stringify(result, null, 2));

  // Project info
  console.log('\n=== PROJECT INFO ===');
  const pi = result.projectInfo.value;
  console.log(JSON.stringify(pi, null, 2));
  
  // Confidence
  console.log('\n=== CONFIDENCE ===');
  const lowConf = Object.entries(result.projectInfo.confidence)
    .filter(([_, v]) => v === 'low')
    .map(([k]) => k);
  console.log('Low confidence fields:', lowConf.length > 0 ? lowConf.join(', ') : 'none');

  // Readings summary - stage endpoints only
  console.log('\n=== STAGE ENDPOINTS ===');
  let lastPressure = -1;
  let lastPhase = '';
  const endpoints: any[] = [];
  
  for (let i = 0; i < result.readings.length; i++) {
    const r = result.readings[i];
    const next = result.readings[i + 1];
    const isLast = !next || next.pressure !== r.pressure || next.phase !== r.phase;
    
    if (isLast) {
      const conf = r.confidence === 'low' ? ' ⚠️' : '';
      console.log(`  ${(r.phase || '?').toUpperCase().padEnd(9)} ${String(r.pressure).padStart(3)} kg/cm² → ${r.calculatedAvg.toFixed(2)} mm (DG: ${r.dg1}, ${r.dg2}, ${r.dg3}, ${r.dg4})${conf}`);
      endpoints.push(r);
    }
  }

  console.log(`\nTotal readings: ${result.readings.length}`);
  console.log(`Low confidence: ${result.lowConfidenceCount}`);
  
  // Low confidence details
  if (result.lowConfidenceCount > 0) {
    console.log('\n=== LOW CONFIDENCE DETAILS ===');
    for (const r of result.readings.filter(r => r.confidence === 'low')) {
      console.log(`  Seq ${r.sequence}: P=${r.pressure} DG: ${r.dg1}, ${r.dg2}, ${r.dg3}, ${r.dg4} calcAvg=${r.calculatedAvg} extracted=${r.extractedAvg} diff=${r.avgDiff.toFixed(3)}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
