#!/usr/bin/env npx tsx
/**
 * PDF Extraction Script
 * Why: Runs as a standalone process to avoid webpack issues with pdf-to-img.
 * Called by /api/extract route with a temp PDF path.
 * Outputs JSON result to stdout (only the final JSON, nothing else).
 */

import fs from 'fs';
import path from 'path';

// Load env files manually to avoid dotenv logging
function loadEnvFile(filepath: string) {
  if (!fs.existsSync(filepath)) return;
  const content = fs.readFileSync(filepath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// Load env files silently
loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

import sharp from 'sharp';
import { runAgentSwarm } from './ai/agent-swarm';

// Redirect console.log to stderr so only the final JSON goes to stdout
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  process.stderr.write(args.map(a => String(a)).join(' ') + '\n');
};

// Also capture any direct stdout writes and redirect
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
let capturedOutput = '';
let capturingEnabled = true;

process.stdout.write = ((chunk: string | Uint8Array, encodingOrCallback?: BufferEncoding | ((err?: Error) => void), callback?: (err?: Error) => void): boolean => {
  if (capturingEnabled) {
    // Redirect to stderr during extraction
    process.stderr.write(chunk, encodingOrCallback as BufferEncoding);
    return true;
  }
  return originalStdoutWrite(chunk, encodingOrCallback as BufferEncoding, callback);
}) as typeof process.stdout.write;

/**
 * Crops an image to its content by removing whitespace/margins.
 */
async function cropToContent(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const trimmed = await sharp(imageBuffer)
      .trim({ threshold: 10 })
      .toBuffer();
    return trimmed;
  } catch {
    return imageBuffer;
  }
}

/**
 * Converts PDF pages to base64 PNG images.
 */
async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  const { pdf } = await import('pdf-to-img');
  
  const images: string[] = [];
  const document = await pdf(pdfPath, { scale: 2.0 });
  
  for await (const page of document) {
    const croppedBuffer = await cropToContent(page);
    const base64 = croppedBuffer.toString('base64');
    images.push(base64);
  }
  
  return images;
}

async function main() {
  const pdfPath = process.argv[2];
  
  if (!pdfPath) {
    process.stderr.write('Usage: npx tsx extract-pdf.ts <pdf-path>\n');
    process.exit(1);
  }
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    process.stderr.write('OPENAI_API_KEY not configured\n');
    process.exit(1);
  }
  
  // Convert PDF to images
  process.stderr.write('📄 Converting PDF to images...\n');
  const pageImages = await convertPdfToImages(pdfPath);
  process.stderr.write(`📄 Converted ${pageImages.length} pages\n`);
  
  // Run agent swarm extraction
  const result = await runAgentSwarm(pageImages, apiKey);
  
  // Disable capturing and output ONLY the JSON to real stdout
  capturingEnabled = false;
  originalStdoutWrite(JSON.stringify(result));
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
