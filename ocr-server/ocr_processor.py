"""
OCR Processor for Pile Load Test Field Sheets.
Why: Extracts structured data (time, pressure, gauge readings) from handwritten
field sheets using PaddleOCR, returning values with confidence scores.
"""

import re
from dataclasses import dataclass
from typing import Optional
from paddleocr import PaddleOCR
from PIL import Image
import numpy as np


@dataclass
class OCRValue:
    """
    A single extracted value with its confidence score.
    Why: Allows UI to highlight low-confidence values for manual verification.
    """
    value: any
    confidence: float


@dataclass 
class ExtractedReading:
    """
    A single row of readings from the field sheet.
    Why: Represents one time-stamped measurement with all gauge values.
    """
    date: OCRValue
    time: OCRValue
    pressure: OCRValue
    gauge1: OCRValue
    gauge2: OCRValue
    gauge3: OCRValue
    gauge4: OCRValue
    remark: OCRValue


@dataclass
class ProjectInfo:
    """
    Header metadata extracted from the field sheet.
    Why: Contains project identification and pile specifications needed for reports.
    """
    test_no: OCRValue
    project: OCRValue
    location: OCRValue
    contractor: OCRValue
    client_name: OCRValue
    pile_diameter: OCRValue
    design_load: OCRValue
    test_load: OCRValue
    ram_area: OCRValue
    date_of_casting: OCRValue
    pile_depth: OCRValue
    lc_dial_gauge: OCRValue
    test_type: OCRValue
    mixed_design: OCRValue


class PileSheetOCR:
    """
    PaddleOCR wrapper specialized for pile load test field sheets.
    Why: Handles the specific table structure and field naming conventions
    used in ZedGeo/standard pile test data sheets.
    """
    
    def __init__(self):
        # Initialize PaddleOCR 3.x with minimal preprocessing
        # Disable extra preprocessing for faster inference on field sheets
        self.ocr = PaddleOCR(
            ocr_version="PP-OCRv5",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            lang='en'
        )
    
    def extract_from_image(self, image: Image.Image) -> dict:
        """
        Extract all data from a single field sheet image.
        Returns structured data with confidence scores.
        """
        # Convert PIL Image to numpy array for PaddleOCR
        img_array = np.array(image)
        
        # Run OCR using PaddleOCR 3.x predict() method
        result = self.ocr.predict(img_array)
        
        if not result or len(result) == 0:
            return {"project_info": {}, "readings": [], "raw_text": []}
        
        # Extract all text boxes with positions and confidence
        # PaddleOCR 3.x returns OCRResult objects with rec_texts, rec_scores, rec_polys
        text_boxes = []
        
        for res in result:
            # Get recognized texts, scores, and polygons
            rec_texts = []
            rec_scores = []
            rec_polys = []
            
            # Try dict access first
            if isinstance(res, dict):
                rec_texts = res.get("rec_texts", [])
                rec_scores = res.get("rec_scores", [])
                rec_polys = res.get("rec_polys", res.get("rec_boxes", []))
            
            # Try attribute access for OCRResult objects
            if hasattr(res, 'rec_texts') and res.rec_texts:
                rec_texts = res.rec_texts
            if hasattr(res, 'rec_scores') and res.rec_scores:
                rec_scores = res.rec_scores
            if hasattr(res, 'rec_polys') and res.rec_polys:
                rec_polys = res.rec_polys
            elif hasattr(res, 'rec_boxes') and res.rec_boxes:
                rec_polys = res.rec_boxes
            
            # Convert to list if numpy array
            if hasattr(rec_texts, 'tolist'):
                rec_texts = rec_texts.tolist()
            if hasattr(rec_scores, 'tolist'):
                rec_scores = rec_scores.tolist()
            
            # Process each detected text
            for j in range(len(rec_texts)):
                text = rec_texts[j] if j < len(rec_texts) else ""
                score = rec_scores[j] if j < len(rec_scores) else 0
                poly = rec_polys[j] if j < len(rec_polys) else []
                
                # Skip empty text
                if not text or not str(text).strip():
                    continue
                
                # Calculate center position from polygon
                center_x, center_y = 0, 0
                bbox = poly
                
                if poly is not None:
                    try:
                        # Convert numpy array to list if needed
                        if hasattr(poly, 'tolist'):
                            poly = poly.tolist()
                        
                        if len(poly) >= 4:
                            if isinstance(poly[0], (list, tuple)):
                                # Format: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                                center_x = sum(p[0] for p in poly) / len(poly)
                                center_y = sum(p[1] for p in poly) / len(poly)
                                bbox = poly
                            else:
                                # Flat format: [x1,y1,x2,y2,x3,y3,x4,y4]
                                center_x = (poly[0] + poly[2] + poly[4] + poly[6]) / 4
                                center_y = (poly[1] + poly[3] + poly[5] + poly[7]) / 4
                                bbox = [[poly[i], poly[i+1]] for i in range(0, 8, 2)]
                    except Exception:
                        pass
                
                text_boxes.append({
                    "text": str(text),
                    "confidence": float(score) if score else 0.0,
                    "x": center_x,
                    "y": center_y,
                    "bbox": bbox
                })
        
        # Sort by Y position (top to bottom), then X (left to right)
        text_boxes.sort(key=lambda b: (b["y"], b["x"]))
        
        # Parse header and table data
        project_info = self._extract_project_info(text_boxes)
        readings = self._extract_readings(text_boxes)
        
        return {
            "project_info": project_info,
            "readings": readings,
            "raw_text": [{"text": b["text"], "confidence": b["confidence"]} for b in text_boxes]
        }
    
    def _extract_project_info(self, text_boxes: list) -> dict:
        """
        Extract header/project information from OCR results.
        Why: Parses the top section of field sheets containing metadata.
        """
        project_info = {}
        
        # Common field patterns to look for
        patterns = {
            "test_no": [r"TEST\s*NO[:\.\-]?\s*(.+)", r"P\.\s*\d+\s*/\s*\d+"],
            "project": [r"PROJECT[:\.\-]?\s*(.+)"],
            "location": [r"LOCATION[:\.\-]?\s*(.+)"],
            "contractor": [r"CONTRACTOR[:\.\-]?\s*(.+)"],
            "client_name": [r"CLIENT[S']?\s*NAME[:\.\-]?\s*(.+)"],
            "pile_diameter": [r"PILE\s*DIAMETER[:\.\-]?\s*(.+)", r"(\d+)\s*mm"],
            "design_load": [r"DESIGN\s*LOAD[:\.\-]?\s*(.+)", r"(\d+)\s*MT"],
            "test_load": [r"TEST\s*LOAD[:\.\-]?\s*(.+)"],
            "ram_area": [r"RAM\s*AREA[:\.\-]?\s*(.+)", r"(\d+)\s*cm"],
            "date_of_casting": [r"DATE\s*OF\s*CASTING[:\.\-]?\s*(.+)"],
            "pile_depth": [r"PILE\s*DEPTH[:\.\-]?\s*(.+)"],
            "lc_dial_gauge": [r"L\.?C\.?\s*OF\s*DIAL\s*GAUGE[:\.\-]?\s*(.+)"],
            "test_type": [r"TYPE\s*OF\s*TEST[:\.\-]?\s*(.+)", r"(RVPLT|IVPLT|PULLOUT|LATERAL)"],
            "mixed_design": [r"MIXED\s*DESIGN[:\.\-]?\s*(.+)", r"(M\s*-?\s*\d+)"],
        }
        
        # Only search in top portion of document (header area)
        header_boxes = [b for b in text_boxes if b["y"] < 300]
        all_header_text = " ".join([b["text"] for b in header_boxes])
        
        for field, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, all_header_text, re.IGNORECASE)
                if match:
                    value = match.group(1) if match.lastindex else match.group(0)
                    # Find the confidence of the matching text box
                    confidence = 0.8  # Default
                    for box in header_boxes:
                        if value.lower() in box["text"].lower():
                            confidence = box["confidence"]
                            break
                    project_info[field] = {"value": value.strip(), "confidence": confidence}
                    break
            
            # Set default if not found
            if field not in project_info:
                project_info[field] = {"value": None, "confidence": 0.0}
        
        return project_info
    
    def _extract_readings(self, text_boxes: list) -> list:
        """
        Extract tabular readings from the field sheet.
        Why: Parses the main data table with time, pressure, and gauge readings.
        """
        readings = []
        
        # Find table area (below header, typically y > 200)
        table_boxes = [b for b in text_boxes if b["y"] > 200]
        
        if not table_boxes:
            return readings
        
        # Group boxes by row (similar Y coordinate, within threshold)
        rows = self._group_into_rows(table_boxes, y_threshold=25)
        
        # Process each row - keep track of Y position for ordering
        for row in rows:
            reading = self._parse_reading_row(row)
            if reading:
                # Store the row's Y position for document-order sorting
                avg_y = sum(box["y"] for box in row) / len(row)
                reading["_row_y"] = avg_y
                readings.append(reading)
        
        # Sort by document position (Y coordinate) instead of time
        # Why: OCR may misread digits (7→2), so time-based sorting is unreliable.
        # Document order preserves the chronological sequence from the field sheet.
        readings.sort(key=lambda r: r.get("_row_y", 0))
        
        # Remove the internal Y position field
        for reading in readings:
            reading.pop("_row_y", None)
        
        return readings
    
    def _group_into_rows(self, boxes: list, y_threshold: float = 25) -> list:
        """
        Group text boxes into rows based on Y position.
        Why: Table cells in the same row have similar Y coordinates.
        """
        if not boxes:
            return []
        
        rows = []
        current_row = [boxes[0]]
        current_y = boxes[0]["y"]
        
        for box in boxes[1:]:
            if abs(box["y"] - current_y) <= y_threshold:
                current_row.append(box)
            else:
                rows.append(sorted(current_row, key=lambda b: b["x"]))
                current_row = [box]
                current_y = box["y"]
        
        if current_row:
            rows.append(sorted(current_row, key=lambda b: b["x"]))
        
        return rows
    
    def _parse_reading_row(self, row: list) -> Optional[dict]:
        """
        Parse a single row of readings using X position for column mapping.
        Why: Extracts time, pressure, and gauge values based on their horizontal position
        in the table, which is more reliable than content-based detection.
        """
        if len(row) < 4:
            return None
        
        reading = {
            "date": {"value": None, "confidence": 0.0},
            "time": {"value": None, "confidence": 0.0},
            "pressure": {"value": None, "confidence": 0.0},
            "gauge1": {"value": None, "confidence": 0.0},
            "gauge2": {"value": None, "confidence": 0.0},
            "gauge3": {"value": None, "confidence": 0.0},
            "gauge4": {"value": None, "confidence": 0.0},
            "remark": {"value": None, "confidence": 1.0},
        }
        
        # Column X position ranges (calibrated from actual field sheets)
        # For ~2000px width images with standard ZedGeo layout:
        column_ranges = {
            "date": (0, 130),          # DATE column (x < 130)
            "time": (130, 220),        # TIME column (x ~ 162)
            "pressure": (220, 350),    # PRESSURE gauge reading kg/cm² (x ~ 266)
            "load": (350, 500),        # LOAD IN MT (x ~ 405) - skip this
            "gauge1": (500, 640),      # Reading 1 - Test Pile (x ~ 535)
            "gauge2": (640, 780),      # Reading 2 - Test Pile (x ~ 681)
            "gauge3": (780, 920),      # Reading 3 - Reaction Pile (x ~ 811)
            "gauge4": (920, 1060),     # Reading 4 - Reaction Pile (x ~ 943)
        }
        
        # Time pattern - handles various formats from OCR
        time_pattern = r"^\d{1,2}[:\.\-!\·]\d{2}$"
        
        for box in row:
            text = box["text"].strip()
            confidence = box["confidence"]
            x = box["x"]
            
            # Clean up common OCR errors in text
            clean_text = text.replace("·", ".").replace("!", ":").replace("-", ".").replace("r", ".")
            clean_text = re.sub(r"[A-Za-z]", "", clean_text)  # Remove stray letters
            clean_text = clean_text.strip()
            
            # Determine column based on X position
            column = None
            for col_name, (x_min, x_max) in column_ranges.items():
                if x_min <= x < x_max:
                    column = col_name
                    break
            
            if column == "date":
                # Check for date format (DD/MM or DDMMYY)
                if re.match(r"^\d{2,6}[/]?\d{0,4}$", text):
                    reading["date"] = {"value": text, "confidence": confidence}
            
            elif column == "time":
                # Parse time - handle various OCR formats
                if re.match(time_pattern, text):
                    # Normalize time format
                    time_str = re.sub(r"[:\.\-!\·]", ":", text)
                    reading["time"] = {"value": time_str, "confidence": confidence}
            
            elif column == "pressure":
                # Pressure gauge reading in kg/cm²
                try:
                    value = float(clean_text)
                    if 0 <= value <= 300:  # Reasonable pressure range
                        reading["pressure"] = {"value": value, "confidence": confidence}
                except (ValueError, TypeError):
                    pass
            
            elif column == "load":
                # Load in MT - skip, we use pressure for calculations
                pass
            
            elif column in ["gauge1", "gauge2", "gauge3", "gauge4"]:
                # Dial gauge readings (typically 0-20mm range)
                try:
                    value = float(clean_text)
                    if 0 <= value <= 50:  # Reasonable gauge reading range
                        reading[column] = {"value": value, "confidence": confidence}
                except (ValueError, TypeError):
                    pass
        
        # Validate: need at least time and some data
        has_time = reading["time"]["value"] is not None
        has_gauges = any(reading[f"gauge{i}"]["value"] is not None for i in range(1, 5))
        has_pressure = reading["pressure"]["value"] is not None
        
        if has_time and (has_gauges or has_pressure):
            return reading
        
        return None
    
    def _sort_readings_by_time(self, readings: list) -> list:
        """
        Sort readings by time, handling multi-page documents.
        Why: Ensures chronological order when combining readings from multiple pages.
        """
        def time_to_minutes(time_str: str) -> int:
            if not time_str:
                return 0
            try:
                parts = time_str.replace(".", ":").split(":")
                hours = int(parts[0])
                minutes = int(parts[1]) if len(parts) > 1 else 0
                return hours * 60 + minutes
            except (ValueError, IndexError):
                return 0
        
        return sorted(readings, key=lambda r: time_to_minutes(r["time"]["value"]))


# Singleton instance for reuse
_ocr_instance = None

def get_ocr() -> PileSheetOCR:
    """Get or create the OCR processor singleton."""
    global _ocr_instance
    if _ocr_instance is None:
        _ocr_instance = PileSheetOCR()
    return _ocr_instance
