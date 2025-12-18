/**
 * API Route: /api/extract
 * Why: Runs Agent Swarm extraction on uploaded field sheet PDFs.
 * Returns extracted project info and readings with confidence scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Force Node.js runtime for this route.
 * Why: PDF processing requires Node.js APIs.
 */
export const runtime = 'nodejs';

/**
 * Runs the extraction script as a child process.
 * Why: pdf-to-img has webpack compatibility issues in Next.js App Router.
 * Running via tsx in a separate process avoids these issues.
 */
async function runExtractionScript(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'src/lib/extract-pdf.ts');
    
    const child = spawn('npx', ['tsx', scriptPath, pdfPath], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress to server console
      console.log(data.toString());
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }
    
    // Check API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }
    
    // Save PDF to temp file
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    
    tempFilePath = path.join(os.tmpdir(), `extract-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);
    
    console.log('📄 Starting extraction...');
    
    // Run extraction script
    const resultJson = await runExtractionScript(tempFilePath);
    
    // Parse and return result
    const result = JSON.parse(resultJson);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    );
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
