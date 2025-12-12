# IVPLT (TP-01) Gap Analysis

> Verification of implementation against final checklist requirements.
> 
> **Date**: December 2024  
> **Status**: MVP Complete with gaps identified

---

## Summary

| Category | Implemented | Missing | Status |
|----------|-------------|---------|--------|
| 1️⃣ Test Identity & Metadata | 5/5 | 0 | ✅ Complete |
| 2️⃣ Design & Load Sanity | 5/5 | 0 | ✅ Complete |
| 3️⃣ Raw Readings Integrity | 6/6 | 0 | ✅ Complete |
| 4️⃣ Calculations | 3/4 | 1 | ⚠️ 1 Gap |
| 5️⃣ Acceptance Logic (IS 2911) | 5/5 | 0 | ✅ Complete |
| 6️⃣ Graph Generation | 3/5 | 2 | ⚠️ 2 Gaps |
| 7️⃣ Report Sections | 4/6 | 2 | ⚠️ 2 Gaps |
| 8️⃣ Signatures & Audit | 2/4 | 2 | ⚠️ 2 Gaps |
| 9️⃣ Error & Warning Guards | 0/5 | 5 | ❌ Not Started |
| 🔟 Final Output | 2/3 | 1 | ⚠️ 1 Gap |

**Total: 35/48 items implemented (73%)**

---

## 1️⃣ Test Identity & Metadata — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| Test type detected as IVPLT | ✅ | `testType` field in schema and store |
| Project name, location, pile no. present | ✅ | `project`, `location`, `pileId` fields |
| Pile diameter, pile depth filled | ✅ | `pileDiameter`, `pileDepth` in form |
| Date of casting + test date present | ✅ | `dateOfCasting`, `testDate` fields |
| Consultant / client / agency names | ✅ | `client`, `contractor`, `pmc` fields |

---

## 2️⃣ Design & Load Sanity — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| Design load available | ✅ | `designLoadOnPile` field, required |
| Test load ≈ 2.5 × design load | ✅ | Auto-calculated via `loadMultiplier` |
| Ram area present | ✅ | `ramArea` field, required |
| Dial gauge LC present (0.01 mm) | ✅ | `lcOfDialGauge` with default |
| Pressure → load conversion | ✅ | `calculateLoad()` and API route |

---

## 3️⃣ Raw Readings Integrity — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| Loading phase detected | ✅ | Phase selector in add-reading |
| Holding phase detected | ✅ | 'holding' phase option |
| Unloading phase detected | ✅ | 'unloading' phase option |
| Time per reading | ✅ | `timestamp` field |
| Load / pressure per reading | ✅ | `pressure`, `load` fields |
| ≥2 gauge readings (ideally 4) | ✅ | 4 gauges with enable/disable |
| Average settlement auto-computed | ✅ | `calculateAverageWithEnabled()` |

---

## 4️⃣ Calculations — ⚠️ 1 GAP

| Item | Status | Notes |
|------|--------|-------|
| Max settlement at peak load | ✅ | `findMaxSettlement()` |
| Rebound after full unloading | ✅ | `calculateElasticRebound()` |
| Net settlement = max − rebound | ✅ | `calculateNetSettlement()` |
| Settlement progression monotonic | ❌ **MISSING** | No warning for non-monotonic data |

### Gap Details

**4.1 Monotonic Settlement Validation** — Priority: P2

**Current**: No validation that settlement increases monotonically with load.

**Required**: Warn user if settlement decreases as load increases (indicates data entry error or equipment issue).

**Implementation**:
```typescript
// In calculations.ts
export function validateMonotonicSettlement(readings: ReadingInput[]): {
  isValid: boolean;
  warnings: string[];
} {
  const loadingReadings = readings
    .filter(r => r.phase === 'LOADING')
    .sort((a, b) => a.loadT - b.loadT);
  
  const warnings: string[] = [];
  for (let i = 1; i < loadingReadings.length; i++) {
    if (loadingReadings[i].avgSettlementMm < loadingReadings[i-1].avgSettlementMm) {
      warnings.push(`Settlement decreased between readings ${i} and ${i+1}`);
    }
  }
  return { isValid: warnings.length === 0, warnings };
}
```

---

## 5️⃣ Acceptance Logic (IS 2911) — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| 12 mm criterion evaluated | ✅ | `settlementLimitMm = 12` |
| 10% dia criterion evaluated | ✅ | `ultimateLimitMm = 0.1 × diameter` |
| Governing safe load calculated | ✅ | `determineSafeLoad()` |
| Acceptance decision auto-derived | ✅ | `isPassed` computed |
| Result independent of handwriting | ✅ | Engine calculates, not user input |

---

## 6️⃣ Graph Generation — ⚠️ 2 GAPS

| Item | Status | Notes |
|------|--------|-------|
| Load vs settlement graph generated | ✅ | Chart.js in report-view |
| Axes labelled (Load MT, Settlement mm) | ✅ | Via `graphConfig` |
| Design load marker shown | ❌ **MISSING** | Config exists, not rendered |
| Test load marker shown | ❌ **MISSING** | Config exists, not rendered |
| Curve uses averaged values only | ✅ | Uses `avgSettlementMm` |

### Gap Details

**6.1 Design Load Marker Line** — Priority: P2

**Current**: `graphConfig.annotations.safeLoadLine` exists but not rendered on chart.

**Required**: Horizontal line at design load level with label.

**6.2 Test Load Marker Line** — Priority: P2

**Current**: No test load marker in chart.

**Required**: Vertical marker or annotation at maximum test load.

**Implementation** (for report-view.tsx):
```typescript
// In Chart.js options.plugins
annotation: {
  annotations: {
    designLoadLine: {
      type: 'line',
      xMin: designLoadT,
      xMax: designLoadT,
      borderColor: '#16a34a',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        display: true,
        content: 'Design Load',
        position: 'end'
      }
    },
    settlementLimitLine: {
      type: 'line',
      yMin: 12,
      yMax: 12,
      borderColor: '#dc2626',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        display: true,
        content: '12mm Limit',
        position: 'end'
      }
    }
  }
}
```

---

## 7️⃣ Report Sections — ⚠️ 2 GAPS

| Item | Status | Notes |
|------|--------|-------|
| 1.0 General | ✅ | In `getReportSections()` |
| 2.0 Scope of Work | ✅ | Pile specs table |
| 3.0 Methodology (IVPLT-specific) | ✅ | IS 2911 procedure |
| 4.0 Results & Discussion | ✅ | KPIs and analysis |
| 5.0 Readings & Graph | ⚠️ **PARTIAL** | Table in PDF, no section numbering |
| Conclusion paragraph auto-written | ❌ **MISSING** | AI prompt exists, not called |

### Gap Details

**7.1 Numbered Report Sections** — Priority: P3

**Current**: PDF template has sections but not matching exact numbering.

**Required**: Sections numbered exactly as 1.0, 2.0, 3.0, 4.0, 5.0.

**7.2 AI-Generated Conclusion** — Priority: P2

**Current**: `getAIConclusionPrompt()` exists in engine but never called. User must manually enter conclusion or use default text.

**Required**: Call OpenAI/Claude API to generate conclusion from `getAIConclusionPrompt()` output.

**Implementation**: Phase 5 in tasks.md (currently not done).

---

## 8️⃣ Signatures & Audit — ⚠️ 2 GAPS

| Item | Status | Notes |
|------|--------|-------|
| Signature columns rendered | ⚠️ **PARTIAL** | Placeholders only, no actual signatures |
| Agency / consultant names printed | ✅ | In title page and footer |
| Page numbers correct | ❌ **MISSING** | Footer template exists but broken |
| "Record of Pile Load Test" title | ❌ **MISSING** | Currently "IVPLT Report" |

### Gap Details

**8.1 Signature Capture** — Priority: P3

**Current**: Signature field in add-reading-page but not used in PDF.

**Required**: Either capture digital signatures or render signed name with designation.

**8.2 Page Numbers** — Priority: P2

**Current**: `generatePDFWithPageNumbers()` has footer template but may not render correctly in all browsers.

**Required**: Verify page numbers appear in generated PDF. Test with actual PDF output.

**8.3 Report Title** — Priority: P3

**Current**: PDF title is "Initial Vertical Pile Load Test - Test Report"

**Required**: Should be "Record of Pile Load Test" per IS 2911 format.

---

## 9️⃣ Error & Warning Guards — ❌ NOT STARTED

| Item | Status | Notes |
|------|--------|-------|
| Flag if: Test load < required | ❌ **MISSING** | No validation |
| Flag if: Missing holding data | ❌ **MISSING** | No validation |
| Flag if: Sudden settlement jump | ❌ **MISSING** | No validation |
| Flag if: Gauge missing silently | ❌ **MISSING** | No warning banner |
| Allow override with comment | ❌ **MISSING** | No override mechanism |

### Gap Details — ALL Priority: P2

**9.1 Test Load Validation**

Warn if `testLoadT < designLoadT × 2.5`. Currently no check.

**9.2 Holding Phase Validation**

Warn if no readings with `phase === 'HOLD'`. Per IS 2911, 24-hour hold is required.

**9.3 Settlement Jump Detection**

Warn if settlement increases > 2mm in a single reading increment (possible data entry error).

**9.4 Gauge Status Warning Banner**

Show warning if any gauge is disabled: "Warning: {N} gauges disabled. Settlement average may be less accurate."

**9.5 Override with Comment**

Allow user to acknowledge warning and proceed with a required comment explaining the exception.

**Implementation**:
```typescript
// In types or validation module
interface ValidationWarning {
  code: string;
  message: string;
  severity: 'warning' | 'error';
  acknowledged: boolean;
  acknowledgeComment?: string;
}

// In data-entry or report-view
function validateTestData(
  projectInfo: LegacyProjectInfo,
  readings: LegacyReading[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  
  // Test load check
  const expectedTestLoad = parseFloat(projectInfo.designLoadOnPile) * 2.5;
  const actualTestLoad = parseFloat(projectInfo.testLoad);
  if (actualTestLoad < expectedTestLoad * 0.95) {
    warnings.push({
      code: 'TEST_LOAD_LOW',
      message: `Test load (${actualTestLoad} MT) is below required (${expectedTestLoad} MT)`,
      severity: 'warning',
      acknowledged: false
    });
  }
  
  // Missing holding phase
  const hasHold = readings.some(r => r.phase === 'holding');
  if (!hasHold && readings.length > 5) {
    warnings.push({
      code: 'MISSING_HOLD',
      message: 'No holding phase readings detected. IS 2911 requires 24-hour hold.',
      severity: 'warning',
      acknowledged: false
    });
  }
  
  return warnings;
}
```

---

## 🔟 Final Output — ⚠️ 1 GAP

| Item | Status | Notes |
|------|--------|-------|
| Single clean PDF generated | ✅ | Playwright PDF generator |
| Web view matches PDF data | ❌ **PARTIAL** | Different templates |
| No manual Excel / calculation needed | ✅ | All auto-computed |

### Gap Details

**10.1 Web/PDF Template Parity** — Priority: P3

**Current**: Web view (`report-view.tsx`) and PDF (`ivplt-template.tsx`) use different layouts and show slightly different content.

**Required**: Both should show identical data. Consider generating PDF from same React component using Playwright.

---

## Implementation Priority Matrix

### P1 — Must Have for Production Release

| # | Item | Est. Effort |
|---|------|-------------|
| - | All P1 items complete | ✅ Done |

### P2 — Should Have for Professional Quality

| # | Item | Est. Effort |
|---|------|-------------|
| 4.1 | Monotonic settlement validation | 2 hours |
| 6.1 | Design load marker on chart | 2 hours |
| 6.2 | Test load marker on chart | 1 hour |
| 7.2 | AI-generated conclusion | 4 hours |
| 8.2 | Page number verification | 1 hour |
| 9.1 | Test load validation warning | 1 hour |
| 9.2 | Missing holding data warning | 1 hour |
| 9.3 | Settlement jump detection | 2 hours |
| 9.4 | Gauge status warning banner | 1 hour |
| 9.5 | Override with comment | 3 hours |
| **Total P2** | | **~18 hours** |

### P3 — Nice to Have

| # | Item | Est. Effort |
|---|------|-------------|
| 7.1 | Exact numbered report sections | 1 hour |
| 8.1 | Signature capture in PDF | 4 hours |
| 8.3 | "Record of Pile Load Test" title | 0.5 hours |
| 10.1 | Web/PDF template parity | 8 hours |
| **Total P3** | | **~13.5 hours** |

---

## Recommended Next Steps

1. **Test current implementation** — Generate actual PDF and verify output
2. **Implement P2 warnings** — Most impactful for data quality (9.1-9.5)
3. **Add chart annotations** — Design/test load markers (6.1, 6.2)
4. **AI conclusion** — Complete Phase 5 from tasks.md
5. **Verify page numbers** — Test PDF footer rendering

---

## Files to Modify

| File | Changes Needed |
|------|----------------|
| `src/lib/calculations.ts` | Add monotonic validation (4.1) |
| `src/components/test/report-view.tsx` | Add chart annotations (6.1, 6.2), warnings (9.x) |
| `src/components/test/data-entry.tsx` | Add warning banners (9.4) |
| `src/lib/pdf/templates/ivplt-template.tsx` | Title change (8.3), section numbers (7.1) |
| `src/app/api/tests/[testId]/calculate/route.ts` | Add warnings to response |
| `src/engines/ivplt-engine.ts` | Add `validateTest()` method |


