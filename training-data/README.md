# Training Data

This folder contains training examples for the Vision API extraction pipeline.

## Structure

```
training-data/
  report-001/                     # First training example
    field-sheet/                  # Input files (handwritten/scanned)
      *.pdf                       # Field sheets to extract from
    og-report/                    # Original verified reports
      *.pdf                       # Reports to compare against
    expected.json                 # Ground truth (from Supabase)
    extracted.json                # Vision API output (generated)
    eval-result.json              # Accuracy metrics (generated)
```

## Adding a New Training Example

1. Create folder: `report-XXX/`
2. Add field sheet PDF to `field-sheet/`
3. Add original report PDF to `og-report/`
4. Pull expected data: `npm run eval:pull report-XXX --test-id=YOUR_SUPABASE_ID`
5. Run eval: `npm run eval:extract report-XXX`

## Files

| File | Created By | Git Tracked |
|------|------------|-------------|
| `field-sheet/*.pdf` | You | ✅ Yes |
| `og-report/*.pdf` | You | ✅ Yes |
| `expected.json` | Script/You | ✅ Yes |
| `extracted.json` | Eval script | ❌ No |
| `eval-result.json` | Eval script | ❌ No |




