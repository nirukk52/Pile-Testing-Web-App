---
name: piletest-parity
description: Enforce deterministic IVPLT report parity from field-sheet input to generated PDF. Use this skill whenever the user asks to match an expected report, improve report accuracy, close verifier gaps, or run generate→verify→patch loops for pile load test reports.
---

# PileTest Parity Skill

Use this skill for parity-focused report generation and debugging.

## Workflow
1. Ingest field sheet (MCP ingestion path)
2. Apply canonical normalization rules:
   - Day-first date parsing (DD/MM/YYYY)
   - Phase mapping by pressure trend
3. Enforce metadata gate before generation:
   - reportNo, official test date, pileDepthM, concreteGrade
4. Generate report through pipeline
5. Run verifier with 3 files (input/generated/reference)
6. If score < 90, patch and regenerate
7. Repeat until score target reached

## Canonical Rules
- Dates: `06/01/26` -> `2026-01-06` (never month-first)
- Phases:
  - pre-max-drop => LOADING
  - max plateau => HOLD
  - post-max-drop => UNLOADING
- Loading summary uses LOADING only, with max load replaced by end-of-hold value
- Unloading summary uses UNLOADING only

## Calculation Convention
- max settlement includes hold creep peak
- net settlement is final full-unload settlement
- elastic rebound = max - net
- final full-unload settlement selection rule:
  - use the LAST reading at MINIMUM unload load (e.g., 0-load 15-min stabilized row), not first min-load row

## Verification Gate
- score < 90 => block publish
- score >= 90 => publish
- parity target = 100

## References
- `docs/pipeline-parity-spec.md`
- `scripts/verifier-agent.ts`
- `scripts/run-verifier-default.sh`
