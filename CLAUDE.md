# CLAUDE.md - PileTest Pro

> AI coding assistant instructions for this project.

---

## Project Overview

**PileTest Pro** transforms handwritten pile load test field readings into professional engineering reports. Site engineers photograph handwritten data sheets, the app extracts data via OCR, and generates IS 2911-compliant reports with interactive charts.

### Core Flow
```
Upload (images/PDFs) → OCR Extraction → Verify/Edit → Generate Report → Export PDF
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 14+ (App Router) | React framework with file-based routing |
| Language | TypeScript | 5+ | Type safety throughout |
| Styling | Tailwind CSS | 3.4+ | Utility-first CSS |
| Components | shadcn/ui | latest | Accessible, customizable components |
| Charts | Chart.js + react-chartjs-2 | 4+ | Load vs Settlement curves |
| OCR | PaddleOCR (via API/WASM) | 3.0+ | Handwriting recognition for field sheets |
| PDF Export | Playwright | latest | Server-side PDF generation from HTML |
| State | Zustand | 4+ | Lightweight client state management |
| Forms | React Hook Form + Zod | latest | Form handling and validation |

### Why These Choices

- **PaddleOCR**: [65k+ stars](https://github.com/PaddlePaddle/PaddleOCR), supports 100+ languages, excellent handwriting recognition, can run via Python API or ONNX in browser
- **Playwright PDF**: Renders actual HTML/CSS to PDF with full fidelity (better than jsPDF for complex layouts)
- **shadcn/ui**: Not a component library - copies components into your codebase, fully customizable

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Home/Upload screen
│   ├── verify/
│   │   └── page.tsx            # OCR verification screen
│   ├── report/
│   │   └── page.tsx            # Report dashboard screen
│   └── api/
│       ├── ocr/
│       │   └── route.ts        # OCR processing endpoint
│       └── pdf/
│           └── route.ts        # PDF generation endpoint
│
├── components/
│   ├── ui/                     # shadcn/ui components (Button, Card, etc.)
│   ├── upload/
│   │   ├── dropzone.tsx        # File upload area
│   │   ├── test-type-select.tsx
│   │   └── metadata-form.tsx
│   ├── verify/
│   │   ├── image-preview.tsx   # Original image with zoom
│   │   ├── readings-table.tsx  # Editable extracted data
│   │   └── specs-form.tsx      # Pile specifications
│   └── report/
│       ├── kpi-cards.tsx
│       ├── load-settlement-chart.tsx
│       ├── specs-panel.tsx
│       ├── data-table.tsx
│       └── attachments.tsx
│
├── lib/
│   ├── ocr/
│   │   └── paddle-ocr.ts       # PaddleOCR integration
│   ├── pdf/
│   │   └── playwright-pdf.ts   # Playwright PDF generation
│   ├── calculations.ts         # Load, settlement formulas
│   └── utils.ts                # General utilities (cn, etc.)
│
├── store/
│   └── report-store.ts         # Zustand store for report state
│
├── types/
│   └── index.ts                # TypeScript interfaces
│
└── styles/
    └── globals.css             # Tailwind directives + custom styles
```

---

## Coding Conventions

### File Naming
- **Components**: `kebab-case.tsx` (e.g., `kpi-cards.tsx`)
- **Utilities**: `kebab-case.ts` (e.g., `paddle-ocr.ts`)
- **Types**: `index.ts` in `types/` folder
- **Pages**: `page.tsx` (Next.js App Router convention)

### Component Structure
```tsx
// Example component structure
'use client'; // Only if client-side features needed

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: 'success' | 'warning' | 'error';
}

/**
 * Displays a single KPI metric card on the report dashboard.
 * Why: Provides at-a-glance view of key test results (load, settlement, status).
 */
export function KPICard({ label, value, unit, status }: KPICardProps) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-6 shadow-sm",
      status === 'success' && "border-green-200 bg-green-50"
    )}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">
        {value} {unit && <span className="text-base font-normal">{unit}</span>}
      </p>
    </div>
  );
}
```

### Documentation Rule
Every class, enum, interface, and exported function MUST have a comment explaining **why it exists**:

```tsx
/**
 * Represents a single load increment reading from the field sheet.
 * Why: This is the atomic unit of data captured during pile testing - 
 * each row in the handwritten sheet becomes one LoadReading.
 */
interface LoadReading {
  // ...
}
```

### State Management
- Use **Zustand** for global report state
- Keep component state local when possible
- Store shape:

```tsx
interface ReportStore {
  // Current report being edited
  report: PileTestReport | null;
  
  // Workflow state
  step: 'upload' | 'verify' | 'report';
  
  // Actions
  setReport: (report: PileTestReport) => void;
  updateReadings: (readings: LoadReading[]) => void;
  setStep: (step: ReportStore['step']) => void;
  reset: () => void;
}
```

---

## Test Types & Calculations

### Supported Test Types
| Type | Code | Test Load | Pass Criteria |
|------|------|-----------|---------------|
| Initial Vertical | `IVPLT` | 2.5x design | Net settlement ≤ 12mm |
| Routine Vertical | `RVPLT` | 1.5x design | Net settlement ≤ 12mm |
| Pullout | `PULLOUT` | 2.5x design | Net uplift ≤ limit |
| Lateral | `LATERAL` | 2.5x design | Deflection ≤ limit |

### Key Formulas
```typescript
// Load from pressure gauge reading
const load = (pressure * ramArea) / 1000; // MT

// Average settlement from 4 dial gauges
const avgSettlement = (g1 + g2 + g3 + g4) / 4; // mm

// Net settlement (permanent deformation)
const netSettlement = finalSettlement - initialReading; // mm

// Pass/Fail determination (IS 2911 Part 4)
const passed = netSettlement <= 12; // For vertical tests
```

---

## OCR Integration (PaddleOCR)

### Approach Options

**Option A: Python API Server (Recommended for MVP)**
```python
# Simple FastAPI endpoint
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en')

@app.post("/ocr")
async def extract_text(file: UploadFile):
    result = ocr.ocr(file.file.read())
    return {"text": result}
```

**Option B: ONNX in Browser (Future)**
- Use PaddleOCR's ONNX export
- Run via ONNX Runtime Web
- Fully client-side

### Expected OCR Output
The OCR should extract tabular data from field sheets:
- Pressure readings (kg/cm²)
- Dial gauge readings (4 columns)
- Time stamps
- Cycle markers (Loading/Unloading)

---

## PDF Generation (Playwright)

```typescript
// lib/pdf/playwright-pdf.ts
import { chromium } from 'playwright';

/**
 * Generates a PDF from the report HTML using Playwright.
 * Why: Playwright renders actual CSS/HTML to PDF with full fidelity,
 * unlike canvas-based solutions that lose styling.
 */
export async function generateReportPDF(reportHtml: string): Promise<Buffer> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(reportHtml, { waitUntil: 'networkidle' });
  
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
  });
  
  await browser.close();
  return pdf;
}
```

---

## UI/UX Guidelines

### Design System
- Use **shadcn/ui** components as base
- Follow the existing `report.html` aesthetic (dark sidebar, light content)
- Color palette:
  ```css
  --primary: #2563eb;     /* Blue - actions, links */
  --success: #10b981;     /* Green - pass status */
  --warning: #f59e0b;     /* Amber - warnings */
  --destructive: #ef4444; /* Red - fail status */
  ```

### Screen Layouts

**Upload Screen**
- Full-width dropzone (prominent)
- Test type selector (radio/cards)
- Basic metadata form below

**Verify Screen**
- Split view: Image left (60%), Data right (40%)
- Highlight low-confidence OCR cells
- Inline editing

**Report Screen**
- Match `report.html` layout exactly
- Sidebar navigation between reports
- Sticky header with export button

---

## API Routes

### POST `/api/ocr`
- Input: `multipart/form-data` with image file
- Output: `{ readings: LoadReading[], confidence: number }`

### POST `/api/pdf`
- Input: `{ reportId: string }` or full report data
- Output: PDF binary stream

---

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Type check
npm run typecheck
```

---

## MVP Scope

### In Scope
- [x] Single report workflow (upload → verify → report)
- [x] In-memory storage (no database)
- [x] OCR extraction from images
- [x] Interactive Load vs Settlement chart
- [x] PDF export of final report
- [x] Basic metadata editing

### Out of Scope (Phase 2+)
- [ ] User authentication
- [ ] Report persistence (database)
- [ ] Multi-report management
- [ ] Approval workflows
- [ ] Mobile-optimized capture

---

## Reference Files

| File | Use For |
|------|---------|
| `project_info_and_context/report.html` | Target UI design |
| `project_info_and_context/all-hand-readings.pdf` | Sample OCR input |
| `project_info_and_context/these-are-the-reports-to-automate/` | PDF output reference |

---

## Error Handling

- Wrap async operations in try/catch
- Show toast notifications for user feedback
- Log errors with context for debugging
- Graceful degradation if OCR confidence is low

```tsx
try {
  const result = await extractWithOCR(file);
  if (result.confidence < 0.7) {
    toast.warning('Low confidence OCR - please verify carefully');
  }
} catch (error) {
  toast.error('OCR failed - please try again');
  console.error('[OCR Error]', error);
}
```

