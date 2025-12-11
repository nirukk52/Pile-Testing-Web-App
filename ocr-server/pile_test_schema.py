"""
Pydantic Schema for Pile Load Test Data Validation.
Why: Defines the strict schema for LLM extraction output and provides
physics-based validation (Pressure × Ram Area = Load) with warnings instead of errors.
"""

import uuid
from typing import List, Optional, Literal
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, model_validator
import logging

# Set up logging for validation warnings
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


# --- 1. Sub-Models for Deflections ---

class DeflectionData(BaseModel):
    """
    Stores the dial gauge readings for a specific pile.
    Why: Groups related gauge readings and calculates averages.
    """
    dial_1_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 1")
    dial_2_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 2")
    dial_3_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 3")
    dial_4_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 4")
    average_mm: Optional[float] = Field(None, description="The calculated average of all active dials")

    @model_validator(mode='after')
    def calculate_average_if_missing(self):
        """Auto-calculate average if not provided."""
        if self.average_mm is None:
            values = [v for v in [self.dial_1_mm, self.dial_2_mm, self.dial_3_mm, self.dial_4_mm] if v is not None]
            if values:
                self.average_mm = sum(values) / len(values)
        return self


# --- 2. The Core Reading Row ---

class ReadingRow(BaseModel):
    """
    Represents a single row of data from the field sheet.
    Why: Each row is one timestamped measurement during the pile load test.
    """
    row_id: int
    phase: Literal['Loading', 'Holding', 'Unloading']
    date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    time_recorded: str = Field(..., description="Time in HH:MM format (24h)")
    pressure_gauge_reading_kg_cm2: Optional[float] = None
    load_applied_mt: Optional[float] = None
    
    # Test Pile is always present
    test_pile_deflection: Optional[DeflectionData] = None
    
    # Reaction Pile is optional (only for Lateral tests)
    reaction_pile_deflection: Optional[DeflectionData] = None
    
    remarks: Optional[str] = None
    
    # Confidence score added for UI highlighting
    confidence: float = Field(default=0.9, description="Extraction confidence (0.0-1.0)")
    
    # Flag for physics validation issues
    has_physics_warning: bool = Field(default=False, description="True if Load vs Pressure mismatch detected")

    @field_validator('time_recorded')
    @classmethod
    def validate_time_format(cls, v):
        """Basic check to ensure time is formatted roughly correctly."""
        if v and ":" not in str(v):
            # Try to fix common format issues
            v = str(v)
            if len(v) == 4 and v.isdigit():
                return f"{v[:2]}:{v[2:]}"
            logger.warning(f"Time format issue: {v}")
        return v


# --- 3. Technical Specs (Crucial for Math) ---

class TechnicalSpecs(BaseModel):
    """
    Technical specifications of the pile and test setup.
    Why: Contains the critical ram_area needed for physics validation.
    """
    pile_diameter_mm: Optional[float] = None
    pile_depth_m: Optional[float] = None
    jack_ram_area_cm2: Optional[float] = Field(None, description="Critical for load validation. E.g., 706, 2551")
    test_load_mt: Optional[float] = None
    design_load_mt: Optional[float] = None
    grade_of_concrete: Optional[str] = None
    date_of_casting: Optional[str] = None
    date_of_testing: Optional[str] = None


# --- 4. Project Information ---

class ProjectInfo(BaseModel):
    """
    Project identification and metadata.
    Why: Contains all header information needed for report generation.
    """
    project_name: Optional[str] = None
    location: Optional[str] = None
    client: Optional[str] = None
    contractor: Optional[str] = None
    pile_id: Optional[str] = None
    test_type: Optional[Literal['Vertical', 'Lateral', 'Pullout']] = None


# --- 5. The Master Document Class ---

class PileLoadTestReport(BaseModel):
    """
    The Root Object for validated pile load test data.
    Why: Combines all extracted data and performs physics validation.
    """
    project_info: ProjectInfo = Field(default_factory=ProjectInfo)
    technical_specs: TechnicalSpecs = Field(default_factory=TechnicalSpecs)
    readings: List[ReadingRow] = Field(default_factory=list)
    
    # Validation results (populated by model_validator)
    validation_warnings: List[str] = Field(default_factory=list)
    flagged_row_ids: List[int] = Field(default_factory=list)

    @model_validator(mode='after')
    def validate_physics_and_logic(self):
        """
        Performs cross-checks on the extracted data.
        Why: Validates Load = Pressure × Ram Area / 1000, logs warnings instead of raising errors.
        
        Returns self with validation_warnings and flagged_row_ids populated.
        """
        warnings = []
        flagged_rows = []
        
        ram_area = self.technical_specs.jack_ram_area_cm2
        
        if ram_area is None:
            warnings.append("Ram area not found - cannot validate Load vs Pressure relationship")
            logger.warning(warnings[-1])
        
        test_type = self.project_info.test_type or "Unknown"
        logger.info(f"Validating {test_type} test with {len(self.readings)} readings")
        
        if ram_area:
            logger.info(f"Using Ram Area: {ram_area} cm²")

        previous_time = None
        
        for reading in self.readings:
            # A. PHYSICS CHECK: Pressure -> Load
            # Formula: Load (Tonnes) = (Pressure (kg/cm²) * Area (cm²)) / 1000
            if (ram_area and reading.pressure_gauge_reading_kg_cm2 and 
                reading.load_applied_mt and reading.pressure_gauge_reading_kg_cm2 > 0):
                
                calculated_load = (reading.pressure_gauge_reading_kg_cm2 * ram_area) / 1000
                
                # Allow 5% tolerance for rounding differences or minor gauge errors
                error_margin = abs(calculated_load - reading.load_applied_mt)
                tolerance = max(0.05 * reading.load_applied_mt, 0.5)  # At least 0.5 MT tolerance
                
                if error_margin > tolerance and reading.load_applied_mt > 1.0:
                    warning_msg = (
                        f"Row {reading.row_id} MATH MISMATCH: "
                        f"Pressure {reading.pressure_gauge_reading_kg_cm2} × Area {ram_area} / 1000 = {calculated_load:.2f} MT, "
                        f"but extracted Load is {reading.load_applied_mt} MT"
                    )
                    warnings.append(warning_msg)
                    logger.warning(warning_msg)
                    flagged_rows.append(reading.row_id)
                    reading.has_physics_warning = True
                    reading.confidence = 0.5  # Lower confidence for flagged rows
            
            # B. CHRONOLOGY CHECK (basic)
            if reading.time_recorded and previous_time:
                try:
                    curr_parts = reading.time_recorded.split(":")
                    curr_mins = int(curr_parts[0]) * 60 + int(curr_parts[1])
                    
                    prev_parts = previous_time.split(":")
                    prev_mins = int(prev_parts[0]) * 60 + int(prev_parts[1])
                    
                    # Check for backwards time (might indicate day boundary or OCR error)
                    if curr_mins < prev_mins - 60:  # Allow 1 hour backwards for day boundary
                        warning_msg = f"Row {reading.row_id}: Time may be out of order ({previous_time} → {reading.time_recorded})"
                        warnings.append(warning_msg)
                        logger.warning(warning_msg)
                except (ValueError, IndexError):
                    pass  # Skip time validation if parsing fails
            
            previous_time = reading.time_recorded
        
        self.validation_warnings = warnings
        self.flagged_row_ids = flagged_rows
        
        if warnings:
            logger.info(f"Validation complete with {len(warnings)} warnings")
        else:
            logger.info("Validation complete - no issues found")
        
        return self

    def to_api_response(self) -> dict:
        """
        Convert validated report to frontend API response format.
        Why: Frontend expects OCRValue format with {value, confidence} structure.
        """
        def make_ocr_value(value, confidence: float = 0.9):
            """Create OCRValue dict with confidence."""
            if value is None:
                return {"value": None, "confidence": 0.0}
            return {"value": value, "confidence": confidence}
        
        # Map project info
        pi = self.project_info
        ts = self.technical_specs
        
        mapped_project_info = {
            "testNo": make_ocr_value(pi.pile_id),
            "project": make_ocr_value(pi.project_name),
            "location": make_ocr_value(pi.location),
            "contractor": make_ocr_value(pi.contractor),
            "clientName": make_ocr_value(pi.client),
            "pileDiameter": make_ocr_value(
                f"{ts.pile_diameter_mm} mm" if ts.pile_diameter_mm else None
            ),
            "designLoad": make_ocr_value(
                f"{ts.design_load_mt} MT" if ts.design_load_mt else None
            ),
            "testLoad": make_ocr_value(
                f"{ts.test_load_mt} MT" if ts.test_load_mt else None
            ),
            "ramArea": make_ocr_value(
                f"{ts.jack_ram_area_cm2} cm²" if ts.jack_ram_area_cm2 else None
            ),
            "dateOfCasting": make_ocr_value(ts.date_of_casting),
            "pileDepth": make_ocr_value(
                f"{ts.pile_depth_m} m" if ts.pile_depth_m else None
            ),
            "lcDialGauge": make_ocr_value("0.01 mm"),
            "testType": make_ocr_value(pi.test_type),
            "mixedDesign": make_ocr_value(ts.grade_of_concrete),
        }
        
        # Map readings
        mapped_readings = []
        for reading in self.readings:
            deflection = reading.test_pile_deflection or DeflectionData()
            
            mapped_reading = {
                "id": str(uuid.uuid4()),
                "date": make_ocr_value(reading.date),
                "time": make_ocr_value(reading.time_recorded),
                "pressure": make_ocr_value(reading.pressure_gauge_reading_kg_cm2, reading.confidence),
                "gauge1": make_ocr_value(deflection.dial_1_mm, reading.confidence),
                "gauge2": make_ocr_value(deflection.dial_2_mm, reading.confidence),
                "gauge3": make_ocr_value(deflection.dial_3_mm, reading.confidence),
                "gauge4": make_ocr_value(deflection.dial_4_mm, reading.confidence),
                "remark": make_ocr_value(reading.remarks),
                "cycle": reading.phase.lower() if reading.phase else "loading",
            }
            mapped_readings.append(mapped_reading)
        
        return {
            "project_info": mapped_project_info,
            "readings": mapped_readings,
            "page_count": 1,
            "total_readings": len(mapped_readings),
            "_validation_warnings": self.validation_warnings,
            "_flagged_row_ids": self.flagged_row_ids,
        }


# --- Example Usage Script ---

if __name__ == "__main__":
    # Simulated Raw JSON output from an LLM (containing a deliberate error for demonstration)
    raw_llm_output = {
        "project_info": {
            "project_name": "Improvement of Sewage Management System",
            "location": "Panchak 75 MLD STP",
            "test_type": "Lateral",
            "pile_id": "TP-05"
        },
        "technical_specs": {
            "pile_diameter_mm": 600,
            "pile_depth_m": 10.31,
            "jack_ram_area_cm2": 71.2, 
            "test_load_mt": 8.75
        },
        "readings": [
            {
                "row_id": 1,
                "phase": "Loading",
                "time_recorded": "15:00",
                "pressure_gauge_reading_kg_cm2": 20.0,
                "load_applied_mt": 1.42,
                "test_pile_deflection": {"dial_1_mm": 0.07, "average_mm": 0.07},
                "reaction_pile_deflection": {"dial_1_mm": 0.16, "average_mm": 0.16}
            },
            {
                "row_id": 2,
                "phase": "Loading",
                "time_recorded": "15:31",
                "pressure_gauge_reading_kg_cm2": 40.0,
                "load_applied_mt": 30.9,  # Deliberate error - should be ~2.85 MT
                "test_pile_deflection": {"dial_1_mm": 0.35, "average_mm": 0.35}
            }
        ]
    }

    try:
        # Load and Validate
        report = PileLoadTestReport(**raw_llm_output)
        print("\n✅ Data Structure Validated Successfully.")
        print(f"Project: {report.project_info.project_name}")
        print(f"Warnings: {len(report.validation_warnings)}")
        print(f"Flagged Rows: {report.flagged_row_ids}")
        
        # Convert to API response
        api_response = report.to_api_response()
        print(f"\nAPI Response has {len(api_response['readings'])} readings")
        
    except Exception as e:
        print(f"\n❌ Validation Failed: {e}")



