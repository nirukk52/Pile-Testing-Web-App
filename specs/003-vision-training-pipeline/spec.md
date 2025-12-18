# Spec 003: Vision Training Pipeline

> **Goal**: Build a system to extract data from handwritten field sheets using Vision AI, compare against known-good reports, and iteratively improve accuracy to 80%+.

---

## What Are Evals? (Beginner's Guide)

### The Problem
You have an AI (Vision API) that extracts data from handwritten pile test sheets. But how do you know if it's doing a good job? You need a way to **measure accuracy**.

### The Solution: Evals (Evaluations)

**Evals** are automated tests that measure how well your AI performs against known correct answers.

```
┌─────────────────────────────────────────────────────────────────┐
│                        EVAL FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   INPUT                    AI                    OUTPUT         │
│  (field sheet)  ────►  (Vision API)  ────►  (extracted data)   │
│                                                                 │
│                            │                                    │
│                            ▼                                    │
│                                                                 │
│                    ┌───────────────┐                            │
│   GROUND TRUTH     │   COMPARE     │     SCORE                  │
│  (correct answer)  │   (eval)      │  ──► 85% accuracy          │
│   from Supabase    └───────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Term | What It Means | Example |
|------|---------------|---------|
| **Ground Truth** | The correct answer (what the AI should output) | Data you manually entered in Supabase |
| **Extracted** | What the AI actually outputs | Vision API's extraction result |
| **Eval** | A test that compares extracted vs ground truth | "Did AI get pile diameter right?" |
| **Accuracy Score** | Percentage of correct extractions | "85% of fields matched" |
| **Eval Run** | Running all evals once | `npm run eval` |

### Your Role

1. **Provide Training Data**: Upload field sheets + their correct data
2. **Run Evals**: Execute `npm run eval` to see accuracy scores
3. **Review Failures**: Look at what the AI got wrong
4. **Improve Prompts**: Adjust Vision API prompts based on failures
5. **Repeat**: Until accuracy reaches 80%+

### Example Eval Output

```
📊 Eval Results for report-001 (IVPLT TP-01)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project Info:
  ✅ pileId: TP-01 (exact match)
  ✅ pileDiameter: 900mm (exact match)
  ✅ designLoad: 420T (exact match)
  ❌ contractor: "ABC Infra" vs "ABC Infrastructure Pvt Ltd" (partial)
  
Readings (87 total):
  ✅ Count: 87/87 readings found
  ✅ Dial Gauges: 98.2% within ±0.05mm tolerance
  ❌ 2 pressure values misread (rows 45, 67)

Overall Score: 92% ✅ (Target: 80%)
```

---

## Training Data Structure

```
training-data/
  report-001/                          # First training example
    field-sheet/
      TP-01 BDD-No-3 IVPLT.pdf        # Scanned handwritten sheet (INPUT)
    og-report/
      Report IVPLT TP-01-900mm...pdf   # Original verified report (REFERENCE)
    expected.json                      # Ground truth from Supabase (AUTO-GENERATED)
    extracted.json                     # Vision API output (AUTO-GENERATED)
    eval-result.json                   # Accuracy metrics (AUTO-GENERATED)
  
  report-002/                          # Add more as you go
  report-003/
  ...
```

### File Descriptions

| File | Created By | Purpose |
|------|------------|---------|
| `field-sheet/*.pdf` | You (upload) | Input for Vision API extraction |
| `og-report/*.pdf` | You (upload) | Reference for report comparison |
| `expected.json` | Script (from Supabase) | Ground truth - correct answers |
| `extracted.json` | Eval script | What Vision API extracted |
| `eval-result.json` | Eval script | Accuracy scores and failures |

---

## The Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPROVEMENT LOOP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐       │
│    │  Field   │ ───► │  Vision  │ ───► │  Eval    │ ───► │ Improve  │       │
│    │  Sheet   │      │  Extract │      │  Score   │      │ Prompts  │       │
│    └──────────┘      └──────────┘      └──────────┘      └────┬─────┘       │
│         │                                    │                 │             │
│         │                                    │                 │             │
│         │            < 80% accuracy?         │                 │             │
│         │                 YES ───────────────┴─────────────────┘             │
│         │                                                                    │
│         │                 NO (≥ 80%)                                         │
│         │                    │                                               │
│         ▼                    ▼                                               │
│    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐       │
│    │    OG    │ ◄─── │  Compare │ ◄─── │ Generate │ ◄─── │ Move to  │       │
│    │  Report  │      │   PDFs   │      │  Report  │      │ Phase 2  │       │
│    └──────────┘      └──────────┘      └──────────┘      └──────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Eval Metrics

### Phase 1: Extraction Accuracy (Target: 80%)

| Category | Fields | Weight | Pass Criteria |
|----------|--------|--------|---------------|
| **Project Info** | pileId, diameter, depth, designLoad, etc. | 30% | 90% exact match |
| **Reading Count** | Total readings extracted | 20% | Exact match |
| **Dial Gauge Values** | DG1, DG2, DG3, DG4 for all readings | 30% | ±0.05mm tolerance |
| **Pressure/Load** | Pressure gauge, calculated load | 20% | ±1% tolerance |

### Phase 2: Report Comparison

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| **Data Tables Match** | Extract tables from both PDFs, diff | 95% cell match |
| **Calculations Correct** | Verify settlement, load calculations | Exact match |
| **Format Compliance** | IS 2911 required sections present | All present |

---

## Commands

```bash
# Pull ground truth from Supabase for a report
npm run eval:pull report-001

# Run extraction eval (Vision API → compare to expected)
npm run eval:extract report-001

# Run report comparison (generated PDF vs original)
npm run eval:report report-001

# Run all evals for all reports
npm run eval:all

# View eval dashboard
npm run eval:dashboard
```

---

## Milestones

| Phase | Goal | Success Criteria | Your Action |
|-------|------|------------------|-------------|
| **Phase 1** | Extract from 1 field sheet | 80% accuracy on report-001 | Review failures, improve prompts |
| **Phase 2** | Generate matching report | PDF diff < 5% variance | Adjust templates |
| **Phase 3** | Scale to 10 reports | 80% avg across all | Add more training data |
| **Phase 4** | Production ready | < 5% error rate | Deploy |

---

## Technical Architecture

### Files to Create

```
src/lib/eval/
  index.ts              # Main eval runner
  extract-eval.ts       # Vision extraction evaluation
  report-eval.ts        # PDF report comparison
  metrics.ts            # Accuracy calculation helpers
  types.ts              # Eval result types

scripts/
  pull-expected.ts      # Pull expected.json from Supabase
  run-eval.ts           # CLI entry point
```

### Expected.json Schema

```typescript
interface ExpectedData {
  testId: string;           // Supabase test ID
  testType: 'IVPLT' | 'RVPLT' | 'Lateral' | 'Uplift';
  
  projectInfo: {
    pileId: string;
    project: string;
    location: string;
    client: string;
    contractor: string;
    pileDiameter: number;   // mm
    pileDepth: number;      // m
    designLoad: number;     // T
    testLoad: number;       // T
    ramArea: number;        // cm²
    concreteGrade: string;  // M25, M35, etc.
    testDate: string;       // ISO date
    dateOfCasting?: string; // ISO date
  };
  
  readings: Array<{
    sequence: number;
    phase: 'loading' | 'holding' | 'unloading';
    pressure: number;       // kg/cm²
    load: number;           // T
    dg1: number;            // mm
    dg2: number;            // mm
    dg3: number;            // mm
    dg4: number;            // mm
    avgSettlement: number;  // mm
  }>;
}
```

---

## Getting Started

### Step 1: You Already Did This ✅
```
training-data/report-001/
  field-sheet/TP-01 BDD-No-3 IVPLT.pdf
  og-report/Report IVPLT TP-01-900mm (420T)..pdf
```

### Step 2: Pull Ground Truth
```bash
npm run eval:pull report-001 --test-id=<supabase-test-id>
```
This creates `expected.json` from your Supabase data.

### Step 3: Run First Eval
```bash
npm run eval:extract report-001
```
This runs Vision API on the field sheet and compares to expected.

### Step 4: Review Results
```bash
cat training-data/report-001/eval-result.json
```
See what the AI got wrong.

### Step 5: Improve & Repeat
Edit `src/lib/parsers/extraction-config.ts` prompts, run eval again.

---

## FAQ

**Q: How long does an eval take?**
A: ~30 seconds per report (Vision API call + comparison)

**Q: What if I don't have the Supabase test ID?**
A: Look it up in your database, or manually create expected.json

**Q: Can I run evals without internet?**
A: No, Vision API requires internet. But comparison evals work offline.

**Q: How many training reports do I need?**
A: Start with 1, add more as you find edge cases. 10+ for production.
