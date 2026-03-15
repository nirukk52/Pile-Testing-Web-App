# Pipeline Parity Spec (IVPLT)

This document defines the canonical rules for turning field-sheet input into an IVPLT report.

## 1) Date Handling (India-first)
- Parse all sheet dates as `DD/MM/YYYY` (or `DD/MM/YY` -> year 2026 when 2-digit source year is used in this project set).
- Example: `06/01/26` => `2026-01-06`.
- Never interpret day-first dates as month-first.

## 2) Phase Mapping
Given pressure sequence per row:
- Before first drop from max pressure: `LOADING`
- Max-pressure plateau rows: `HOLD`
- After first drop from max pressure: `UNLOADING` (including repeated-pressure stabilization rows)

## 3) Summary Table Rules
### Loading summary
- Use `LOADING` rows only per load stage.
- For max load stage, use **end-of-hold** value as loading terminal point.

### Unloading summary
- Use `UNLOADING` rows only.

## 4) Calculation Convention (current canonical)
- `maxSettlementMm` = max settlement across all rows (includes hold creep peak)
- `finalSettlementMm` = final settlement at full unload
- `elasticReboundMm` = `maxSettlementMm - finalSettlementMm`
- `netSettlementMm` = `finalSettlementMm`

## 5) Required Metadata Gate (before DB write/report generation)
Block generation until these are confirmed:
1. `reportNo`
2. Official test date (display date on report)
3. `pileDepthM`
4. `concreteGrade`

## 6) Verification Gate
Run 3-file verifier (input, generated, expected/reference when provided):
- score < 90 => block final publish
- score >= 90 => allow publish
- target score for parity campaigns: 100
