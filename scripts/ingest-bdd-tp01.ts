import { runAgentSwarm } from '../src/lib/ai/agent-swarm';
import { pdf as pdfToImg } from 'pdf-to-img';
import fs from 'fs/promises';

const PDF_PATH = '/Users/priyankalalge/.openclaw/media/inbound/TP-01_BDD-No-3_IVPLT-input---d66bca06-4b4f-460c-9344-cc0792f74eff.pdf';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY/GOOGLE_API_KEY');

  const pdfBuffer = await fs.readFile(PDF_PATH);
  const pageImages: string[] = [];
  const doc = await pdfToImg(pdfBuffer, { scale: 2.0 });
  for await (const page of doc) pageImages.push(Buffer.from(page).toString('base64'));

  const result = await runAgentSwarm(pageImages, apiKey);
  await fs.writeFile('/tmp/bdd-tp01-ingest.json', JSON.stringify(result, null, 2));
  console.log('saved /tmp/bdd-tp01-ingest.json', result.extractedRowCount, 'rows');
}

main().catch((e) => { console.error(e); process.exit(1); });
