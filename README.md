# PileTest Pro

> Transform handwritten pile load test readings into professional engineering reports in minutes.

---

## Problem Statement

The current pile load testing workflow is **manual, slow, and error-prone**:

| Pain Point | Impact |
|------------|--------|
| Handwritten field readings | Transcription errors, lost data |
| Excel-based calculations | Formula mistakes, no audit trail |
| Manual graph plotting | Inconsistent, time-consuming |
| Word/PDF report assembly | Hours of copy-paste work |
| No unified workflow | Delays between site, reviewer, manager |

**Result**: A single pile test report takes 4-8 hours to produce, with high risk of human error.

---

## Solution

A **3-screen web app** that digitizes the entire workflow:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   📤 UPLOAD     │ ──▶ │   ✅ VERIFY     │ ──▶ │   📊 REPORT     │
│                 │     │                 │     │                 │
│ Raw field photos│     │ OCR extraction  │     │ Interactive     │
│ Handwritten PDFs│     │ correction UI   │     │ dashboard +     │
│                 │     │                 │     │ PDF export      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Screens

### Screen 1: Upload
**Purpose**: Start a new report and upload raw site data

- Create new report with basic metadata (Project, Test ID, Location, Date)
- Select test type:
  - **IVPLT** - Initial Vertical Pile Load Test
  - **RVPLT** - Routine Vertical Pile Load Test  
  - **Pullout** - Pullout Load Test
  - **Lateral** - Lateral Load Test
- Upload sources:
  - Photos of handwritten field sheets
  - Scanned PDFs of manual readings
  - Camera capture (mobile)
- Drag-and-drop or file picker interface

### Screen 2: Verify OCR
**Purpose**: Review and correct OCR-extracted data before report generation

- Side-by-side view: original image ↔ extracted data
- Editable table for:
  - Load increments (kg/cm² pressure → MT load)
  - Dial gauge readings (4 gauges typically)
  - Time stamps
  - Cycle phases (Loading/Unloading)
- Highlight low-confidence OCR fields in yellow
- Add/remove rows
- Pile specification inputs (diameter, depth, concrete grade, etc.)

### Screen 3: Report Dashboard
**Purpose**: View the final professional report and export

**Components:**
- **Header**: Report ID, Project, Location, Date, Test Type
- **KPI Cards**: Test Load, Max Settlement, Net Settlement, Pass/Fail Status
- **Interactive Chart**: Load vs. Settlement curve (loading + unloading phases)
- **Specifications Panel**: Pile diameter, depth, grade, method, ram area
- **Data Table**: Complete load increment summary
- **Attachments Section**: Add site photos, calibration certs, notes
- **Export**: Download as PDF

---

## Supported Test Types

| Test Type | Code | Standard | Key Metrics |
|-----------|------|----------|-------------|
| Initial Vertical | IVPLT | IS 2911 Part 4 | Settlement at 2.5x design load |
| Routine Vertical | RVPLT | IS 2911 Part 4 | Settlement at 1.5x design load |
| Pullout | - | IS 2911 Part 4 | Uplift displacement |
| Lateral | - | IS 2911 Part 4 | Lateral deflection |

---

## Data Model

```typescript
interface PileTestReport {
  // Metadata
  id: string;
  projectName: string;
  testId: string;           // e.g., "TP-04"
  location: string;
  testDate: Date;
  testType: 'IVPLT' | 'RVPLT' | 'PULLOUT' | 'LATERAL';
  
  // Pile Specifications
  pileSpecs: {
    diameter: number;       // mm
    depth: number;          // meters
    concreteGrade: string;  // e.g., "M-25"
    designLoad: number;     // MT
    testLoad: number;       // MT (typically 1.5x or 2.5x design)
    ramArea: number;        // cm²
  };
  
  // Test Readings (OCR extracted)
  readings: LoadReading[];
  
  // Calculated Results
  results: {
    maxSettlement: number;  // mm
    netSettlement: number;  // mm
    safeLoad: number;       // MT
    status: 'PASS' | 'FAIL';
  };
  
  // Attachments
  attachments: {
    sourceImages: File[];
    sitePhotos: File[];
    notes: string;
  };
}

interface LoadReading {
  cycle: 'LOADING' | 'UNLOADING' | 'HOLD';
  pressure: number;         // kg/cm²
  load: number;             // MT (calculated from pressure × ram area)
  gaugeReadings: number[];  // 4 dial gauge readings in mm
  avgSettlement: number;    // mm (calculated average)
  timestamp: Date;
  remarks?: string;
}
```

---

## Tech Stack (MVP)

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | Next.js 14 (App Router) | React framework with file-based routing |
| Styling | Tailwind CSS + shadcn/ui | Utility CSS + accessible components |
| Charts | Chart.js + react-chartjs-2 | Simple, performant, matches reference |
| OCR | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | 65k+ stars, excellent handwriting recognition |
| PDF Export | [Playwright](https://playwright.dev/) | Full-fidelity HTML→PDF rendering |
| State | Zustand | Lightweight, perfect for in-memory |
| Forms | React Hook Form + Zod | Validation and form handling |

**Minimal backend** - OCR and PDF generation run via Next.js API routes.

---

## Calculations

### Load from Pressure
```
Load (MT) = Pressure (kg/cm²) × Ram Area (cm²) / 1000
```

### Average Settlement
```
Avg Settlement = (Gauge1 + Gauge2 + Gauge3 + Gauge4) / 4
```

### Net Settlement
```
Net Settlement = Final Settlement (after full unload) - Initial Reading
```

### Pass/Fail Criteria (IS 2911)
- **Vertical Tests**: Net settlement ≤ 12mm at 2.5x design load → PASS
- **Lateral Tests**: Deflection within limits per IS code → PASS

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Upload screen (Screen 1)
│   ├── verify/
│   │   └── page.tsx          # OCR verification (Screen 2)
│   ├── report/
│   │   └── page.tsx          # Report dashboard (Screen 3)
│   └── api/
│       ├── ocr/route.ts      # PaddleOCR endpoint
│       └── pdf/route.ts      # Playwright PDF endpoint
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── upload/
│   │   ├── dropzone.tsx
│   │   ├── test-type-select.tsx
│   │   └── metadata-form.tsx
│   ├── verify/
│   │   ├── image-preview.tsx
│   │   ├── readings-table.tsx
│   │   └── specs-form.tsx
│   └── report/
│       ├── kpi-cards.tsx
│       ├── load-settlement-chart.tsx
│       ├── specs-panel.tsx
│       ├── data-table.tsx
│       └── attachments.tsx
├── lib/
│   ├── ocr/paddle-ocr.ts     # PaddleOCR integration
│   ├── pdf/playwright-pdf.ts # PDF generation
│   ├── calculations.ts       # Load, settlement formulas
│   └── utils.ts              # General utilities
├── store/
│   └── report-store.ts       # Zustand store
└── types/
    └── index.ts              # TypeScript interfaces
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## Reference Materials

Located in `project_info_and_context/`:

| File | Purpose |
|------|---------|
| `all-hand-readings.pdf` | Sample handwritten field sheet (OCR input) |
| `these-are-the-reports-to-automate/` | Target PDF reports to replicate |
| `report.html` | Reference interactive dashboard design |
| `toaz.info-is-2911...pdf` | IS 2911 Part 4 standard reference |
| `Pile Load Test.pptx` | Domain knowledge presentation |

---

## Future Roadmap

- [ ] **Phase 1**: MVP with in-memory storage (current)
- [ ] **Phase 2**: Supabase backend for persistence
- [ ] **Phase 3**: Multi-user roles (Site Engineer, Reviewer, Manager)
- [ ] **Phase 4**: Mobile app for field capture
- [ ] **Phase 5**: AI-powered anomaly detection in test data

---

## License

Private - ZedGeo Engineering Solutions
