# PileTest Pro

> Mobile-first pile load test data entry and IS 2911-compliant report generation.

---

## Problem Statement

The current pile load testing workflow is **manual, slow, and error-prone**:

| Pain Point | Impact |
|------------|--------|
| Handwritten field readings | Difficult to track, no backup |
| Excel-based calculations | Formula mistakes, no audit trail |
| Manual graph plotting | Inconsistent, time-consuming |
| Word/PDF report assembly | Hours of copy-paste work |
| No unified workflow | Delays between site, reviewer, manager |

**Result**: A single pile test report takes 4-8 hours to produce, with high risk of human error.

---

## Solution (MVP)

A **mobile-first web app** for site engineers to enter readings directly and generate professional reports:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   🏠 HOME       │ ──▶ │   📋 DETAILS    │ ──▶ │   ✏️ DATA ENTRY │ ──▶ │   📊 REPORT     │
│                 │     │                 │     │                 │     │                 │
│ Test list       │     │ Project info    │     │ Add readings    │     │ KPIs, chart,    │
│ + New Test      │     │ Pile specs      │     │ Timeline view   │     │ PDF export      │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Key Change**: Manual data entry instead of OCR. Engineers enter readings directly on-site using their mobile devices. OCR workflow is archived for future use.

---

## Screens

### Screen 1: Home
**Purpose**: View all tests and start new ones

- List of recent pile tests with metadata
- "Start New Pile Test" button
- Test type selection modal (IVPLT, RVPLT, Lateral, Uplift)
- User profile for signatures

### Screen 2: Details (Tab 1)
**Purpose**: Enter project info and pile specifications

- **Project Information**: Report No, Project Name, Location, Contractor, Client
- **Test Specifications**: LC of Dial Gauge, Design Load, Mixed Design, Pile Diameter, Ram Area, Date of Casting, Pile Depth
- Auto-save to localStorage

### Screen 3: Data Entry (Tab 2)
**Purpose**: Record load test readings in real-time

- **Timeline Table View**: All readings with phase headers (Loading/Holding/Unloading)
- **Add Reading Page**: Full-screen form for each reading
  - Date & Time (auto-filled)
  - Pressure gauge reading (kg/cm²)
  - 4 dial gauge readings (mm)
  - Phase selection (Loading/Holding/Unloading)
  - Remark (optional)
  - Signature confirmation
- **Auto-calculations**: Load (MT) from pressure, Average settlement from gauges
- Insert readings between existing entries
- Edit/Delete existing readings

### Screen 4: Report (Tab 3)
**Purpose**: View the final professional report and export

**Components:**
- **Header**: Test Type, Report ID, Location, Date
- **KPI Cards**: Test Load, Max Settlement, Net Settlement, Pass/Fail Status
- **Interactive Chart**: Load vs. Settlement curve
- **Specifications Panel**: Pile diameter, depth, grade, method, ram area
- **Data Table**: Complete load increment summary
- **Export**: Print/Download as PDF

---

## Supported Test Types

| Test Type | Code | Standard | Key Metrics |
|-----------|------|----------|-------------|
| Initial Vertical | IVPLT | IS 2911 Part 4 | Settlement at 2.5x design load |
| Routine Vertical | RVPLT | IS 2911 Part 4 | Settlement at 1.5x design load |
| Lateral | Lateral | IS 2911 Part 4 | Lateral deflection |
| Uplift / Pullout | Uplift | IS 2911 Part 4 | Uplift displacement |

---

## Data Model

```typescript
interface ProjectInfo {
  reportNo: string;
  project: string;
  location: string;
  contractor: string;
  client: string;
  lcOfDialGauge: string;
  designLoadOnPile: string;
  mixedDesign: string;
  pileDiameter: string;
  ramArea: string;
  dateOfCasting: string;
  pileDepth: string;
  testType: 'IVPLT' | 'RVPLT' | 'Lateral' | 'Uplift' | null;
}

interface Reading {
  id: string;
  pressureGauge: string;
  load: string;                    // Calculated: pressure × ramArea / 1000
  dialGauge1: string;
  dialGauge2: string;
  dialGauge3: string;
  dialGauge4: string;
  timestamp: string;
  signature?: string;
  remark?: string;
  phase: 'loading' | 'holding' | 'unloading';
}

interface LoadEntry {
  id: string;
  pressureGauge: string;
  load: string;
  readings: Reading[];
  timestamp: string;
}

interface SavedTest {
  id: string;
  projectInfo: ProjectInfo;
  loadEntries: LoadEntry[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Tech Stack (MVP)

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | Next.js 14 (App Router) | React framework with file-based routing |
| Language | TypeScript | Type safety throughout |
| Styling | Tailwind CSS | Utility-first CSS, mobile-first |
| Charts | Chart.js + react-chartjs-2 | Simple, performant Load vs Settlement curves |
| State | Zustand + localStorage | Lightweight state with persistence |
| Icons | Lucide React | Consistent icon set |

**No backend required** - All data stored in localStorage for MVP.

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

### Pass/Fail Criteria (IS 2911)
- **Vertical Tests**: Net settlement ≤ 12mm at test load → PASS
- **Lateral Tests**: Deflection within limits per IS code → PASS

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home screen
│   └── test/
│       └── page.tsx            # Test workspace (tabs: Details/Entry/Report)
│
├── components/
│   ├── home/
│   │   ├── home-screen.tsx     # Test list + new test button
│   │   ├── test-type-modal.tsx # Test type selection
│   │   ├── profile-modal.tsx   # User profile/signature
│   │   └── index.ts
│   └── test/
│       ├── project-details.tsx # Project info form
│       ├── data-entry.tsx      # Readings table view
│       ├── add-reading-page.tsx# Full-page reading form
│       ├── report-view.tsx     # Report dashboard
│       └── index.ts
│
├── store/
│   └── test-store.ts           # Zustand store with localStorage
│
├── types/
│   └── index.ts                # TypeScript interfaces + helpers
│
├── lib/
│   └── utils.ts                # General utilities (cn, etc.)
│
├── styles/
│   └── globals.css             # Tailwind + custom styles
│
└── _archive/                   # Archived OCR workflow (for future use)
    ├── app/                    # Old verify, report pages
    ├── components/             # Old upload, verify, report components
    └── lib/                    # OCR API, calculations, PDF generation
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
| `report.html` | Reference interactive dashboard design (SSOT) |
| `these-are-the-reports-to-automate/` | Target PDF reports to replicate |
| `toaz.info-is-2911...pdf` | IS 2911 Part 4 standard reference |
| `Pile Load Test.pptx` | Domain knowledge presentation |

Design files in `figma/` (gitignored):
| File | Purpose |
|------|---------|
| `Mobile App for Site Engineers/` | Figma export with UI components |

---

## Roadmap

- [x] **Phase 1 (Current)**: Manual data entry MVP
  - [x] Home screen with test list
  - [x] Test type selection
  - [x] Project details form
  - [x] Data entry with readings table
  - [x] Report view with KPIs and chart
  - [x] localStorage persistence
  - [ ] PDF export
- [ ] **Phase 2**: OCR Integration (archived code ready)
- [ ] **Phase 3**: Supabase backend for cloud persistence
- [ ] **Phase 4**: Multi-user roles (Site Engineer, Reviewer, Manager)
- [ ] **Phase 5**: Mobile app (React Native / PWA)

---

## License

Private - ZedGeo Engineering Solutions

<!-- Ranchordas#1995 -->
