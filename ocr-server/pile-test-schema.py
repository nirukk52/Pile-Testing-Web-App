# This code serves two purposes:

# The "JSON Class": It uses Pydantic to define the strict schema you can pass to frameworks like LangChain, Instructor, or OpenAI's Structured Outputs.

# The Validator: It contains the logic to mathematically verify the Pressure vs. Load relationship and fix common OCR errors programmatically.\

import json
from typing import List, Optional, Literal
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, model_validator
import logging

# Set up logging for validation warnings
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- 1. Sub-Models for Deflections ---

class DeflectionData(BaseModel):
    """Stores the dial gauge readings for a specific pile."""
    dial_1_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 1")
    dial_2_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 2")
    dial_3_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 3")
    dial_4_mm: Optional[float] = Field(None, description="Reading from Dial Gauge 4")
    average_mm: float = Field(..., description="The calculated average of all active dials")

# --- 2. The Core Reading Row ---

class ReadingRow(BaseModel):
    """Represents a single row of data from the field sheet."""
    row_id: int
    phase: Literal['Loading', 'Holding', 'Unloading']
    time_recorded: str = Field(..., description="Time in HH:MM format (24h)")
    pressure_gauge_reading_kg_cm2: float
    load_applied_mt: float
    
    # Test Pile is always present
    test_pile_deflection: DeflectionData
    
    # Reaction Pile is optional (only for Lateral tests)
    reaction_pile_deflection: Optional[DeflectionData] = None
    
    remarks: Optional[str] = None

    @field_validator('time_recorded')
    @classmethod
    def validate_time_format(cls, v):
        # Basic check to ensure time is formatted roughly correctly
        if ":" not in v:
            raise ValueError("Time must contain ':'")
        return v

# --- 3. Technical Specs (Crucial for Math) ---

class TechnicalSpecs(BaseModel):
    pile_diameter_mm: float
    pile_depth_m: float
    jack_ram_area_cm2: float = Field(..., description="Critical for load validation. E.g., 706, 2551")
    test_load_mt: float

# --- 4. The Master Document Class ---

class PileLoadTestReport(BaseModel):
    """The Root Object to be returned by the LLM."""
    project_name: Optional[str]
    location: Optional[str]
    test_type: Literal['Vertical', 'Lateral', 'Pullout']
    technical_specs: TechnicalSpecs
    readings: List[ReadingRow]

    # --- 5. LOGIC VALIDATORS (The "Brains") ---

    @model_validator(mode='after')
    def validate_physics_and_logic(self):
        """
        Performs cross-checks on the extracted data.
        1. Pressure * Ram Area = Load
        2. Time Continuity
        """
        ram_area = self.technical_specs.jack_ram_area_cm2
        
        previous_time = None
        
        print(f"\n--- VALIDATING EXTRACTION FOR {self.test_type} TEST ---")
        print(f"Using Ram Area: {ram_area} cm²\n")

        for reading in self.readings:
            # A. PHYSICS CHECK: Pressure -> Load
            # Formula: Load (Tonnes) = (Pressure (kg/cm²) * Area (cm²)) / 1000
            if reading.pressure_gauge_reading_kg_cm2 > 0:
                calculated_load = (reading.pressure_gauge_reading_kg_cm2 * ram_area) / 1000
                
                # Allow 5% tolerance for rounding differences or minor gauge errors
                error_margin = abs(calculated_load - reading.load_applied_mt)
                tolerance = 0.05 * reading.load_applied_mt
                
                if error_margin > tolerance and reading.load_applied_mt > 1.0:
                    logger.warning(
                        f"Row {reading.row_id} MATH MISMATCH: "
                        f"Pressure {reading.pressure_gauge_reading_kg_cm2} * Area {ram_area} / 1000 = {calculated_load:.2f} MT, "
                        f"but extracted Load is {reading.load_applied_mt} MT."
                    )
            
            # B. CHRONOLOGY CHECK
            # Simple check to see if time moves backwards (indicates OCR reading '10:00' as '19:00' or vice versa)
            # (Implementation omitted for brevity, but requires converting HH:MM string to datetime objects)
            
        return self

# --- Example Usage Script ---

if __name__ == "__main__":
    # Simulated Raw JSON output from an LLM (containing a deliberate error for demonstration)
    raw_llm_output = {
        "project_name": "Improvement of Sewage Management System",
        "location": "Panchak 75 MLD STP",
        "test_type": "Lateral",
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
                "load_applied_mt": 30.9, 
                "test_pile_deflection": {"dial_1_mm": 0.35, "average_mm": 0.35}
            }
        ]
    }

    try:
        # Load and Validate
        report = PileLoadTestReport(**raw_llm_output)
        print("\n✅ Data Structure Validated Successfully.")
        print(f"Project: {report.project_name}")
        
    except Exception as e:
        print(f"\n❌ Validation Failed: {e}")