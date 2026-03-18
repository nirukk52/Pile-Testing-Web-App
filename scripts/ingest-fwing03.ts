import { runAgentSwarm } from '../src/lib/ai/agent-swarm';
import { pdf as pdfToImg } from 'pdf-to-img';
import fs from 'fs/promises';

const PDF_PATH = '/Users/priyankalalge/.openclaw/media/inbound/F-Wing_-03---f8cc88d7-ba49-4933-bf29-c2f79eea58e5.pdf';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY/GOOGLE_API_KEY');

  const pdfBuffer = await fs.readFile(PDF_PATH);
  const pageImages: string[] = [];
  const doc = await pdfToImg(pdfBuffer, { scale: 2.0 });
  for await (const page of doc) pageImages.push(Buffer.from(page).toString('base64'));

  const result = await runAgentSwarm(pageImages, apiKey);
  await fs.writeFile('/tmp/fwing03-ingest.json', JSON.stringify(result, null, 2));
  console.log('saved /tmp/fwing03-ingest.json', result.extractedRowCount, 'rows');
}

main().catch((e) => { console.error(e); process.exit(1); });
