# IS 2911 (Part 4) - 2013: Load Test Standards

Indian Standard for Design and Construction of Pile Foundations - Load Tests on Piles.

## Table of Contents
1. [Acceptance Criteria](#acceptance-criteria)
2. [Settlement Limits](#settlement-limits)
3. [Safe Load Determination](#safe-load-determination)
4. [Test Procedures](#test-procedures)
5. [Formulas](#formulas)

---

## Acceptance Criteria

### Initial Vertical Pile Load Test (IVPLT)

**Clause 6.3 - Safe Load:**

1. **Settlement Criterion (12mm)**
   - Safe load = (2/3) × load at which total settlement equals 12mm
   - Alternative: 2% of pile diameter if less than 12mm

2. **Ultimate Capacity Criterion (10% diameter)**
   - Safe load = (1/2) × load at which settlement equals 10% of pile diameter
   - This represents the "ultimate" or failure load condition

3. **Governing Safe Load**
   - Adopt the **minimum** of:
     - Design load
     - Safe load from 12mm criterion
     - Safe load from ultimate criterion

### Routine Vertical Pile Load Test (RVPLT)

Same criteria as IVPLT, but:
- Test load = 1.5× design load (instead of 2.5×)
- Used for production piles after initial testing confirms design

### Pass/Fail Determination

```
IF netSettlement ≤ settlementLimit THEN
  status = PASSED
ELSE
  status = FAILED
END

WHERE:
  settlementLimit = min(12mm, 0.02 × pileDiameterMm)
  netSettlement = maxSettlement - elasticRebound
```

---

## Settlement Limits

| Test Type | Settlement Limit | Ultimate Limit |
|-----------|------------------|----------------|
| IVPLT | 12mm (or 2% dia) | 10% of pile diameter |
| RVPLT | 12mm (or 2% dia) | 10% of pile diameter |
| Lateral | Varies by spec | Based on deflection |
| Uplift | Varies by spec | Based on net uplift |

### Examples

| Pile Diameter | 2% Limit | 10% Ultimate |
|---------------|----------|--------------|
| 300mm | 6mm | 30mm |
| 450mm | 9mm | 45mm |
| 600mm | 12mm | 60mm |
| 800mm | 16mm → use 12mm | 80mm |
| 1000mm | 20mm → use 12mm | 100mm |
| 1200mm | 24mm → use 12mm | 120mm |

**Note**: For piles ≥600mm diameter, the 12mm limit governs.

---

## Safe Load Determination

### Algorithm

```python
def determine_safe_load(
    design_load_t: float,
    load_at_12mm: float | None,
    load_at_10pct_dia: float | None
) -> tuple[float, str]:
    """
    Determine safe load per IS 2911 Part 4.
    Returns (safe_load, governing_criterion)
    """
    
    safe_from_12mm = (2/3) * load_at_12mm if load_at_12mm else None
    safe_from_ultimate = 0.5 * load_at_10pct_dia if load_at_10pct_dia else None
    
    candidates = [
        (design_load_t, "DESIGN_LOAD"),
        (safe_from_12mm, "SETTLEMENT_12MM"),
        (safe_from_ultimate, "ULTIMATE_10PCT_DIA")
    ]
    
    valid = [(val, crit) for val, crit in candidates if val is not None]
    
    return min(valid, key=lambda x: x[0])
```

### Interpolation for Load at Settlement

When the exact settlement value wasn't recorded:

```python
def interpolate_load_at_settlement(
    readings: list,
    target_settlement: float,
    phase: str = "LOADING"
) -> float | None:
    """
    Linear interpolation to find load at specific settlement.
    Only considers readings in specified phase.
    """
    phase_readings = [r for r in readings if r.phase == phase]
    sorted_readings = sorted(phase_readings, key=lambda r: r.avgSettlementMm)
    
    for i in range(len(sorted_readings) - 1):
        curr = sorted_readings[i]
        next_ = sorted_readings[i + 1]
        
        if curr.avgSettlementMm <= target_settlement <= next_.avgSettlementMm:
            # Linear interpolation
            ratio = (target_settlement - curr.avgSettlementMm) / \
                    (next_.avgSettlementMm - curr.avgSettlementMm)
            return curr.loadT + ratio * (next_.loadT - curr.loadT)
    
    return None  # Settlement not reached
```

---

## Test Procedures

### Loading Sequence (IVPLT)

1. **Increments**: 20% of design load
2. **Hold Duration**: Until settlement rate < 0.1mm/hour, minimum 1 hour
3. **Maximum Load**: Maintain for 24 hours
4. **Unloading**: Same increments as loading

### Load Sequence Table (Example: Design Load 147T)

| Stage | Load (MT) | % of Design | Duration |
|-------|-----------|-------------|----------|
| 1 | 29.4 | 20% | 1 hour |
| 2 | 58.8 | 40% | 1 hour |
| 3 | 88.2 | 60% | 1 hour |
| 4 | 117.6 | 80% | 1 hour |
| 5 | 147.0 | 100% (DL) | 1 hour |
| 6 | 220.5 | 150% | 1 hour |
| 7 | 294.0 | 200% | 1 hour |
| 8 | 367.5 | 250% (TL) | **24 hours** |

Unloading: Reverse order, 10 minutes per stage.

### Equipment Requirements

| Equipment | Specification |
|-----------|---------------|
| Hydraulic Jack | Capacity ≥ 1.5× test load |
| Pressure Gauge | Least count ≤ 5 kg/cm² |
| Dial Gauges | 4 nos., least count 0.01mm |
| Ram Area | Must be calibrated |

---

## Formulas

### Load Calculation

```
Load (MT) = (Pressure × Ram Area) / 1000

Where:
  Pressure in kg/cm²
  Ram Area in cm²
  Result in Metric Tonnes (MT)
```

### Average Settlement

```
Avg Settlement (mm) = Σ(enabled dial gauge readings) / count(enabled gauges)

Standard: 4 dial gauges at 90° intervals
Minimum: 2 gauges (if others are faulty)
```

### Net Settlement

```
Net Settlement = Max Settlement - Elastic Rebound

Where:
  Max Settlement = highest avg settlement during LOADING
  Elastic Rebound = Max Settlement - Final Settlement (after complete unload)
```

### Test Load Calculation

```
IVPLT: Test Load = 2.5 × Design Load
RVPLT: Test Load = 1.5 × Design Load
Lateral: Test Load = 2.5 × Design Load  
Uplift: Test Load = 2.5 × Design Load
```

---

## References

- IS 2911 (Part 4) - 2013: Load Test on Piles
- IS 14593 - 1998: Bored Cast-in-Situ Piles Founded on Rocks
- IS 2911 (Part 1/Sec 2): Bored Cast-in-Situ Concrete Piles
