---
name: piletest-pro
description: Domain knowledge and workflows for pile load testing reports compliant with IS 2911 (Part 4) - 2013. Use when working on test calculations, report generation, PDF templates, pass/fail criteria, or adding new test types (IVPLT, RVPLT, Lateral, Uplift). This skill encodes Indian Standard formulas, acceptance criteria, report structure requirements, and chart specifications for pile foundation testing.
---

# PileTest Pro Domain Knowledge

This skill provides domain expertise for pile load testing and IS 2911-compliant report generation.

## Quick Reference

### Test Types & Load Multipliers

| Test Type | Code | Load Multiplier | Description |
|-----------|------|-----------------|-------------|
| Initial Vertical | `IVPLT` | 2.5× design load | First test on new piles |
| Routine Vertical | `RVPLT` | 1.5× design load | Production/working piles |
| Lateral | `LATERAL` | 2.5× design load | Horizontal resistance |
| Uplift/Pullout | `UPLIFT` | 2.5× design load | Upward resistance |

### Core Formulas

```typescript
// Load from pressure (MT)
load = (pressureKgCm2 × ramAreaCm2) / 1000

// Average settlement (mm)  
avgSettlement = (dg1 + dg2 + dg3 + dg4) / enabledGaugeCount

// Net settlement (mm)
netSettlement = maxSettlement - elasticRebound

// Safe load from 12mm criterion (MT)
safeLoad_12mm = (2/3) × loadAt12mmSettlement

// Safe load from ultimate criterion (MT)  
safeLoad_ultimate = 0.5 × loadAt10PercentDiameter
```

### Pass/Fail Criteria (IS 2911)

**Vertical Tests (IVPLT/RVPLT)** - Clause 7.1.5.1:
- Net settlement ≤ 12mm (or min(18mm, 2% dia) for dia > 600mm)
- IVPLT safe load = **min** of design load, safeLoad_12mm, safeLoad_ultimate
- RVPLT: pass/fail only, no safe load interpolation

**Lateral Test** - Clause 8.4:
- Net deflection = test pile deflection − reaction pile deflection
- Safe load = **min** of load at 5mm deflection, 0.5 × load at 12mm deflection

**Uplift Test** - Clause 9.4:
- Safe load = **min** of (2/3) × load at 12mm uplift, (1/2) × yield load (if detected)
- Yield = displacement jump > 2mm between consecutive readings at similar load

## Workflow

### 1. Calculate Results
See `references/is2911-standards.md` for detailed calculation steps.

### 2. Generate Report
See `references/report-structure.md` for PDF section specifications.

### 3. Validate Readings
For IS 2911 compliance validation, see `scripts/validate_readings.py`.

## Files

- **references/is2911-standards.md** - Complete IS 2911 Part 4 acceptance criteria
- **references/report-structure.md** - PDF report section specifications  
- **references/test-types.md** - Detailed test type configurations
- **scripts/validate_readings.py** - Python validation for readings
- **assets/templates/** - HTML report template patterns

## Key Implementation Points

### Settlement Calculations

1. **Max Settlement**: Highest `avgSettlementMm` during LOADING phase
2. **Elastic Rebound**: Max settlement minus final settlement after full unload
3. **Net Settlement**: Permanent settlement after load removal

### Safe Load Determination

```
governingCriterion = 
  if (settlementLimit was reached) → "SETTLEMENT_12MM"
  if (10% diameter was reached) → "ULTIMATE_10PCT_DIA"  
  else → "DESIGN_LOAD"

safeLoadAdopted = min(
  designLoadT,
  safeLoadFromSettlementT,  // (2/3) × load at 12mm
  safeLoadFromUltimateT     // (1/2) × load at 10% dia
)
```

### Chart Configuration

| Test Type | X-axis | Y-axis | Y Inverted | Annotations |
|-----------|--------|--------|------------|-------------|
| IVPLT/RVPLT | Load (MT) | Settlement (mm) | Yes | 12mm limit, safe load |
| Lateral | Load (MT) | Deflection (mm) | Yes | 5mm limit, 12mm limit |
| Uplift | Load (MT) | Uplift (mm) | No | 12mm limit, yield point |

Curves: Loading (blue), Holding (amber), Unloading (green)
