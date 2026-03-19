---
name: piletest-styling
description: Style-only report beautification for pile test PDFs (moderna-clean/moderna-pro) with strict no-regression boundaries on engineering values, calculations, and compliance text.
---

# PileTest Styling Skill

Use this skill when the user asks to beautify, modernize, add borders, improve typography/colors, or refine report visual presentation.

## Purpose
Improve visual quality of generated reports **without changing engineering truth**.

## Non-Negotiable Boundaries
1. Never alter:
   - extracted readings
   - computed values (max/net/rebound/safe load/pass-fail)
   - IS criteria semantics
2. Never reword compliance sections in ways that change meaning.
3. Any styling change must preserve table data content and order.

## Theme Model
- `moderna-clean` = baseline stable theme (default)
- `moderna-pro` = enhanced visual theme (borders, micro details, vibrant accents)

## Implementation Pattern
1. Keep a shared style core (`theme-core`) reusable across test types.
2. Apply same theme tokens across IVPLT/RVPLT/LATERAL/UPLIFT.
3. Keep report-type adapters separate for content differences.
4. Prefer additive styling classes over structural rewrites.

## Styling Scope (allowed)
- Page frame/border
- Header/footer polish
- Date/report chips (micro-detail)
- Color palette and typography
- Section header treatment
- Table visual polish (padding, borders, zebra, labels)
- Chart visual style (axes/grid/line colors/legend)
- Cover page layout hierarchy

## Styling Scope (disallowed)
- Changing calculations or formulas
- Dropping rows/columns from engineering tables
- Changing acceptance thresholds or criteria statements

## Rollout Protocol
1. Implement style on one test type first (RVPLT or IVPLT).
2. Generate before/after PDFs.
3. Run verifier on 3-file contract (input/generated/reference).
4. If score drops or criticals increase, rollback style changes.
5. Only propagate to other test types after parity stability.

## Required Checks Before Merge
- Visual diff reviewed
- Verifier score non-regressive vs previous baseline
- No new critical failures
- Slug artifact naming preserved

## Artifacts
For style iterations, store under batch slug:
- `<slug>-agent-generated-report-vN.pdf`
- `<slug>-verifier-output-<timestamp>.json`
- `run-metadata.json` (include theme name/version)

## Notes
This skill is presentation-only. Engineering correctness remains owned by `piletest-pro` + generation/parity pipeline.
