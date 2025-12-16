# Report Generation V2 - Enhanced PDF Export

> **Status**: Draft  
> **Created**: 2024-12-16  
> **Parent Spec**: 001-ivplt-report-automation

---

## 1. Overview

### Problem Statement
Current PDF export uses Playwright which doesn't work on Vercel serverless (falls back to `window.print()`). Additionally, the report structure needs enhancement to match professional IS 2911 reports with proper sections, AI-generated titles, and flexible image layouts.

### Solution
1. Fix PDF generation for serverless using `@sparticuz/chromium`
2. Rename "Report" tab to "Report Summary"
3. Add "Generate Report" button that opens a dedicated report finalization screen
4. Implement section-based editing with two preview templates
5. Enhanced PDF structure matching industry standards

### Key User Story
> As a site engineer, after entering the final reading, I want to generate a professional IS 2911-compliant report immediately on-site, with the ability to review and make minor adjustments before downloading the PDF.

---

## 2. Navigation Changes

### Current Flow
```
Home → Test Workspace → [Details | Data Entry | Report]
                                              ↑ Shows KPIs, chart, table
```

### New Flow
```
Home → Test Workspace → [Details | Data Entry | Report Summary]
                                              ↑ Shows KPIs, chart, table
                                              ↓ "Generate Report" button
                                    ┌─────────────────────────────┐
                                    │   Report Editor Screen      │
                                    │   [Preview | Modern Preview]│
                                    │   Section-based editing     │
                                    │   [Download PDF] [Print]    │
                                    └─────────────────────────────┘
```

---

## 3. Report Editor Screen

### 3.1 Layout
Full-screen modal/page with two tabs:

| Tab | Description |
|-----|-------------|
| **Preview** | Exact PDF layout (formal, A4 pages, what gets downloaded) |
| **Modern Preview** | Web-styled view (like current Report Summary, also printable) |

### 3.2 Section-Based Editing
Each report section is displayed as a card. Sections can be:
- **Locked**: Auto-calculated, cannot be edited (shows lock icon)
- **Editable**: Can be tapped to open edit modal (shows edit icon)

| Section | Editable? | Notes |
|---------|-----------|-------|
| Cover Page | ✅ | AI-generated title, project info, first site image |
| Index/TOC | ❌ | Auto-generated with page numbers, second site image |
| Methodology | ⚙️ | Boilerplate, "Customize" for power users (future) |
| Pile Specifications | ✅ | Minor tweaks allowed |
| KPIs/Summary | ❌ | Calculated from readings |
| Results & Criteria | ❌ | Calculated |
| Chart Page (KEY) | ❌ | Chart + KPIs + 2-line summary on ONE page |
| Data Table | ❌ | From readings, includes signature column |
| Conclusion | ✅ | AI-generated with regenerate button |
| Site Images | ✅ | Select, reorder, caption remaining images |
| Field Readings PDF | ❌ | Uploaded handwritten sheets |
| Certificates | ❌ | Uploaded PDFs |

### 3.3 Actions
- **Download PDF**: Generate and download the formal PDF
- **Print**: Browser print (Modern Preview tab)
- **Back**: Return to Report Summary

---

## 4. PDF Structure (A4 Pages)

### Page 1: Cover Page
```
┌─────────────────────────────────────────────────┐
│                                                 │
│   INITIAL STATIC VERTICAL PILE LOAD TEST        │  ← AI-generated title
│   ON [diameter] DIA PILE FOR [PROJECT NAME]          │    from project details
│   AT [LOCATION]                                 │
│   (INITIAL TEST PILE [PILE-ID])                 │
│                                                 │
│   ┌─────────────────────────────────┐           │
│   │                                 │           │
│   │     [First Site Image]          │           │  ← First uploaded image
│   │                                 │           │
│   └─────────────────────────────────┘           │
│                                                 │
│   Submitted to: [Company Name]                  │
│   Client: [Client]                              │
│   Contractor: [Contractor]                      │
│   PMC: [PMC]                                    │
│                                                 │
│   Test conducted as per IS 2911 (Part 4) - 2013 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**AI Title Generation Rules:**
- Line 1: Test type in caps (e.g., "INITIAL STATIC VERTICAL PILE LOAD TEST")
- Line 2: "ON {diameter}mm DIA PILE FOR {project_name}"
- Line 3: "AT {location}"
- Line 4: "(INITIAL TEST PILE {pile_id})"

### Page 2: Index / Table of Contents
```
┌─────────────────────────────────────────────────┐
│   CONTENTS                                      │
│                                                 │
│   1.0 General .......................... Page 3 │
│   2.0 Scope of Work .................... Page 4 │
│   3.0 Methodology ...................... Page 5 │
│   4.0 Results .......................... Page 6 │
│   5.0 Readings and Graph ............... Page 7 │
│   6.0 Field Readings .................. Page 12 │
│   7.0 Calibration Certificate ......... Page 15 │
│                                                 │
│   ┌─────────────────────────────────┐           │
│   │     [Second Site Image]         │           │  ← Second uploaded image
│   └─────────────────────────────────┘           │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Page 3: General (1.0)
Standard boilerplate text per IS 2911, filled with project details.

### Page 4: Scope of Work (2.0) - Pile Specifications
```
┌─────────────────────────────────────────────────┐
│   2.0 SCOPE OF WORK                             │
│                                                 │
│   Pile details are tabulated as below.          │
│                                                 │
│   ┌───────────────────┬───────────────────────┐ │
│   │ Location          │ [Location]            │ │
│   │ Pile ID           │ [Pile ID]             │ │
│   │ Pile Diameter     │ [xxx] mm              │ │
│   │ Pile Depth        │ [xxx] m               │ │
│   │ Concrete Grade    │ [M##]                 │ │
│   │ Design Load       │ [xxx] MT              │ │
│   │ Test Load (2.5×)  │ [xxx] MT              │ │
│   │ Ram Area          │ [xxx] cm²             │ │
│   │ Dial Gauge LC     │ [0.01] mm             │ │
│   └───────────────────┴───────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Page 5: Methodology (3.0)
Boilerplate IS 2911 methodology text. Same for all IVPLT tests.

### Page 6: Results (4.0) - KPIs & Acceptance Criteria
KPI cards + acceptance criteria text + pass/fail verdict.

### Page 7: Chart Page (KEY PAGE) ⭐
**This is the most important page - authorities check this first.**

Must fit on ONE A4 page:
```
┌─────────────────────────────────────────────────┐
│   5.0 LOAD VS SETTLEMENT CURVE                  │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │                                         │   │
│   │         [Load vs Settlement Chart]      │   │  ← ~60% of page
│   │                                         │   │
│   │                                         │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│   │Test Load │ │ Max Sett │ │Net Sett  │       │  ← KPI cards
│   │ 367.5 MT │ │ 9.88 mm  │ │ 7.52 mm  │       │
│   └──────────┘ └──────────┘ └──────────┘       │
│                                                 │
│   TEST PASSED ✓                                 │  ← 2-line summary
│   Net settlement 7.52mm within 12mm limit       │
│   (IS 2911 Part 4)                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Page 8: Conclusion (6.0)
AI-generated or template conclusion text. Editable by engineer.

### Pages 9-12: Data Table (5.0 continued)
Full readings table with columns:
| S.No | Date | Time | Pressure | Load | DG1 | DG2 | DG3 | DG4 | Avg | Phase | Signature |
|------|------|------|----------|------|-----|-----|-----|-----|-----|-------|-----------|

**Signature column**: Empty, for manual signing after print.

### Pages 13-14: Remaining Site Images
- Images 3 and 4 (if uploaded)
- Layout adapts to aspect ratio
- Each image can have a caption

### Pages 15+: Field Readings PDF
Embedded/attached original handwritten field sheets (uploaded by engineer).

### Final Pages: Calibration Certificates
Uploaded certificate PDFs appended to report.

---

## 5. New Features Required

### 5.1 Field Readings Upload
**Location**: First item in Project Details tab (dropdown/upload section)

| Field | Type | Description |
|-------|------|-------------|
| Field Readings | File upload (PDF/images) | Original handwritten field sheets |

**Database**: Store in Supabase Storage, link to test record.

### 5.2 AI Title Generation
Use OpenAI/Claude to generate formal report title from:
- Test type (IVPLT, RVPLT, etc.)
- Pile diameter
- Project name
- Location
- Pile ID

**Prompt template**:
```
Generate a formal engineering report title for a pile load test.
Test Type: {testType}
Pile Diameter: {diameter}mm
Project: {projectName}
Location: {location}
Pile ID: {pileId}

Format as 4 lines:
Line 1: Test type in capitals
Line 2: ON {diameter}mm DIA PILE FOR {project}
Line 3: AT {location}
Line 4: ({test type} TEST PILE {pileId})
```

### 5.3 Fix Serverless PDF Generation
Replace current Playwright setup with `@sparticuz/chromium` for Vercel compatibility.

**Changes to `src/lib/pdf/generator.ts`**:
```typescript
// Before
import { chromium } from 'playwright';

// After
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
```

### 5.4 Image Limit Change
Change max site images from 5 to 4:
- Image 1: Cover page
- Image 2: Index/TOC page
- Images 3-4: Remaining images section

---

## 6. UI Components

### 6.1 Report Editor Screen
New component: `src/components/test/report-editor.tsx`

```
ReportEditor
├── ReportEditorHeader (tabs, back button)
├── PreviewTab
│   ├── CoverPageSection (editable)
│   ├── TOCSection (locked)
│   ├── MethodologySection (locked)
│   ├── SpecsSection (editable)
│   ├── KPIsSection (locked)
│   ├── ResultsSection (locked)
│   ├── ChartPageSection (locked)
│   ├── DataTableSection (locked)
│   ├── ConclusionSection (editable)
│   ├── SiteImagesSection (editable)
│   ├── FieldReadingsSection (locked)
│   └── CertificatesSection (locked)
├── ModernPreviewTab
│   └── (Reuse current ReportView styling)
└── ActionBar (Download PDF, Print)
```

### 6.2 Section Card Component
```tsx
interface SectionCardProps {
  title: string;
  icon: ReactNode;
  isLocked: boolean;
  onEdit?: () => void;
  children: ReactNode;
}
```

### 6.3 Edit Modals
- `EditCoverModal`: Title text, project info
- `EditSpecsModal`: Pile specifications
- `EditConclusionModal`: Conclusion text with AI regenerate
- `EditImagesModal`: Image selection, reorder, captions

---

## 7. Data Model Changes

### 7.1 New Fields on Test Model
```prisma
model Test {
  // ... existing fields ...
  
  // Report customization
  reportTitle     String?   // AI-generated, can be edited
  
  // Field readings (handwritten sheets)
  fieldReadings   FieldReading[]
}

model FieldReading {
  id        String   @id @default(cuid())
  testId    String
  test      Test     @relation(fields: [testId], references: [id], onDelete: Cascade)
  filename  String
  url       String   // Supabase Storage URL
  order     Int      @default(0)
  createdAt DateTime @default(now())
}
```

### 7.2 Image Caption Support
```prisma
model TestImage {
  // ... existing fields ...
  caption   String?  // User-entered caption for report
}
```

---

## 8. API Endpoints

### 8.1 Field Readings
```
POST   /api/tests/[testId]/field-readings     - Upload field reading
GET    /api/tests/[testId]/field-readings     - List field readings
DELETE /api/tests/[testId]/field-readings/[id] - Delete field reading
```

### 8.2 Report Title
```
POST   /api/tests/[testId]/title              - Generate AI title
PATCH  /api/tests/[testId]/title              - Update title manually
```

### 8.3 Image Captions
```
PATCH  /api/tests/[testId]/images/[imageId]   - Update caption
```

---

## 9. Implementation Phases

### Phase 1: Fix PDF Generation (Priority: High)
- [ ] Install `@sparticuz/chromium` and `puppeteer-core`
- [ ] Update `src/lib/pdf/generator.ts` for serverless
- [ ] Test on Vercel deployment

### Phase 2: Navigation Changes
- [ ] Rename "Report" tab to "Report Summary"
- [ ] Add "Generate Report" button to Report Summary
- [ ] Create Report Editor screen shell

### Phase 3: PDF Template Enhancement
- [ ] Update `ivplt-template.tsx` with new structure
- [ ] Add cover page with AI title
- [ ] Add index/TOC page
- [ ] Create chart page (one-page layout)
- [ ] Add signature column to data table
- [ ] Add remaining images section

### Phase 4: Section Editing
- [ ] Implement section card component
- [ ] Create edit modals (cover, specs, conclusion, images)
- [ ] Wire up section editing to PDF regeneration

### Phase 5: Field Readings Upload
- [ ] Add upload UI to Project Details
- [ ] Create API endpoints
- [ ] Update database schema
- [ ] Include in PDF generation

### Phase 6: Image Limit & Layout
- [ ] Change max images from 5 to 4
- [ ] Implement smart image layout for remaining images
- [ ] Add caption support

---

## 10. Success Criteria

| Metric | Target |
|--------|--------|
| PDF generation works on Vercel | ✅ No fallback to window.print() |
| Report generation time | < 15 seconds |
| All IS 2911 sections present | ✅ Cover, TOC, Methodology, Specs, Results, Chart, Data, Conclusion |
| Chart page fits on one A4 | ✅ Authorities can see key info at a glance |
| Engineer can edit conclusion | ✅ With AI regenerate option |
| Field readings included | ✅ Original handwritten sheets attached |

---

## 11. Out of Scope (Future)

- [ ] .docx export
- [ ] Real-time collaborative editing
- [ ] Digital signature capture
- [ ] Custom report templates per client
- [ ] Multi-language support

---

## 12. References

- [Example Report Titles](../project_info_and_context/example-titles)
- [Sample Reports](../project_info_and_context/these-are-the-reports-to-automate/)
- [IS 2911 Standard](../project_info_and_context/toaz.info-is-2911-part-4-2013-pr_7f2b24b9967b1ff7ae73343b5f364aea.pdf)
- [Dev Guidelines](../project_info_and_context/dev_guidlines.md)
