import { runAgentSwarm } from '../src/lib/ai/agent-swarm';
import { pdf as pdfToImg } from 'pdf-to-img';
import fs from 'fs/promises';

const PDF_PATH = '/Users/priyankalalge/.openclaw/media/inbound/p395_koyambedu---5024c3a2-d685-41b7-bcc3-62c5fc60f73a.pdf';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY/GOOGLE_API_KEY');

  const pdfBuffer = await fs.readFile(PDF_PATH);
  const pageImages: string[] = [];
  const doc = await pdfToImg(pdfBuffer, { scale: 2.0 });
  for await (const page of doc) pageImages.push(Buffer.from(page).toString('base64'));

  const result = await runAgentSwarm(pageImages, apiKey);
  await fs.writeFile('/tmp/p395-ingest.json', JSON.stringify(result, null, 2));
  console.log('saved /tmp/p395-ingest.json', result.extractedRowCount, 'rows');
}

main().catch((e) => { console.error(e); process.exit(1); });
