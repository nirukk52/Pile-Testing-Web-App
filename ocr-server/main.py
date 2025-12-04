"""
FastAPI OCR Server for Pile Load Test Field Sheets.
Why: Provides HTTP endpoint for the Next.js frontend to submit images
and receive structured OCR data with confidence scores.
"""

import io
from typing import List
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from ocr_processor import get_ocr

app = FastAPI(
    title="PileTest OCR Server",
    description="Extract readings from handwritten pile load test field sheets",
    version="1.0.0"
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
    test_no: OCRValueResponse
    project: OCRValueResponse
    location: OCRValueResponse
    contractor: OCRValueResponse
    client_name: OCRValueResponse
    pile_diameter: OCRValueResponse
    design_load: OCRValueResponse
    test_load: OCRValueResponse
    ram_area: OCRValueResponse
    date_of_casting: OCRValueResponse
    pile_depth: OCRValueResponse
    lc_dial_gauge: OCRValueResponse
    test_type: OCRValueResponse
    mixed_design: OCRValueResponse


class ExtractResponse(BaseModel):
    """Full OCR extraction response."""
    project_info: dict
    readings: List[dict]
    page_count: int
    total_readings: int


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "PileTest OCR Server"}


@app.get("/health")
async def health():
    """Detailed health check."""
    try:
        ocr = get_ocr()
        return {
            "status": "healthy",
            "ocr_ready": ocr is not None
        }
    except Exception as e:
        return {
            "status": "healthy",
            "ocr_ready": False,
            "ocr_error": str(e)
        }


@app.post("/debug-ocr")
async def debug_ocr(files: List[UploadFile] = File(...)):
    """
    Debug endpoint to see raw PaddleOCR output.
    Why: Helps diagnose OCR parsing issues by showing the raw model output.
    """
    import numpy as np
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    ocr = get_ocr()
    file = files[0]
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        img_array = np.array(image)
        
        # Get raw OCR result
        raw_result = ocr.ocr.predict(img_array)
        
        # Analyze the result structure
        debug_info = {
            "image_size": image.size,
            "image_mode": image.mode,
            "result_type": str(type(raw_result)),
            "result_length": len(raw_result) if raw_result else 0,
            "result_structure": [],
            "all_detected_text": []
        }
        
        if raw_result:
            for i, res in enumerate(raw_result):
                res_info = {
                    "index": i,
                    "type": str(type(res)),
                    "is_dict": isinstance(res, dict),
                }
                
                # PaddleOCR 3.x returns OCRResult with rec_texts, rec_scores, rec_polys
                rec_texts = []
                rec_scores = []
                rec_polys = []
                
                # Try dict access
                if isinstance(res, dict):
                    res_info["dict_keys"] = list(res.keys())
                    rec_texts = res.get("rec_texts", [])
                    rec_scores = res.get("rec_scores", [])
                    rec_polys = res.get("rec_polys", res.get("rec_boxes", []))
                
                # Try attribute access (for Result objects)
                if hasattr(res, 'rec_texts'):
                    rec_texts = res.rec_texts or []
                if hasattr(res, 'rec_scores'):
                    rec_scores = res.rec_scores or []
                if hasattr(res, 'rec_polys'):
                    rec_polys = res.rec_polys or []
                elif hasattr(res, 'rec_boxes'):
                    rec_polys = res.rec_boxes or []
                
                res_info["rec_texts_count"] = len(rec_texts)
                res_info["rec_scores_count"] = len(rec_scores)
                res_info["rec_polys_count"] = len(rec_polys)
                
                # Extract text with positions
                for j in range(len(rec_texts)):
                    text = rec_texts[j] if j < len(rec_texts) else ""
                    score = rec_scores[j] if j < len(rec_scores) else 0
                    poly = rec_polys[j] if j < len(rec_polys) else []
                    
                    # Calculate center position
                    if poly is not None and len(poly) >= 4:
                        try:
                            # Handle different poly formats
                            if hasattr(poly, 'tolist'):
                                poly = poly.tolist()
                            if isinstance(poly[0], (list, tuple)):
                                center_x = sum(p[0] for p in poly) / len(poly)
                                center_y = sum(p[1] for p in poly) / len(poly)
                            else:
                                # Flat format [x1,y1,x2,y2,x3,y3,x4,y4]
                                center_x = (poly[0] + poly[2] + poly[4] + poly[6]) / 4
                                center_y = (poly[1] + poly[3] + poly[5] + poly[7]) / 4
                        except:
                            center_x, center_y = 0, 0
                    else:
                        center_x, center_y = 0, 0
                    
                    if text:
                        debug_info["all_detected_text"].append({
                            "text": str(text),
                            "confidence": round(float(score), 3),
                            "x_position": round(center_x, 1),
                            "y_position": round(center_y, 1)
                        })
                
                # Check if res has __dict__ 
                if hasattr(res, '__dict__'):
                    res_info["attrs"] = list(res.__dict__.keys())[:10]
                
                debug_info["result_structure"].append(res_info)
        
        # Sort detected text by Y position, then X
        debug_info["all_detected_text"].sort(key=lambda x: (x.get("y_position", 0), x.get("x_position", 0)))
        
        return debug_info
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@app.post("/extract", response_model=ExtractResponse)
async def extract_readings(files: List[UploadFile] = File(...)):
    """
    Extract readings from uploaded field sheet images.
    
    Why: Main endpoint that processes multiple pages of handwritten data,
    combines them into a single chronological reading set, and returns
    structured data with per-value confidence scores.
    
    Args:
        files: List of image files (JPG, PNG, WebP) or PDFs
        
    Returns:
        ExtractResponse with project info, readings, and metadata
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    ocr = get_ocr()
    all_readings = []
    project_info = {}
    
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
            
            # Handle PDF files
            if "pdf" in content_type:
                images = pdf_to_images(contents)
            else:
                images = [Image.open(io.BytesIO(contents))]
            
            # Process each page/image
            for img in images:
                # Convert to RGB if necessary
                if img.mode != "RGB":
                    img = img.convert("RGB")
                
                result = ocr.extract_from_image(img)
                
                # Merge project info (first page takes precedence)
                if not project_info and result["project_info"]:
                    project_info = result["project_info"]
                
                # Collect all readings
                all_readings.extend(result["readings"])
                
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error processing file {file.filename}: {str(e)}"
            )
    
    # Sort all readings by time (handles multi-page merge)
    all_readings = sort_readings_by_time(all_readings)
    
    # Deduplicate readings with same time (keep higher confidence)
    all_readings = deduplicate_readings(all_readings)
    
    return ExtractResponse(
        project_info=project_info,
        readings=all_readings,
        page_count=len(files),
        total_readings=len(all_readings)
    )


def pdf_to_images(pdf_bytes: bytes) -> List[Image.Image]:
    """
    Convert PDF bytes to list of PIL Images.
    Why: PaddleOCR works on images, so PDFs need conversion.
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


def sort_readings_by_time(readings: list) -> list:
    """
    Sort readings chronologically, handling day boundaries.
    Why: Multi-page documents may span multiple days, need proper ordering.
    """
    def time_sort_key(reading: dict) -> tuple:
        time_str = reading.get("time", {}).get("value", "0:00")
        date_str = reading.get("date", {}).get("value", "")
        
        # Parse time
        try:
            parts = str(time_str).replace(".", ":").split(":")
            hours = int(parts[0])
            minutes = int(parts[1]) if len(parts) > 1 else 0
        except (ValueError, IndexError):
            hours, minutes = 0, 0
        
        # Simple date parsing (DD/MM/YYYY)
        date_val = 0
        if date_str:
            try:
                parts = date_str.split("/")
                if len(parts) >= 2:
                    date_val = int(parts[0]) * 100 + int(parts[1])
            except ValueError:
                pass
        
        return (date_val, hours, minutes)
    
    return sorted(readings, key=time_sort_key)


def deduplicate_readings(readings: list) -> list:
    """
    Remove duplicate readings, keeping higher confidence values.
    Why: Multi-page scans might have overlapping data at page boundaries.
    """
    seen = {}
    
    for reading in readings:
        time_key = reading.get("time", {}).get("value", "")
        pressure_key = reading.get("pressure", {}).get("value", 0)
        key = f"{time_key}_{pressure_key}"
        
        if key not in seen:
            seen[key] = reading
        else:
            # Keep the one with higher average confidence
            existing = seen[key]
            existing_conf = sum(
                existing.get(f, {}).get("confidence", 0) 
                for f in ["gauge1", "gauge2", "gauge3", "gauge4"]
            ) / 4
            new_conf = sum(
                reading.get(f, {}).get("confidence", 0) 
                for f in ["gauge1", "gauge2", "gauge3", "gauge4"]
            ) / 4
            
            if new_conf > existing_conf:
                seen[key] = reading
    
    return list(seen.values())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

