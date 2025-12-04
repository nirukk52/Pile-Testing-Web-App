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
        # PaddleOCR 3.x returns Result objects
        text_boxes = []
        
        for res in result:
            # Access OCR results from the Result object
            ocr_results = res.get("ocr_result", []) if isinstance(res, dict) else []
            
            # Also try accessing via attribute for Result objects
            if not ocr_results and hasattr(res, 'ocr_result'):
                ocr_results = res.ocr_result or []
            
            # Handle the case where res itself might be the result dict
            if not ocr_results and isinstance(res, dict) and "bbox" in res:
                ocr_results = [res]
            
            for item in ocr_results:
                if isinstance(item, dict):
                    bbox = item.get("bbox", [])
                    text = item.get("text", "")
                    score = item.get("score", 0.0)
                    
                    # Calculate center position from bbox
                    if bbox and len(bbox) >= 4:
                        center_x = sum(p[0] for p in bbox) / len(bbox)
                        center_y = sum(p[1] for p in bbox) / len(bbox)
                    else:
                        center_x, center_y = 0, 0
                    
                    text_boxes.append({
                        "text": str(text),
                        "confidence": float(score),
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
        
        # Process each row
        for row in rows:
            reading = self._parse_reading_row(row)
            if reading:
                readings.append(reading)
        
        # Sort readings by time
        readings = self._sort_readings_by_time(readings)
        
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
        Parse a single row of readings.
        Why: Extracts time, pressure, and gauge values from a row of text boxes.
        """
        if len(row) < 5:
            return None
        
        # Try to identify columns based on content patterns
        time_pattern = r"^\d{1,2}[:\.\s]\d{2}$"
        number_pattern = r"^\d+\.?\d*$"
        
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
        
        numeric_values = []
        
        for box in row:
            text = box["text"].strip()
            confidence = box["confidence"]
            
            # Check for time format (e.g., "9:21", "10.05", "9.21")
            if re.match(time_pattern, text.replace(".", ":")):
                time_str = text.replace(".", ":")
                reading["time"] = {"value": time_str, "confidence": confidence}
            # Check for date format
            elif re.match(r"\d{1,2}/\d{1,2}/?\d{0,4}", text):
                reading["date"] = {"value": text, "confidence": confidence}
            # Check for numeric values (pressure or gauge readings)
            elif re.match(number_pattern, text.replace(",", ".")):
                try:
                    value = float(text.replace(",", "."))
                    numeric_values.append({"value": value, "confidence": confidence})
                except ValueError:
                    pass
            # Check for remarks (non-numeric text that's not a header)
            elif len(text) > 2 and not any(kw in text.upper() for kw in ["DATE", "TIME", "PRESSURE", "READING", "GAUGE"]):
                # Could be a remark
                if reading["remark"]["value"] is None:
                    reading["remark"] = {"value": text, "confidence": confidence}
        
        # Assign numeric values to columns
        # Expected order: pressure, gauge1, gauge2, gauge3, gauge4
        # But first value might be load (skip if > 100, as pressures are typically < 100)
        if numeric_values:
            gauge_values = []
            for nv in numeric_values:
                if nv["value"] >= 100 and reading["pressure"]["value"] is None:
                    # This is likely pressure (in kg/cm2) or load
                    reading["pressure"] = nv
                elif nv["value"] < 20:
                    # Likely a gauge reading (mm)
                    gauge_values.append(nv)
                else:
                    # Could be pressure if we haven't found it yet
                    if reading["pressure"]["value"] is None:
                        reading["pressure"] = nv
                    else:
                        gauge_values.append(nv)
            
            # Assign gauge values
            gauge_fields = ["gauge1", "gauge2", "gauge3", "gauge4"]
            for i, gv in enumerate(gauge_values[:4]):
                reading[gauge_fields[i]] = gv
        
        # Only return if we have at least time and some gauge readings
        if reading["time"]["value"] and any(reading[f"gauge{i}"]["value"] for i in range(1, 5)):
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
