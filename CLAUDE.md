# CLAUDE.md - PileTest Pro

> AI coding assistant instructions for this project.

---

## Project Overview

**PileTest Pro** is a mobile-first web app for site engineers to record pile load test readings and generate IS 2911-compliant reports. Engineers enter data directly on-site using their mobile devices.

### Core Flow (MVP)
```
Home (test list) → Select Test Type → Enter Details → Add Readings → View Report → Export PDF
```

**Note**: OCR-based workflow is archived in `src/_archive/` for future use. Current MVP uses manual data entry.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 14+ (App Router) | React framework with file-based routing |
| Language | TypeScript | 5+ | Type safety throughout |
| Styling | Tailwind CSS | 3.4+ | Utility-first CSS, mobile-first design |
| Charts | Chart.js + react-chartjs-2 | 4+ | Load vs Settlement curves |
| State | Zustand | 4+ | Lightweight client state management |
| Persistence | localStorage | - | Browser storage for MVP |
| Icons | Lucide React | latest | Consistent icon set |

### Why These Choices

- **Zustand + localStorage**: Simple persistence without backend complexity for MVP
- **Mobile-first**: Site engineers use phones in the field
- **No OCR for MVP**: Direct entry is faster to ship and more reliable

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home screen (test list)
│   └── test/
│       └── page.tsx            # Test workspace with tab navigation
│
├── components/
│   ├── home/
│   │   ├── home-screen.tsx     # Test list + "Start New Test" button
│   │   ├── test-type-modal.tsx # IVPLT/RVPLT/Lateral/Uplift selection
│   │   ├── profile-modal.tsx   # User profile for signatures
│   │   └── index.ts
│   └── test/
│       ├── project-details.tsx # Project info + pile specs form
│       ├── data-entry.tsx      # Timeline table of readings
│       ├── add-reading-page.tsx# Full-page form for single reading
│       ├── report-view.tsx     # KPIs, chart, specs, data table
│       └── index.ts
│
├── store/
│   └── test-store.ts           # Zustand store with localStorage persistence
│
├── types/
│   └── index.ts                # TypeScript interfaces + calculation helpers
│
├── lib/
│   ├── utils.ts                # General utilities (cn, etc.)
│   ├── ai/
│   │   ├── conclusion-agent.ts # AI conclusion generation via @openai/agents
│   │   └── index.ts            # Barrel export
│   └── pdf/
│       ├── generator.ts        # Playwright PDF generation
│       └── templates/          # HTML templates for PDF
│
├── styles/
│   └── globals.css             # Tailwind directives + custom styles
│
└── _archive/                   # Archived OCR workflow (for future use)
    ├── app/                    # Old verify, report pages
    ├── components/             # Old upload, verify, report components
    └── lib/                    # OCR API, calculations, PDF generation
```

---

## Coding Conventions

### File Naming
- **Components**: `kebab-case.tsx` (e.g., `home-screen.tsx`)
- **Utilities**: `kebab-case.ts` (e.g., `test-store.ts`)
- **Types**: `index.ts` in `types/` folder
- **Pages**: `page.tsx` (Next.js App Router convention)

### Component Structure
```tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ProjectInfo } from '@/types';

/**
 * Props for the component.
 * Why: Defines the data and callbacks needed from parent.
 */
interface MyComponentProps {
  data: ProjectInfo;
  onSave: (data: ProjectInfo) => void;
}

/**
 * Brief description of what this component does.
 * Why: Explains the purpose in the overall workflow.
 */
export function MyComponent({ data, onSave }: MyComponentProps) {
  // Component logic
}
```

### Documentation Rule
Every class, enum, interface, and exported function MUST have a comment explaining **why it exists**:

```tsx
/**
 * A single reading captured during the pile load test.
 * Why: Represents one time-stamped measurement with pressure and dial gauge readings.
 */
export interface Reading {
  id: string;
  pressureGauge: string;
  // ...
}
```

### State Management
- Use **Zustand** for global app state
- Store persists to localStorage automatically
- Key store shape:

```tsx
interface TestState {
  // Navigation
  view: 'home' | 'test';
  currentStep: 'details' | 'entry' | 'report';
  currentTestId: string | null;
  
  // Data
  allTests: SavedTest[];
  projectInfo: ProjectInfo;
  loadEntries: LoadEntry[];
  userProfile: UserProfile;
  
  // Actions
  createNewTest: (testType: TestType) => void;
  openTest: (testId: string) => void;
  updateProjectField: (field, value) => void;
  addLoadEntry: (entry: LoadEntry) => void;
  // ...
}
```

---

## Test Types & Calculations

### Supported Test Types
| Type | Code | Test Load | Pass Criteria |
|------|------|-----------|---------------|
| Initial Vertical | `IVPLT` | 2.5x design | Net settlement ≤ 12mm |
| Routine Vertical | `RVPLT` | 1.5x design | Net settlement ≤ 12mm |
| Lateral | `Lateral` | 2.5x design | Deflection ≤ limit |
| Uplift / Pullout | `Uplift` | 2.5x design | Net uplift ≤ limit |

### Key Formulas
```typescript
// Load from pressure gauge reading
const load = (pressure * ramArea) / 1000; // MT

// Average settlement from 4 dial gauges
const avgSettlement = (g1 + g2 + g3 + g4) / 4; // mm

// Pass/Fail determination (IS 2911 Part 4)
const passed = netSettlement <= 12; // For vertical tests
```

These are implemented in `src/types/index.ts`:
- `calculateLoad(pressure, ramArea)`
- `calculateAverageSettlement(g1, g2, g3, g4)`
- `SETTLEMENT_LIMIT_MM = 12`

---

## UI/UX Guidelines

### Design System
- Mobile-first approach (site engineers use phones)
- Follow the Figma design in `figma/Mobile App for Site Engineers/`
- Color palette (from `DESIGN_SYSTEM.md`):
  ```css
  --primary: #2563eb;     /* Blue - actions, active tabs */
  --success: #10b981;     /* Green - pass status, unloading */
  --warning: #f59e0b;     /* Amber - holding phase */
  --destructive: #ef4444; /* Red - fail status, delete */
  --slate-800: #1e293b;   /* Midnight Slate - headers */
  ```

### Screen Layouts

**Home Screen**
- Slate header with app branding
- "Start New Pile Test" button (prominent blue)
- Recent tests list with cards
- Profile button in header

**Test Workspace** (tab navigation)
- **Details Tab**: Project info + pile specs forms
- **Data Entry Tab**: Timeline table + "Add Reading" button
- **Report Tab**: KPIs, chart, specs panel, data table

**Add Reading Page** (full-screen modal)
- Date & Time (auto-filled)
- Pressure & Load (with calculated preview)
- 4 Dial Gauge inputs (2x2 grid)
- Phase selector (Loading/Holding/Unloading)
- Remark (optional)
- Signature input
- Slide-to-confirm button

---

## Date Format Standards

**Why**: Ensures consistency across the app per IS 2911 compliance and site engineer expectations.

### Standard Format: dd/mm/yyyy
All date displays throughout the app MUST use `dd/mm/yyyy` format (e.g., `15/01/2024`):
- Home screen (test list)
- Project details page
- Data entry table
- Add reading page
- Report page data table

### Exception: Report Headers
Report headers and PDF exports MAY use long format for better readability:
- Format: `15 January 2024`
- Used in: Report view header, PDF exports, print view

### Implementation
Use utility functions from `src/lib/utils.ts`:
```typescript
import { formatDateDDMMYYYY, formatDateLong, convertDDMMYYYYToISO, convertISOToDDMMYYYY, isValidDDMMYYYY } from '@/lib/utils';

// Standard display (dd/mm/yyyy)
const dateStr = formatDateDDMMYYYY(new Date());  // "15/01/2024"
const dateStr2 = formatDateDDMMYYYY(isoString);  // "15/01/2024"

// Report headers only (long format)
const reportDate = formatDateLong(new Date());   // "15 January 2024"

// For text inputs: Convert between formats
const isoDate = convertDDMMYYYYToISO('15/01/2024');  // "2024-01-15"
const displayDate = convertISOToDDMMYYYY('2024-01-15');  // "15/01/2024"

// Validate user input
const isValid = isValidDDMMYYYY('15/01/2024');  // true
```

### Date Input Fields
All date input fields use `<input type="text">` with dd/mm/yyyy format enforcement:
- Placeholder shows "dd/mm/yyyy"
- Validates format as user types
- Converts to ISO format for storage
- Displays in dd/mm/yyyy format
- This avoids browser-dependent date picker formatting

### Database Storage
- Prisma uses `DateTime` type → stored as ISO 8601 in PostgreSQL
- JavaScript/TypeScript uses `Date` objects or ISO strings internally
- Only convert to dd/mm/yyyy at display time

---

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

---

## MVP Scope

### In Scope
- [x] Home screen with test list
- [x] Test type selection (IVPLT, RVPLT, Lateral, Uplift)
- [x] Project details form
- [x] Data entry with timeline table
- [x] Add reading page with all fields
- [x] Phase tracking (loading/holding/unloading)
- [x] Report view with KPIs and chart
- [x] localStorage persistence
- [x] User profile for signatures
- [ ] PDF export (use window.print() for now)

### Out of Scope (Future)
- [ ] OCR extraction (archived in `_archive/`)
- [ ] Cloud database (Supabase)
- [ ] User authentication
- [ ] Multi-user roles
- [ ] Approval workflows
- [ ] Native mobile app

---

## Reference Files

| File | Use For |
|------|---------|
| `project_info_and_context/report.html` | Target UI design (SSOT for Report view) |
| `project_info_and_context/these-are-the-reports-to-automate/` | PDF output reference |
| `figma/Mobile App for Site Engineers/` | Figma export (gitignored) |
| `figma/Mobile App for Site Engineers/src/DESIGN_SYSTEM.md` | Color palette, typography |

---

## Error Handling

- Wrap async operations in try/catch
- Use browser's `confirm()` for destructive actions (delete)
- Auto-save to localStorage on every change
- Graceful hydration handling (show spinner until mounted)

```tsx
// Hydration pattern for client components
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) {
  return <LoadingSpinner />;
}
```

---

## Archived Code

The `src/_archive/` folder contains the original OCR-based workflow:

| Path | Contents |
|------|----------|
| `_archive/app/verify/` | OCR verification page |
| `_archive/app/report/` | Old report page |
| `_archive/components/upload/` | Dropzone, test-type-select |
| `_archive/components/verify/` | OCR table, confidence cells |
| `_archive/components/report/` | Old report components |
| `_archive/lib/ocr-api.ts` | OCR API integration |
| `_archive/lib/calculations/` | Old calculation helpers |
| `_archive/lib/pdf/` | Playwright PDF generation |

This code is excluded from TypeScript compilation via `tsconfig.json`.

## Active Technologies
- TypeScript 5+, Node.js 18+ + Next.js 14 (App Router), Zustand 4+, Chart.js 4+, Playwright (PDF), Prisma ORM (001-ivplt-report-automation)
- Supabase PostgreSQL + Supabase Storage (images/certificates) (001-ivplt-report-automation)
- @openai/agents SDK for AI-generated conclusions (Phase 5 - 001-ivplt-report-automation)

## Recent Changes
- 001-ivplt-report-automation: Added TypeScript 5+, Node.js 18+ + Next.js 14 (App Router), Zustand 4+, Chart.js 4+, Playwright (PDF), Prisma ORM
