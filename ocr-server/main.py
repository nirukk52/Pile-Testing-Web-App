"""
FastAPI OCR Server for Pile Load Test Field Sheets.
Why: Provides HTTP endpoint for the Next.js frontend to submit images
and receive structured OCR data with confidence scores using LLM vision models.
"""

import io
import logging
from typing import List
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from llm_extractor import extract_with_fallback

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PileTest OCR Server",
    description="Extract readings from handwritten pile load test field sheets using LLM vision",
    version="2.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OCRValueResponse(BaseModel):
    """Single value with confidence score."""
    value: str | float | None
    confidence: float


class ReadingResponse(BaseModel):
    """A single row of extracted readings."""
    date: OCRValueResponse
    time: OCRValueResponse
    pressure: OCRValueResponse
    gauge1: OCRValueResponse
    gauge2: OCRValueResponse
    gauge3: OCRValueResponse
    gauge4: OCRValueResponse
    remark: OCRValueResponse


class ProjectInfoResponse(BaseModel):
    """Extracted project header information."""
    testNo: OCRValueResponse
    project: OCRValueResponse
    location: OCRValueResponse
    contractor: OCRValueResponse
    clientName: OCRValueResponse
    pileDiameter: OCRValueResponse
    designLoad: OCRValueResponse
    testLoad: OCRValueResponse
    ramArea: OCRValueResponse
    dateOfCasting: OCRValueResponse
    pileDepth: OCRValueResponse
    lcDialGauge: OCRValueResponse
    testType: OCRValueResponse
    mixedDesign: OCRValueResponse


class ExtractResponse(BaseModel):
    """Full OCR extraction response."""
    project_info: dict
    readings: List[dict]
    page_count: int
    total_readings: int


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "PileTest OCR Server", "version": "2.0.0", "engine": "LLM Vision"}


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "engine": "LLM Vision (Claude/GPT-4o/Gemini)",
        "ocr_ready": True
    }


@app.post("/extract", response_model=ExtractResponse)
async def extract_readings(files: List[UploadFile] = File(...)):
    """
    Extract readings from uploaded field sheet images using LLM vision.
    
    Why: Main endpoint that processes multiple pages of handwritten data,
    sends them to vision LLMs (Claude → GPT-4o → Gemini fallback chain),
    and returns structured data with per-value confidence scores.
    
    Args:
        files: List of image files (JPG, PNG, WebP) or PDFs
        
    Returns:
        ExtractResponse with project info, readings, and metadata
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    logger.info(f"Received {len(files)} file(s) for extraction")
    
    all_images: List[Image.Image] = []
    
    for i, file in enumerate(files):
        # Validate file type
        content_type = file.content_type or ""
        if not any(t in content_type for t in ["image/", "application/pdf"]):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {content_type}. Only images and PDFs are supported."
            )
        
        try:
            contents = await file.read()
            logger.info(f"Processing file {i+1}: {file.filename} ({len(contents)} bytes)")
            
            # Handle PDF files
            if "pdf" in content_type:
                images = pdf_to_images(contents)
                logger.info(f"Converted PDF to {len(images)} page(s)")
            else:
                images = [Image.open(io.BytesIO(contents))]
            
            # Convert all images to RGB
            for img in images:
                if img.mode != "RGB":
                    img = img.convert("RGB")
                all_images.append(img)
                
        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing file {file.filename}: {str(e)}"
            )
    
    if not all_images:
        raise HTTPException(status_code=400, detail="No valid images found in uploaded files")
    
    logger.info(f"Total images to process: {len(all_images)}")
    
    # Extract using LLM vision with fallback chain
    try:
        result = extract_with_fallback(all_images)
        
        # Log extraction result
        model_used = result.get("_model_used", "unknown")
        warnings = result.get("_warnings", [])
        error = result.get("_error")
        
        if error:
            logger.warning(f"Extraction completed with error: {error}")
        else:
            logger.info(f"Extraction successful with {model_used}")
            if warnings:
                logger.info(f"Extraction had {len(warnings)} validation warnings")
        
        # Remove internal fields before returning
        result.pop("_model_used", None)
        result.pop("_warnings", None)
        result.pop("_error", None)
        
        return ExtractResponse(
            project_info=result["project_info"],
            readings=result["readings"],
            page_count=result["page_count"],
            total_readings=result["total_readings"]
        )
        
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}"
        )


def pdf_to_images(pdf_bytes: bytes) -> List[Image.Image]:
    """
    Convert PDF bytes to list of PIL Images.
    Why: Vision LLMs work on images, so PDFs need conversion.
    """
    try:
        from pdf2image import convert_from_bytes
        return convert_from_bytes(pdf_bytes, dpi=200)
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF support requires pdf2image and poppler. Please install them."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error converting PDF: {str(e)}"
        )


# Legacy endpoint for backwards compatibility
@app.post("/debug-ocr")
async def debug_ocr(files: List[UploadFile] = File(...)):
    """
    Debug endpoint - now returns info about LLM extraction.
    Why: Kept for backwards compatibility but now shows LLM info.
    """
    return {
        "message": "Debug endpoint - use /extract for LLM-based extraction",
        "engine": "LLM Vision (Claude/GPT-4o/Gemini)",
        "model_chain": ["claude-3-5-sonnet-20241022", "gpt-4o", "gemini/gemini-1.5-pro"],
        "files_received": len(files)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
