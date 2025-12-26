#!/usr/bin/env python3
"""
IS 2911 Reading Validation Script
Why: Validates pile load test readings for compliance with IS 2911 (Part 4) - 2013.

Usage:
    python validate_readings.py readings.json
    
Input JSON format:
{
    "testType": "IVPLT",
    "designLoadT": 147,
    "pileDiameterMm": 600,
    "ramAreaCm2": 2551,
    "readings": [
        {
            "sequence": 1,
            "phase": "LOADING",
            "pressureKgCm2": 15,
            "loadT": 38.26,
            "dg1": 0.37,
            "dg2": 0.35,
            "dg3": 0.38,
            "dg4": 0.36,
            "avgSettlementMm": 0.365,
            "recordedAt": "2025-12-11T09:00:00Z"
        }
    ]
}
"""

import json
import sys
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class Reading:
    """Single test reading."""
    sequence: int
    phase: str
    pressure_kg_cm2: float
    load_t: float
    dg1: float
    dg2: float
    dg3: float
    dg4: float
    avg_settlement_mm: float
    recorded_at: str


@dataclass
class ValidationError:
    """Validation error with severity."""
    sequence: int
    field: str
    message: str
    severity: str  # 'error' or 'warning'


class IS2911Validator:
    """
    Validates pile load test readings per IS 2911 (Part 4) - 2013.
    Why: Ensures data quality before report generation.
    """
    
    # Settlement limit per IS 2911
    SETTLEMENT_LIMIT_MM = 12
    
    # Load multipliers by test type
    LOAD_MULTIPLIERS = {
        'IVPLT': 2.5,
        'RVPLT': 1.5,
        'LATERAL': 2.5,
        'UPLIFT': 2.5,
    }
    
    def __init__(
        self,
        test_type: str,
        design_load_t: float,
        pile_diameter_mm: float,
        ram_area_cm2: float
    ):
        self.test_type = test_type
        self.design_load_t = design_load_t
        self.pile_diameter_mm = pile_diameter_mm
        self.ram_area_cm2 = ram_area_cm2
        self.errors: List[ValidationError] = []
        
    def validate_all(self, readings: List[Reading]) -> List[ValidationError]:
        """Run all validations on readings."""
        self.errors = []
        
        for reading in readings:
            self._validate_load_calculation(reading)
            self._validate_settlement_calculation(reading)
            self._validate_phase_sequence(reading, readings)
            self._validate_positive_values(reading)
            
        self._validate_sequence_order(readings)
        self._validate_time_progression(readings)
        self._validate_settlement_progression(readings)
        self._validate_test_load_reached(readings)
        
        return self.errors
    
    def _validate_load_calculation(self, reading: Reading) -> None:
        """Verify load = (pressure × ram_area) / 1000."""
        expected_load = (reading.pressure_kg_cm2 * self.ram_area_cm2) / 1000
        tolerance = 0.5  # Allow 0.5 MT tolerance
        
        if abs(reading.load_t - expected_load) > tolerance:
            self.errors.append(ValidationError(
                sequence=reading.sequence,
                field='loadT',
                message=f'Load mismatch: recorded {reading.load_t:.2f} MT, '
                        f'expected {expected_load:.2f} MT from formula',
                severity='warning'
            ))
    
    def _validate_settlement_calculation(self, reading: Reading) -> None:
        """Verify average settlement calculation."""
        gauges = [reading.dg1, reading.dg2, reading.dg3, reading.dg4]
        enabled = [g for g in gauges if g is not None and g >= 0]
        
        if len(enabled) == 0:
            self.errors.append(ValidationError(
                sequence=reading.sequence,
                field='avgSettlementMm',
                message='No valid dial gauge readings',
                severity='error'
            ))
            return
            
        expected_avg = sum(enabled) / len(enabled)
        tolerance = 0.05  # 0.05mm tolerance
        
        if abs(reading.avg_settlement_mm - expected_avg) > tolerance:
            self.errors.append(ValidationError(
                sequence=reading.sequence,
                field='avgSettlementMm',
                message=f'Avg settlement mismatch: recorded {reading.avg_settlement_mm:.2f} mm, '
                        f'expected {expected_avg:.2f} mm',
                severity='warning'
            ))
    
    def _validate_phase_sequence(self, reading: Reading, all_readings: List[Reading]) -> None:
        """Validate phase transitions follow LOADING → HOLD → UNLOADING."""
        valid_phases = ['LOADING', 'HOLD', 'UNLOADING']
        
        if reading.phase.upper() not in valid_phases:
            self.errors.append(ValidationError(
                sequence=reading.sequence,
                field='phase',
                message=f'Invalid phase "{reading.phase}". Must be LOADING, HOLD, or UNLOADING',
                severity='error'
            ))
    
    def _validate_positive_values(self, reading: Reading) -> None:
        """Ensure all values are non-negative."""
        if reading.load_t < 0:
            self.errors.append(ValidationError(
                sequence=reading.sequence,
                field='loadT',
                message='Load cannot be negative',
                severity='error'
            ))
            
        if reading.avg_settlement_mm < 0 and self.test_type != 'UPLIFT':
            self.errors.append(ValidationError(
                sequence=reading.sequence,
                field='avgSettlementMm',
                message='Settlement cannot be negative for vertical tests',
                severity='warning'
            ))
    
    def _validate_sequence_order(self, readings: List[Reading]) -> None:
        """Verify sequence numbers are continuous."""
        sequences = [r.sequence for r in readings]
        expected = list(range(1, len(readings) + 1))
        
        if sorted(sequences) != expected:
            self.errors.append(ValidationError(
                sequence=0,
                field='sequence',
                message='Sequence numbers are not continuous starting from 1',
                severity='error'
            ))
    
    def _validate_time_progression(self, readings: List[Reading]) -> None:
        """Warn if time goes backward."""
        sorted_readings = sorted(readings, key=lambda r: r.sequence)
        
        for i in range(1, len(sorted_readings)):
            curr_time = sorted_readings[i].recorded_at
            prev_time = sorted_readings[i-1].recorded_at
            
            if curr_time < prev_time:
                self.errors.append(ValidationError(
                    sequence=sorted_readings[i].sequence,
                    field='recordedAt',
                    message='Time appears earlier than previous reading',
                    severity='warning'
                ))
    
    def _validate_settlement_progression(self, readings: List[Reading]) -> None:
        """Warn if settlement decreases during loading."""
        loading_readings = [r for r in readings if r.phase.upper() == 'LOADING']
        sorted_loading = sorted(loading_readings, key=lambda r: r.sequence)
        
        for i in range(1, len(sorted_loading)):
            if sorted_loading[i].avg_settlement_mm < sorted_loading[i-1].avg_settlement_mm - 0.1:
                self.errors.append(ValidationError(
                    sequence=sorted_loading[i].sequence,
                    field='avgSettlementMm',
                    message='Settlement decreased during loading phase',
                    severity='warning'
                ))
    
    def _validate_test_load_reached(self, readings: List[Reading]) -> None:
        """Verify test load was achieved."""
        multiplier = self.LOAD_MULTIPLIERS.get(self.test_type, 2.5)
        expected_test_load = self.design_load_t * multiplier
        max_load = max(r.load_t for r in readings) if readings else 0
        
        tolerance = expected_test_load * 0.05  # 5% tolerance
        
        if max_load < expected_test_load - tolerance:
            self.errors.append(ValidationError(
                sequence=0,
                field='testLoad',
                message=f'Test load not reached. Expected {expected_test_load:.1f} MT, '
                        f'maximum recorded {max_load:.1f} MT',
                severity='warning'
            ))


def parse_readings(data: dict) -> List[Reading]:
    """Parse readings from JSON data."""
    readings = []
    for r in data.get('readings', []):
        readings.append(Reading(
            sequence=r.get('sequence', 0),
            phase=r.get('phase', 'LOADING'),
            pressure_kg_cm2=r.get('pressureKgCm2', 0),
            load_t=r.get('loadT', 0),
            dg1=r.get('dg1', 0),
            dg2=r.get('dg2', 0),
            dg3=r.get('dg3', 0),
            dg4=r.get('dg4', 0),
            avg_settlement_mm=r.get('avgSettlementMm', 0),
            recorded_at=r.get('recordedAt', '')
        ))
    return readings


def main():
    """Run validation from command line."""
    if len(sys.argv) < 2:
        print("Usage: python validate_readings.py <readings.json>")
        sys.exit(1)
        
    filepath = sys.argv[1]
    
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading file: {e}")
        sys.exit(1)
    
    validator = IS2911Validator(
        test_type=data.get('testType', 'IVPLT'),
        design_load_t=data.get('designLoadT', 0),
        pile_diameter_mm=data.get('pileDiameterMm', 600),
        ram_area_cm2=data.get('ramAreaCm2', 0)
    )
    
    readings = parse_readings(data)
    errors = validator.validate_all(readings)
    
    if not errors:
        print("✅ All validations passed!")
        sys.exit(0)
    
    error_count = sum(1 for e in errors if e.severity == 'error')
    warning_count = sum(1 for e in errors if e.severity == 'warning')
    
    print(f"\nValidation Results: {error_count} errors, {warning_count} warnings\n")
    
    for err in sorted(errors, key=lambda e: (e.sequence, e.severity)):
        icon = "❌" if err.severity == 'error' else "⚠️"
        seq = f"Row {err.sequence}" if err.sequence > 0 else "Overall"
        print(f"{icon} [{seq}] {err.field}: {err.message}")
    
    sys.exit(1 if error_count > 0 else 0)


if __name__ == '__main__':
    main()
