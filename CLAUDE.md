# CLAUDE.md - PileTest Pro

> AI coding assistant instructions for this project.

---

## Project Overview

**PileTest Pro** is a mobile-first web app for site engineers to record pile load test readings and generate IS 2911-compliant reports.

**Current Phase**: **Intelligent Ingestion & Verification**
We are expanding from manual entry to automated data ingestion from various file formats (PDF, Excel, Word) and implementing an AI-powered verification agent to ensure report accuracy.

### Core Flow
```
Landing Page → Select/Upload Data (PDF/Excel/Manual) → Automated Extraction → Review/Edit → Generate Report → AI Verification → Export PDF
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 14+ (App Router) | React framework with file-based routing |
| Language | TypeScript | 5+ | Type safety throughout |
| Styling | Tailwind CSS | 3.4+ | Utility-first CSS, mobile-first design |
| Charts | Chart.js + react-chartjs-2 | 4+ | Load vs Settlement curves |
| State | Zustand | 4+ | Client state management |
| Persistence | localStorage / Supabase | - | Browser storage (MVP) / Cloud (Future) |
| Icons | Lucide React | latest | Consistent icon set |
| Agents | OpenAI / Anthropic SDKs | - | Data extraction and verification agents |

### Why These Choices

- **Zustand + localStorage**: Simple persistence for offline-first capability.
- **AI Agents**: To handle unstructured data ingestion (field notes, legacy reports) and automated QA.
- **Mobile-first**: Site engineers use phones in the field.

---

## Project Structure

```
src/
├── app/
│ ├── layout.tsx # Root layout
│ ├── page.tsx # Landing Page (New)
│ ├── home/
│ │ └── page.tsx # Dashboard (Test List)
│ └── test/
│ └── page.tsx # Test workspace with tab navigation
│
├── components/
│ ├── landing/ # Landing page components
│ ├── ingestion/ # File upload & extraction UI
│ ├── verification/ # AI Verification results UI
│ ├── home/
│ │ ├── home-screen.tsx # Test list + "Start New Test" button
│ │ ├── test-type-modal.tsx # IVPLT/RVPLT/Lateral/Uplift selection
│ │ ├── profile-modal.tsx # User profile for signatures
│ │ └── index.ts
│ └── test/
│ ├── project-details.tsx # Project info + pile specs form
│ ├── data-entry.tsx # Timeline table of readings
│ ├── add-reading-page.tsx# Full-page form for single reading
│ ├── report-view.tsx # KPIs, chart, specs, data table
│ └── index.ts
│
├── store/
│ └── test-store.ts # Zustand store
│
├── types/
│ └── index.ts # TypeScript interfaces + calculation helpers
│
├── lib/
│ ├── utils.ts # General utilities (cn, etc.)
│ ├── ai/
│ │ ├── extraction-agent.ts # Agent for parsing uploaded files
│ │ ├── verification-agent.ts # Agent for verifying PDF reports
│ │ └── index.ts
│ └── pdf/
│ ├── generator.ts # Playwright PDF generation
│ └── templates/ # HTML templates for PDF
│
├── styles/
│ └── globals.css # Tailwind directives + custom styles
│
└── _archive/ # Archived OCR workflow
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
Every class, enum, interface, and exported function MUST have a comment explaining **why it exists**.

### State Management
- Use **Zustand** for global app state
- Store persists to localStorage automatically
- Key store shape:

```tsx
interface TestState {
 // Navigation
 view: 'landing' | 'home' | 'test';
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

---

## Timezone Convention (CRITICAL)

**All times are in IST (Indian Standard Time / Asia/Kolkata)**

- All projects are in India
- Field sheets are written in IST
- All date/time displays MUST use `timeZone: 'Asia/Kolkata'`
- Supabase stores timestamps in UTC, but display layer converts to IST
- Training data `expected.json` uses IST times (e.g., "11:29" not "05:59")

```typescript
// CORRECT - Always use IST for display
date.toLocaleTimeString('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',  // IST
});

// WRONG - Don't use local timezone or UTC
date.toLocaleTimeString('en-US', { ... }); // Uses browser timezone
```

---

## UI/UX Guidelines

### Design System
- Mobile-first approach (site engineers use phones)
- Follow the Figma design in `figma/Mobile App for Site Engineers/`
- Color palette (from `DESIGN_SYSTEM.md`):
 ```css
 --primary: #2563eb; /* Blue - actions, active tabs */
 --success: #10b981; /* Green - pass status, unloading */
 --warning: #f59e0b; /* Amber - holding phase */
 --destructive: #ef4444; /* Red - fail status, delete */
 --slate-800: #1e293b; /* Midnight Slate - headers */
 ```

---

## Roadmap

- [x] **Phase 1**: Manual data entry MVP
- [ ] **Phase 2**: Intelligent Ingestion & Verification
  - [ ] Universal File Upload (PDF/Excel/Word/Images)
  - [ ] AI Extraction Agent
  - [ ] AI Verification Agent (Report vs Data)
  - [ ] Landing Page
- [ ] **Phase 2.5**: Vision Training Pipeline (003-vision-training-pipeline)
  - [ ] Handwritten field sheet → Vision API extraction
  - [ ] Eval framework (80% accuracy target)
  - [ ] Report generation comparison
  - [ ] Iterative improvement loop
- [ ] **Phase 3**: Cloud Database & Auth (Supabase)
- [ ] **Phase 4**: Advanced Geotech Agents (Foundation Sizing, Seismic)

---

## Training & Eval System

### Training Data Structure
```
training-data/
  report-001/
    field-sheet/    # Handwritten PDFs (input)
    og-report/      # Verified reports (reference)
    expected.json   # Ground truth from Supabase
```

### Eval Commands
```bash
npm run eval:pull report-001    # Pull expected.json from Supabase
npm run eval:extract report-001 # Run Vision extraction + compare
npm run eval:all                # Run all evals
```

### Target: 80% extraction accuracy before moving to report generation

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

## Active Technologies
- TypeScript 5+, Node.js 18+ + Next.js 14 (App Router), Zustand, Chart.js, Playwright (PDF), OpenAI SDK / Anthropic SDK (002-auto-report-pipeline)
- Supabase PostgreSQL + Supabase Storage (files) (002-auto-report-pipeline)
- TypeScript 5+, Node.js 18+ + Next.js 14 (App Router), Zustand, Chart.js, Playwright (PDF), OpenAI SDK, `xlsx` (002-auto-report-pipeline)

## Recent Changes
- 002-auto-report-pipeline: Added TypeScript 5+, Node.js 18+ + Next.js 14 (App Router), Zustand, Chart.js, Playwright (PDF), OpenAI SDK / Anthropic SDK
