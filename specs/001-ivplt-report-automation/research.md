# Research: IVPLT Report Automation

**Branch**: `001-ivplt-report-automation` | **Date**: 2025-12-12

## 1. PDF Generation Strategy

### Decision: Playwright with HTML Templates

**Rationale**: 
- Playwright renders actual Chart.js canvases as images (critical for load-settlement graphs)
- Supports PDF merging via `pdf-lib` for appending calibration certificates
- Existing archived code (`src/_archive/api-pdf/route.ts`) provides working foundation
- Server-side generation enables larger PDFs without browser memory limits

**Alternatives Considered**:
| Option | Pros | Cons | Rejected Because |
|--------|------|------|------------------|
| `window.print()` | Simple, no server needed | Can't capture canvas charts, no PDF merging | Charts would be blank |
| `react-pdf` | Pure React, no browser | Complex layout, no chart support | Can't render Chart.js |
| `puppeteer` | Similar to Playwright | Less maintained, no Safari support | Playwright is superset |
| `pdfmake` | Pure JS PDF creation | No HTML templates, manual layout | Too much work for 15-page reports |

**Implementation Notes**:
- Use Next.js API route for PDF generation
- Render Chart.js to base64 image before PDF generation
- Use `pdf-lib` to merge user-uploaded certificate PDFs at end
- Target A4 paper size with professional margins

---

## 2. Chart Rendering for PDF

### Decision: Chart.js Canvas → Base64 Image

**Rationale**:
- Chart.js can export canvas to base64 PNG via `toDataURL()`
- Image embeds directly in HTML template for Playwright
- Same chart configuration used in preview and PDF (consistency)

**Implementation**:
```typescript
// Generate chart image for PDF
const chartImage = chartRef.current?.toBase64Image('image/png', 1.0);
// Embed in HTML template
<img src="${chartImage}" alt="Load vs Settlement" />
```

**Graph Requirements** (from dev guidelines):
- X-Axis: Settlement (mm) - inverted (0 at top, increasing downwards)
- Y-Axis: Load (MT)
- Loading curve: Solid blue line
- Unloading curve: Dashed green line
- Annotations: Horizontal line at Safe Load, vertical line at 12mm limit

---

## 3. Supabase Storage for Images & Certificates

### Decision: Per-Test Buckets with Signed URLs

**Rationale**:
- Supabase Storage integrates seamlessly with Supabase DB
- RLS policies can restrict access per user/test
- Signed URLs allow temporary access during PDF generation

**Storage Structure**:
```
buckets/
├── site-images/
│   └── {testId}/
│       ├── image-1.jpg
│       ├── image-2.jpg
│       └── ...
└── certificates/
    └── {testId}/
        ├── hydraulic-jack.pdf
        ├── pressure-gauge.pdf
        └── ...
```

**Upload Constraints**:
- Images: JPEG, PNG, WebP only, max 10MB before compression
- Target: Compress to max 2MB per image
- Certificates: PDF only, max 5MB per file

**Future Enhancement** (noted but not in scope):
- Global certificate library where users can upload once and attach to multiple tests
- Certificate type dropdown to select from previously uploaded certs

---

## 4. Test Type Engine Pattern

### Decision: Strategy Pattern with Factory

**Rationale**:
- Isolates test-type-specific logic (calculations, criteria, wording)
- UI components remain generic and reusable
- Adding RVPLT/Lateral/Uplift requires only new engine class, no refactoring

**Pattern Details**:
```
┌─────────────────────────────────────────────────────────┐
│                    ITestEngine                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ calculate()                                      │   │
│  │ getAcceptanceCriteria()                         │   │
│  │ getGraphConfig()                                │   │
│  │ getReportSections()                             │   │
│  │ getAIConclusionPrompt()                         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           ▲           ▲           ▲           ▲
           │           │           │           │
    ┌──────┴──┐ ┌──────┴──┐ ┌──────┴──┐ ┌──────┴──┐
    │ IVPLT   │ │ RVPLT   │ │ Lateral │ │ Uplift  │
    │ Engine  │ │ Engine  │ │ Engine  │ │ Engine  │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

**Files**:
- `src/engines/types.ts` - Interface definitions
- `src/engines/factory.ts` - `getTestEngine()` factory
- `src/engines/ivplt-engine.ts` - Full implementation
- `src/engines/rvplt-engine.ts` - Stub (throws "not implemented")
- `src/engines/lateral-engine.ts` - Stub
- `src/engines/uplift-engine.ts` - Stub

---

## 5. AI Conclusion Generation

### Decision: Server-side AI with User Override

**Rationale**:
- AI generates IS 2911-compliant conclusion text from calculation results
- User can edit/override before finalizing (as per spec FR-027)
- Server-side keeps API keys secure

**Prompt Template** (from dev guidelines):
```
Generate a formal engineering conclusion for an IVPLT test.

Test Data:
- Design Load: {designLoad}T
- Test Load: {testLoad}T  
- Maximum Settlement: {maxSettlement}mm
- Elastic Rebound: {rebound}mm
- Net Settlement: {netSettlement}mm
- Settlement Limit: 12mm
- Result: {PASS/FAIL}

Requirements:
- Use active voice
- Reference IS 2911 (Part 4) - 2013
- If passed: State that design load can be adopted as safe vertical load
- If failed: Recommend remedial actions or further investigation
- Keep to 2-3 sentences
```

**API Provider**: Use environment variable to switch between OpenAI/Anthropic
- Default: OpenAI GPT-4o-mini (cost-effective)
- Fallback: Static template if AI unavailable

---

## 6. Faulty Gauge Handling

### Decision: Calculate with Enabled Gauges, Bold Visual Indicator

**Rationale**:
- Per FR-004/FR-005, disabled gauges excluded from average
- Visual indicator (strikethrough + red "Faulty" badge) alerts users
- Minimum 1 enabled gauge required (edge case validation)

**UI Treatment**:
```
┌─────────────────────────────────────────┐
│ Dial Gauges                             │
├──────────┬──────────┬──────────┬────────┤
│ DG1      │ DG2      │ DG3      │ DG4    │
│ 3.42mm   │ 3.51mm   │ ██████   │ 3.48mm │
│ ☑ OK     │ ☑ OK     │ ☐ FAULTY │ ☑ OK   │
└──────────┴──────────┴──────────┴────────┘
Average: (3.42 + 3.51 + 3.48) / 3 = 3.47mm
```

**Calculation**:
```typescript
function calculateAverageSettlement(
  g1: number, g2: number, g3: number, g4: number,
  g1Enabled: boolean, g2Enabled: boolean, g3Enabled: boolean, g4Enabled: boolean
): number {
  const gauges = [
    { value: g1, enabled: g1Enabled },
    { value: g2, enabled: g2Enabled },
    { value: g3, enabled: g3Enabled },
    { value: g4, enabled: g4Enabled },
  ];
  const enabled = gauges.filter(g => g.enabled);
  if (enabled.length === 0) throw new Error('At least one gauge must be enabled');
  return enabled.reduce((sum, g) => sum + g.value, 0) / enabled.length;
}
```

---

## 7. Data Migration Strategy

### Decision: Start Fresh with Supabase

**Rationale**:
- Current localStorage data is minimal (dev/test data only)
- New schema has significant structural changes
- Clean start avoids migration complexity

**Actions**:
- Remove localStorage persistence from Zustand store
- Add Supabase persistence layer
- Existing test data will be lost (acceptable per user confirmation)

---

## 8. Computed Results Storage

### Decision: Hybrid - Partial On-the-Fly + Full on Export

**Rationale**:
- KPIs (max settlement, net settlement) calculated on-the-fly for live preview
- Full calculation result cached when user clicks "Generate Report"
- Cached result used for PDF to ensure consistency

**Implementation**:
- `engine.calculate()` called on ReportView mount (live preview)
- Results stored in `Test.computedResult` JSON field on "Generate Report" click
- PDF generation reads from cached result, not recalculates

---

## 9. Linear Interpolation for Safe Load

### Decision: Implement IS 2911 Interpolation Algorithm

**Rationale**:
- Criterion A requires finding load at exactly 12mm settlement
- Data points rarely hit exactly 12mm, need interpolation
- Standard linear interpolation between two nearest points

**Algorithm**:
```typescript
function interpolateLoadAtSettlement(
  readings: { load: number; settlement: number }[],
  targetSettlement: number
): number | null {
  // Sort by settlement ascending
  const sorted = [...readings].sort((a, b) => a.settlement - b.settlement);
  
  // Find bracketing points
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    
    if (p1.settlement <= targetSettlement && p2.settlement >= targetSettlement) {
      // Linear interpolation
      const ratio = (targetSettlement - p1.settlement) / (p2.settlement - p1.settlement);
      return p1.load + ratio * (p2.load - p1.load);
    }
  }
  
  // Target not reached within data range
  return null;
}
```

**Usage**:
```typescript
const loadAt12mm = interpolateLoadAtSettlement(readings, 12);
const safeLoadA = loadAt12mm ? (2/3) * loadAt12mm : null;
```

---

## 10. Report Section Wording

### Decision: Standardized Templates from Dev Guidelines

**Source**: `project_info_and_context/dev_guidlines.md` provides exact IS 2911 wording.

**Sections**:
1. **General**: "Clients decided to carry out a static vertical pile load test on a {diameter}mm diameter pile..."
2. **Scope of Work**: Table with pile details + "Test load = 2.5 × design load"
3. **Methodology**: "Load testing conducted as per IS: 2911 (Part 4) – 2013..."
4. **Results**: Acceptance criteria list + settlement values + conclusion
5. **Data Table**: Time, Pressure, Load, DG1-4, Avg Settlement, Remarks
6. **Graph**: Load vs Settlement with annotations

**Dynamic Injection Points**:
- Project name, client, contractor, PMC
- Pile ID, diameter, depth, concrete grade
- Design load, test load, ram area
- All reading values
- Calculated safe load, pass/fail

---

## Summary of Decisions

| Topic | Decision | Key Reason |
|-------|----------|------------|
| PDF Generation | Playwright + HTML templates | Renders actual charts |
| Chart Export | Canvas → Base64 image | Consistent preview & PDF |
| File Storage | Supabase Storage buckets | RLS policies, signed URLs |
| Test Type Logic | Strategy Pattern (Engine) | Future extensibility |
| AI Conclusion | Server-side with override | Secure API keys, user control |
| Faulty Gauges | Exclude + bold indicator | Clear visual feedback |
| Data Migration | Fresh start | Too many schema changes |
| Computed Results | Hybrid (live + cached) | Performance + consistency |
| Safe Load Calc | Linear interpolation | IS 2911 requirement |
| Report Wording | Standardized templates | Professional consistency |
