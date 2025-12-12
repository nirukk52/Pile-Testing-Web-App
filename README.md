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

<!-- {
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp",
        "--api-key",
        "<YOUR_CONTEXT7_API_KEY>"
      ]
    },
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer <YOUR_GITHUB_PAT>"
      }
    },
    "graphiti": {
      "transport": "sse",
      "url": "https://graphiti-mcp.fly.dev/sse"
    },
    "sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    },
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    },
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=cfmywntdiygatvagqucn",
      "headers": {}
    },
    "Figma": {
      "url": "https://mcp.figma.com/mcp",
      "headers": {}
    },
    "Better Auth": {
      "url": "https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp",
      "headers": {}
    },
    "vercel": {
      "url": "https://mcp.vercel.com",
      "headers": {}
    },
    "aws-knowledge-mcp": {
      "url": "https://knowledge-mcp.global.api.aws",
      "headers": {}
    },
    "awslabs.aws-api-mcp-server": {
      "command": "uvx awslabs.aws-api-mcp-server@latest",
      "env": {
        "AWS_REGION": "us-east-1"
      },
      "disabled": false,
      "autoApprove": [],
      "args": []
    },
    "kite": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8080/mcp",
        "--allow-http"
      ]
    },
    "Docs by LangChain": {
      "name": "Docs by LangChain",
      "url": "https://docs.langchain.com/mcp",
      "headers": {}
    },
    "BrowserStack": {
      "command": "npx -y @browserstack/mcp-server@latest",
      "env": {
        "BROWSERSTACK_USERNAME": "<username>",
        "BROWSERSTACK_ACCESS_KEY": "<access_key>"
      },
      "args": []
    },
    "Prisma-Remote": {
      "command": "npx -y mcp-remote https://mcp.prisma.io/mcp",
      "env": {},
      "args": []
    }
  }
} -->

✅ A. Major Test Types (IS 2911 – Part 4)

These are the primary ones used in every Indian foundation project.

1. Initial Vertical Load Test (IVPLT)

Purpose: Determine ultimate load capacity and derive safe load.
Test Load: 2.5× design load.

2. Routine Vertical Load Test (RVPLT)

Purpose: Verify working load performance.
Test Load: 1.5× design load.

3. Lateral Load Test (Initial / Routine)

Purpose: Determine pile’s ability to resist horizontal loads.
Acceptance: 5 mm deflection limit typically used.
Loads: Usually go up to design lateral load or 1.5× depending on spec.

4. Uplift / Pullout Load Test (Initial / Routine)

Purpose: Determine tensile capacity.
Acceptance: Uplift at design load within limits (12 mm or 2% dia).

These four are the ones your existing reports cover.

✅ B. Variants / Modes Used in IS 2911 & Common Indian Practice
5. Cyclic Vertical Load Test

Purpose: Determine elastic rebound, settlement behaviour under repeated load cycles.
Not always required, but many major contractors include it.

6. Cyclic Lateral Load Test

Less common, but used for transmission line foundations, jetties, offshore works.

7. Constant Rate of Penetration Test (CRP / CRPT)

Purpose: Directly determine ultimate bearing capacity by pushing pile at constant rate.
More common in offshore or research settings than typical building projects.

8. Maintained Load Test (MLT)

This is actually the default method for IVPLT/RVPLT — apply load in increments and keep it “maintained” until the movement stabilizes.

| **Test Type**                                      | **Purpose**                                      | **Do we need to support it? (Client selects)** | **Notes (1-line)**                  |
| -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- | ----------------------------------- |
| **IVPLT – Initial Vertical Load Test**             | Determine ultimate capacity                      | YES / NO                                       | Standard for new projects           |
| **RVPLT – Routine Vertical Load Test**             | Prove working load capacity                      | YES / NO                                       | Most common on site                 |
| **Lateral Load Test**                              | Horizontal stability check                       | YES / NO                                       | 5 mm deflection limit typical       |
| **Uplift / Pullout Test**                          | Tensile capacity                                 | YES / NO                                       | For tanks, towers, bridges          |
| **Cyclic Vertical Load Test**                      | Settlement + rebound behaviour                   | YES / NO                                       | Rare but used on bigger infra jobs  |
| **Cyclic Lateral Load Test**                       | Lateral stiffness behaviour                      | YES / NO                                       | Very rare unless specified          |
| **CRP / CRPT – Constant Rate of Penetration Test** | Direct ultimate capacity by pushing continuously | YES / NO                                       | Not used in normal IS 2911 projects |
| **Dynamic Load Test (PDA)**                        | Capacity via hammer impact waves                 | YES / NO                                       | Offshore / driven piles             |
| **Low-Strain PIT / Sonic Echo**                    | Pile integrity (not load)                        | YES / NO                                       | QA/QC only, no load curves          |
| **Crosshole Sonic Logging (CSL)**                  | Concrete quality                                 | YES / NO                                       | For bored piles >800 mm             |
| **Osterberg Cell Test (O-Cell)**                   | Large diameter piles, up/down loading            | YES / NO                                       | Metro/bridge megaprojects           |
