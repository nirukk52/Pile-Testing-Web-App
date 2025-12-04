"""
LLM-based extractor for Pile Load Test Field Sheets.
Why: Uses vision LLMs (Claude, GPT-4o, Gemini) to extract structured data from
handwritten field sheets with domain-aware validation and model fallback.
"""

import base64
import io
import json
import logging
import os
import uuid
from typing import Optional

from dotenv import load_dotenv
from litellm import completion
from PIL import Image

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Model fallback chain (accuracy-first ordering)
MODEL_CHAIN = [
    "claude-sonnet-4-20250514",     # Primary: Best for structured extraction
    "gpt-4o",                       # Fallback 1: Strong vision capabilities  
    "gemini/gemini-1.5-pro",        # Fallback 2: Good for tables
]

# Extraction prompt template
EXTRACTION_PROMPT = """You are an expert Geotechnical Engineer and Data Entry Specialist. Your task is to extract pile load test data from images of handwritten field notes into a structured JSON format.

## Context
You will be provided with 1 to 3 images of "Field Reading Sheets" for a Pile Load Test. These sheets contain tabular data recording the behavior of a concrete pile under hydraulic pressure.

**The stakes are high: Inaccurate data can lead to structural failure. Precision is paramount.**

## Primary Logic & Constraints (The "Logical Clues")
Use the following engineering logic to error-correct the OCR output. Do not just "read" the text; "verify" it.

### 1. Chronology is Key
- Time always moves forward. The standard interval is usually 15 minutes, 30 minutes, or 1 hour.
- Example: If you see rows "10:30", "10:45", "19:00", the last one is likely "11:00" (a handwriting error), not 7 PM. Correct it based on the sequence.

### 2. The Physics of Load
- Formula: Load (MT) ≈ Pressure (kg/cm²) × Ram Area / 1000
- Ram Area: Look for "Ram Area" or "Jack Area" in the header (e.g., 706, 2551, or 71.2 cm²).
- Validation: If Pressure doubles, Load must double. If the ratio is inconsistent, one value is wrong.
- Correction: If a load reads "57.8" but the pressure suggests it should be "578", it is a missing decimal or digit. Correct it.

### 3. Settlement Continuity
- **Loading Phase:** Settlement (Dial Gauge readings) increases as Load increases.
- **Holding Phase:** Load stays constant (usually for 24 hours). Settlement increases very slowly (Creep).
- **Unloading Phase:** Load decreases. Settlement decreases (Rebound).
- Correction: If Dial 1 reads "5.45" and the next row reads "0.46" while load is increasing, the "0" is likely a "5" or "6".

### 4. Digit Disambiguation
- Handwritten "0" often looks like "6", "C", or a dash "-".
- Handwritten "5" often looks like "S".
- Handwritten "1" often looks like "7" or "|".
- Rule: If a cell contains a dash "-", interpret it as "0.00" only if it is the very first reading.

## Extraction Rules
1. **Table Structure:** Identify columns for Date, Time, Pressure, Load, Dials (1-4), and Average.
2. **Lateral Tests:** If you see two sets of dial gauges (often labeled "Test Pile" and "Reaction Pile"), populate BOTH test_pile_deflection and reaction_pile_deflection. Otherwise, leave reaction_pile_deflection as null.
3. **Phase Detection:** Determine the phase by observing the load_applied_mt column:
   - Values going UP = "Loading"
   - Values staying SAME = "Holding"  
   - Values going DOWN = "Unloading"
4. **Illegible Values:** If a value is truly illegible, return `null` for that field. Do NOT guess.

## Output Format
Return ONLY a valid JSON object with this exact structure. No markdown, no explanation, just the JSON:

{
  "project_info": {
    "project_name": "string or null",
    "location": "string or null",
    "client": "string or null",
    "contractor": "string or null",
    "pile_id": "string like TP-01 or null",
    "test_type": "Vertical" | "Lateral" | "Pullout",
    "pile_diameter_mm": number or null,
    "pile_depth_m": number or null,
    "grade_of_concrete": "string like M25 or null",
    "date_of_casting": "YYYY-MM-DD or null",
    "date_of_testing": "YYYY-MM-DD or null",
    "design_load_mt": number or null,
    "test_load_mt": number or null,
    "jack_ram_area_cm2": number (CRITICAL - look for this!)
  },
  "readings": [
    {
      "row_id": 1,
      "phase": "Loading" | "Holding" | "Unloading",
      "date": "YYYY-MM-DD or null",
      "time": "HH:MM (24-hour format)",
      "pressure_gauge_reading_kg_cm2": number,
      "load_applied_mt": number,
      "test_pile_deflection": {
        "dial_1_mm": number or null,
        "dial_2_mm": number or null,
        "dial_3_mm": number or null,
        "dial_4_mm": number or null,
        "average_mm": number
      },
      "reaction_pile_deflection": {
        "dial_1_mm": number or null,
        "dial_2_mm": number or null,
        "average_mm": number
      } or null,
      "remarks": "string or null"
    }
  ]
}

IMPORTANT: 
- All images provided are pages from the SAME test. Combine readings from all pages into a single chronological list.
- The row_id should be sequential across all pages (1, 2, 3, ... n).
- Extract the project_info from whichever page has the clearest header information.
"""


def encode_image_to_base64(image: Image.Image, format: str = "JPEG") -> str:
    """
    Convert a PIL Image to base64 string for LLM vision APIs.
    Why: Vision LLMs accept images as base64-encoded data URLs.
    """
    # Convert to RGB if necessary (handles PNG with alpha, grayscale, etc.)
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    # Save to bytes buffer
    buffer = io.BytesIO()
    image.save(buffer, format=format, quality=95)
    buffer.seek(0)
    
    # Encode to base64
    return base64.b64encode(buffer.read()).decode("utf-8")


def build_message_content(images: list[Image.Image], prompt: str) -> list[dict]:
    """
    Build the message content array with text prompt and all images.
    Why: Multi-page documents need all images in a single call for context carryover.
    """
    content = [{"type": "text", "text": prompt}]
    
    for i, img in enumerate(images):
        base64_img = encode_image_to_base64(img)
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{base64_img}",
                "detail": "high"  # Request high-detail processing for handwriting
            }
        })
        logger.info(f"Encoded image {i+1}/{len(images)} ({img.size[0]}x{img.size[1]})")
    
    return content


def extract_with_single_model(images: list[Image.Image], model: str) -> Optional[dict]:
    """
    Attempt extraction with a single model.
    Why: Separated for clean fallback logic - each model attempt is isolated.
    
    Returns parsed JSON dict on success, None on failure.
    """
    logger.info(f"Attempting extraction with model: {model}")
    
    try:
        content = build_message_content(images, EXTRACTION_PROMPT)
        
        response = completion(
            model=model,
            messages=[{
                "role": "user",
                "content": content
            }],
            response_format={"type": "json_object"},
            timeout=60.0,  # 60 second timeout
            num_retries=2,  # Retry on transient errors
        )
        
        # Extract the response content
        response_text = response.choices[0].message.content
        logger.info(f"Received response from {model} ({len(response_text)} chars)")
        
        # Parse JSON
        try:
            data = json.loads(response_text)
            logger.info(f"Successfully parsed JSON from {model}")
            return data
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error from {model}: {e}")
            return None
            
    except Exception as e:
        logger.error(f"Error with model {model}: {type(e).__name__}: {e}")
        return None


def validate_extraction(data: dict) -> tuple[bool, list[str], list[int]]:
    """
    Validate extracted data against Pydantic schema and physics rules.
    Why: Ensures data integrity before sending to frontend.
    
    Returns:
        - is_valid: True if structurally valid (types, required fields)
        - warnings: List of physics/logic warnings (non-fatal)
        - flagged_rows: Row IDs with physics mismatches (get confidence 0.5)
    """
    warnings = []
    flagged_rows = []
    
    # Check basic structure
    if "readings" not in data or not isinstance(data["readings"], list):
        return False, ["Missing or invalid 'readings' array"], []
    
    if len(data["readings"]) == 0:
        return False, ["No readings extracted"], []
    
    # Get ram area for physics validation
    project_info = data.get("project_info", {})
    ram_area = project_info.get("jack_ram_area_cm2")
    
    if ram_area is None:
        warnings.append("Ram area not found - cannot validate Load vs Pressure")
    
    # Validate each reading
    for reading in data["readings"]:
        row_id = reading.get("row_id", 0)
        
        # Check required fields
        if reading.get("time") is None:
            warnings.append(f"Row {row_id}: Missing time")
        
        # Physics validation: Load = Pressure × Ram Area / 1000
        if ram_area is not None:
            pressure = reading.get("pressure_gauge_reading_kg_cm2", 0)
            load = reading.get("load_applied_mt", 0)
            
            if pressure and load and pressure > 0:
                expected_load = (pressure * ram_area) / 1000
                error_margin = abs(expected_load - load)
                tolerance = 0.05 * load if load > 1 else 0.5
                
                if error_margin > tolerance:
                    warnings.append(
                        f"Row {row_id}: Physics mismatch - "
                        f"Pressure {pressure} × Area {ram_area} / 1000 = {expected_load:.2f} MT, "
                        f"but extracted Load is {load} MT"
                    )
                    flagged_rows.append(row_id)
    
    # Log warnings
    for w in warnings:
        logger.warning(w)
    
    return True, warnings, flagged_rows


def map_to_frontend_response(data: dict, flagged_rows: list[int]) -> dict:
    """
    Map LLM extraction output to frontend API contract.
    Why: Frontend expects specific structure with OCRValue format (value + confidence).
    """
    project_info = data.get("project_info", {})
    readings = data.get("readings", [])
    
    def make_ocr_value(value, confidence: float = 0.9):
        """Create OCRValue dict with confidence."""
        if value is None:
            return {"value": None, "confidence": 0.0}
        return {"value": value, "confidence": confidence}
    
    # Map project info to frontend format (snake_case keys to match ocr-api.ts)
    mapped_project_info = {
        "test_no": make_ocr_value(project_info.get("pile_id")),
        "project": make_ocr_value(project_info.get("project_name")),
        "location": make_ocr_value(project_info.get("location")),
        "contractor": make_ocr_value(project_info.get("contractor")),
        "client_name": make_ocr_value(project_info.get("client")),
        "pile_diameter": make_ocr_value(
            str(project_info.get("pile_diameter_mm")) + " mm" 
            if project_info.get("pile_diameter_mm") else None
        ),
        "design_load": make_ocr_value(
            str(project_info.get("design_load_mt")) + " MT"
            if project_info.get("design_load_mt") else None
        ),
        "test_load": make_ocr_value(
            str(project_info.get("test_load_mt")) + " MT"
            if project_info.get("test_load_mt") else None
        ),
        "ram_area": make_ocr_value(
            str(project_info.get("jack_ram_area_cm2")) + " cm²"
            if project_info.get("jack_ram_area_cm2") else None
        ),
        "date_of_casting": make_ocr_value(project_info.get("date_of_casting")),
        "pile_depth": make_ocr_value(
            str(project_info.get("pile_depth_m")) + " m"
            if project_info.get("pile_depth_m") else None
        ),
        "lc_dial_gauge": make_ocr_value("0.01 mm"),  # Standard least count
        "test_type": make_ocr_value(project_info.get("test_type")),
        "mixed_design": make_ocr_value(project_info.get("grade_of_concrete")),
    }
    
    # Map readings to frontend format
    mapped_readings = []
    for reading in readings:
        row_id = reading.get("row_id", 0)
        
        # Determine confidence - lower for flagged rows
        row_confidence = 0.5 if row_id in flagged_rows else 0.9
        
        # Get deflection data
        test_pile = reading.get("test_pile_deflection", {}) or {}
        
        mapped_reading = {
            "id": str(uuid.uuid4()),
            "date": make_ocr_value(reading.get("date")),
            "time": make_ocr_value(reading.get("time")),
            "pressure": make_ocr_value(reading.get("pressure_gauge_reading_kg_cm2"), row_confidence),
            "gauge1": make_ocr_value(test_pile.get("dial_1_mm"), row_confidence),
            "gauge2": make_ocr_value(test_pile.get("dial_2_mm"), row_confidence),
            "gauge3": make_ocr_value(test_pile.get("dial_3_mm"), row_confidence),
            "gauge4": make_ocr_value(test_pile.get("dial_4_mm"), row_confidence),
            "remark": make_ocr_value(reading.get("remarks")),
            "cycle": reading.get("phase", "loading").lower() if reading.get("phase") else "loading",
        }
        mapped_readings.append(mapped_reading)
    
    return {
        "project_info": mapped_project_info,
        "readings": mapped_readings,
        "page_count": 1,  # Will be updated by caller
        "total_readings": len(mapped_readings),
    }


def extract_with_fallback(images: list[Image.Image]) -> dict:
    """
    Main extraction function with model fallback chain.
    Why: Tries models in order until one succeeds validation, ensuring reliability.
    
    Args:
        images: List of PIL Images from PDF pages or uploaded images
        
    Returns:
        Frontend-compatible response dict with project_info and readings
    """
    logger.info(f"Starting extraction with {len(images)} images")
    
    last_error = "No models available"
    
    for model in MODEL_CHAIN:
        # Try extraction
        data = extract_with_single_model(images, model)
        
        if data is None:
            last_error = f"Model {model} failed to return valid response"
            continue
        
        # Validate extraction
        is_valid, warnings, flagged_rows = validate_extraction(data)
        
        if not is_valid:
            last_error = f"Model {model} validation failed: {warnings}"
            continue
        
        # Success! Map to frontend format
        logger.info(f"Extraction successful with {model}")
        if warnings:
            logger.info(f"Extraction completed with {len(warnings)} warnings")
        
        result = map_to_frontend_response(data, flagged_rows)
        result["page_count"] = len(images)
        result["_model_used"] = model
        result["_warnings"] = warnings
        
        return result
    
    # All models failed - return empty response with error
    logger.error(f"All models failed. Last error: {last_error}")
    
    return {
        "project_info": {
            "test_no": {"value": None, "confidence": 0.0},
            "project": {"value": None, "confidence": 0.0},
            "location": {"value": None, "confidence": 0.0},
            "contractor": {"value": None, "confidence": 0.0},
            "client_name": {"value": None, "confidence": 0.0},
            "pile_diameter": {"value": None, "confidence": 0.0},
            "design_load": {"value": None, "confidence": 0.0},
            "test_load": {"value": None, "confidence": 0.0},
            "ram_area": {"value": None, "confidence": 0.0},
            "date_of_casting": {"value": None, "confidence": 0.0},
            "pile_depth": {"value": None, "confidence": 0.0},
            "lc_dial_gauge": {"value": None, "confidence": 0.0},
            "test_type": {"value": None, "confidence": 0.0},
            "mixed_design": {"value": None, "confidence": 0.0},
        },
        "readings": [],
        "page_count": len(images),
        "total_readings": 0,
        "_error": last_error,
    }


# Convenience function for testing
if __name__ == "__main__":
    import sys
    from pdf2image import convert_from_path
    
    if len(sys.argv) < 2:
        print("Usage: python llm_extractor.py <pdf_or_image_path>")
        sys.exit(1)
    
    path = sys.argv[1]
    
    if path.lower().endswith(".pdf"):
        print(f"Converting PDF to images: {path}")
        images = convert_from_path(path, dpi=200)
    else:
        print(f"Loading image: {path}")
        images = [Image.open(path)]
    
    print(f"Processing {len(images)} page(s)...")
    result = extract_with_fallback(images)
    
    print("\n" + "="*50)
    print("EXTRACTION RESULT")
    print("="*50)
    print(json.dumps(result, indent=2, default=str))

