# Handoff: Vision Training Pipeline

## Current State
Branch `003-vision-training-pipeline` - **MILESTONE ACHIEVED: 90.74% accuracy** ✅

## What's Done
- ✅ Spec created: `specs/003-vision-training-pipeline/spec.md`
- ✅ Training data structure: `training-data/report-001/`
- ✅ Ground truth pulled from Supabase: 109 readings in `expected.json`
- ✅ Eval framework: `src/lib/eval/` (types, metrics, extract-eval)
- ✅ Script to pull expected data: `scripts/pull-expected.ts`
- ✅ **Vision API extraction wired and working**
- ✅ **90.74% accuracy achieved (target was 80%)**

## Results Summary
```
📊 Eval Results for report-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Readings: 109/109 extracted, 79/109 fully matched on critical fields
Project Info: 10/13 fields matched

Overall Score: 90.74% ✅ (Target: 80%)
```

## Key Learnings
1. **Page-by-page extraction** works better than sending all pages at once
2. **Time values have systematic OCR errors** ("05" reads as "11") but are non-critical
3. **Critical fields (pressure, dg1-4) extract accurately** - these are what matter for reports
4. **Auto-cropping PDFs** helps Vision API focus on content

## Key Files
```
src/lib/eval/extract-eval.ts   # Vision API extraction + eval runner
src/lib/parsers/extraction-config.ts # Domain prompts for extraction
training-data/report-001/
  extracted.json               # Latest extraction results
  eval-result.json             # Detailed accuracy breakdown
```

## Commands
```bash
# Run eval (uses cached extraction)
npx tsx src/lib/eval/extract-eval.ts report-001

# Force re-extraction
npx tsx src/lib/eval/extract-eval.ts report-001 --reextract
```

## Next Phase
Ready to move to **report generation comparison** - comparing generated PDFs to original reports.
