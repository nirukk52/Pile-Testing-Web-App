# Handoff: Vision Training Pipeline

## Current State
Branch `003-vision-training-pipeline` - eval framework ready, need to wire up Vision API.

## What's Done
- ✅ Spec created: `specs/003-vision-training-pipeline/spec.md`
- ✅ Training data structure: `training-data/report-001/`
- ✅ Ground truth pulled from Supabase: 109 readings in `expected.json`
- ✅ Eval framework: `src/lib/eval/` (types, metrics, extract-eval)
- ✅ Script to pull expected data: `scripts/pull-expected.ts`

## Key Files
```
training-data/report-001/
  field-sheet/TP-01 BDD-No-3 IVPLT.pdf  # Input (handwritten)
  expected.json                          # Ground truth (109 readings)

src/lib/eval/
  types.ts       # ExpectedData, EvalResult
  metrics.ts     # compareDialGauge, compareNumbers
  extract-eval.ts # runExtractEval (TODO: wire Vision API)
```

## Next Task
**Wire Vision API extraction and run first eval**

1. Update `src/lib/eval/extract-eval.ts` to call Vision API on field sheet PDF
2. Run: `npx tsx scripts/run-eval.ts report-001`
3. Get first accuracy score
4. Iterate on prompts in `src/lib/parsers/extraction-config.ts` until 80%

## Important Context
- Only extract RAW fields: `date`, `time`, `pressure`, `dg1-4`
- Load/avgSettlement are CALCULATED, not extracted
- Target: 80% accuracy before moving to report generation phase

## Commands
```bash
# Pull expected data
npx tsx scripts/pull-expected.ts report-001 TP-01

# Run eval (after wiring Vision API)
npx tsx src/lib/eval/extract-eval.ts report-001
```
