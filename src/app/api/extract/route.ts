/**
 * API Route: /api/extract
 * Why: Runs Agent Swarm extraction on uploaded field sheet PDFs.
 * Returns extracted project info and readings with confidence scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { runAgentSwarm, type AgentSwarmResult } from '@/lib/ai/agent-swarm';

/**
 * Crops an image to its content by removing whitespace/margins.
 * Why: Removes unnecessary margins so Vision API focuses on actual content.
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
 * Converts PDF pages to base64 PNG images with content cropping.
 * Why: Vision API only accepts images, not PDFs directly.
 * Uses file path because pdf-to-img works better with paths in Next.js.
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

/**
 * Force Node.js runtime for this route.
 * Why: pdf-to-img requires Node.js APIs that aren't available in Edge runtime.
 */
export const runtime = 'nodejs';

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
    
    // Save PDF to temp file (pdf-to-img works better with file paths)
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    
    tempFilePath = path.join(os.tmpdir(), `extract-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);
    
    // Convert PDF to images
    console.log('📄 Converting PDF to images...');
    const pageImages = await convertPdfToImages(tempFilePath);
    console.log(`📄 Converted ${pageImages.length} pages`);
    
    // Run agent swarm extraction
    const result: AgentSwarmResult = await runAgentSwarm(pageImages, apiKey);
    
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
