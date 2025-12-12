# Implementation Plan: IVPLT Report Automation

**Branch**: `001-ivplt-report-automation` | **Date**: 2025-12-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ivplt-report-automation/spec.md`

## Summary

Automate IVPLT (Initial Vertical Pile Load Test) report generation per IS 2911 (Part 4) - 2013. The system captures project details, pile specifications, and test readings via mobile-first UI, calculates safe load per IS 2911 criteria, and generates professional 15-20 page PDF reports with embedded charts, site images, and calibration certificates.

**Key Architecture Decision**: Introduce **Test Type Engine** abstraction to enable future test types (RVPLT, Lateral, Uplift) without refactoring existing code.

## Technical Context

**Language/Version**: TypeScript 5+, Node.js 18+  
**Primary Dependencies**: Next.js 14 (App Router), Zustand 4+, Chart.js 4+, Playwright (PDF), Prisma ORM  
**Storage**: Supabase PostgreSQL + Supabase Storage (images/certificates)  
**Testing**: Vitest + React Testing Library (user-facing behavior only)  
**Target Platform**: Mobile-first web (PWA-ready), iOS Safari / Android Chrome  
**Project Type**: Web application (Next.js full-stack)  
**Performance Goals**: PDF generation < 30s, Image upload < 5s per image  
**Constraints**: Offline-tolerant data entry (sync when online), max 15MB PDF output  
**Scale/Scope**: Single user per test, ~20 readings per test, 5 images, 4 certificates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Simplicity | ✅ PASS | Test Type Engine is minimal abstraction for extensibility |
| Mobile-First | ✅ PASS | All UI components designed for mobile |
| IS 2911 Compliance | ✅ PASS | Calculations follow standard formulas |
| No Over-Engineering | ✅ PASS | Only building IVPLT now, engine enables future types |

## Architecture Module: Test Type Engine

### Purpose

Decouple test-type-specific logic from UI and data layers. Each test type has different:
- Input requirements
- Calculation formulas  
- Acceptance criteria
- Graph configurations
- Report section wording
- AI conclusion prompts

### Interface Design

```typescript
/**
 * Parent interface for all pile load test type engines.
 * Why: Enables polymorphic handling of different test types without conditional logic.
 */
interface ITestEngine {
  /** Unique identifier for this test type */
  readonly testType: TestType;
  
  /** Human-readable name for UI display */
  readonly displayName: string;
  
  /** Test load multiplier (e.g., 2.5 for IVPLT, 1.5 for RVPLT) */
  readonly testLoadMultiplier: number;

  /** Calculate all derived values from readings and project metadata */
  calculate(readings: Reading[], meta: TestMeta): CalculationResult;

  /** Get acceptance criteria for this test type per IS 2911 */
  getAcceptanceCriteria(meta: TestMeta): AcceptanceCriteria;

  /** Get chart configuration (axes, colors, annotations) */
  getGraphConfig(): GraphConfig;

  /** Get report sections with standard IS 2911 wording */
  getReportSections(data: ReportData): ReportSection[];

  /** Get AI prompt template for conclusion generation */
  getAIConclusionPrompt(result: CalculationResult): string;

  /** Get KPI definitions for dashboard display */
  getKPIConfig(): KPIConfig[];

  /** Validate readings before submission */
  validateReading(reading: Partial<Reading>): ValidationResult;
}
```

### Concrete Implementations

| Engine | Test Type | Test Load | Settlement Limit | Graph Type |
|--------|-----------|-----------|------------------|------------|
| `IvpltEngine` | IVPLT | 2.5× design | 12mm | Load vs Settlement |
| `RvpltEngine` | RVPLT | 1.5× design | 18mm | Load vs Settlement |
| `LateralEngine` | Lateral | 2.5× design | 5mm deflection | Load vs Deflection |
| `UpliftEngine` | Uplift | 2.5× design | 12mm uplift | Load vs Uplift |

### Engine Factory

```typescript
/**
 * Factory to get the appropriate engine based on test type.
 * Why: Single point of engine instantiation, UI doesn't need to know concrete classes.
 */
function getTestEngine(testType: TestType): ITestEngine {
  const engines: Record<TestType, ITestEngine> = {
    IVPLT: new IvpltEngine(),
    RVPLT: new RvpltEngine(),
    Lateral: new LateralEngine(),
    Uplift: new UpliftEngine(),
  };
  return engines[testType];
}
```

### Usage Flow

```
1. User selects test type in TestTypeModal → testType stored
2. UI calls getTestEngine(testType) → gets IvpltEngine
3. ProjectDetails uses engine.getAcceptanceCriteria() for display
4. DataEntry uses engine.validateReading() before save
5. ReportView uses engine.calculate() for KPIs
6. ReportView uses engine.getGraphConfig() for chart
7. PDF generation uses engine.getReportSections() for content
8. AI conclusion uses engine.getAIConclusionPrompt()
```

## Project Structure

### Documentation (this feature)

```text
specs/001-ivplt-report-automation/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Prisma schema + TypeScript types
├── quickstart.md        # Phase 1: Developer setup guide
├── contracts/           # Phase 1: API contracts
│   └── api.yaml         # OpenAPI spec for internal APIs
└── checklists/
    └── requirements.md  # Spec validation checklist
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Home screen
│   ├── test/
│   │   └── page.tsx                # Test workspace
│   └── api/
│       ├── tests/                  # CRUD for tests
│       ├── readings/               # CRUD for readings
│       ├── upload/                 # Image/certificate uploads
│       └── pdf/                    # PDF generation endpoint
│
├── components/
│   ├── home/                       # Home screen components
│   └── test/
│       ├── project-details.tsx     # Extended with new fields
│       ├── data-entry.tsx          # Timeline table
│       ├── add-reading-page.tsx    # Full-page reading form
│       ├── report-view.tsx         # KPIs, chart, specs
│       ├── site-images.tsx         # NEW: Image upload gallery
│       └── certificates.tsx        # NEW: Certificate manager
│
├── engines/                        # NEW: Test Type Engine
│   ├── types.ts                    # ITestEngine interface
│   ├── factory.ts                  # getTestEngine()
│   ├── ivplt-engine.ts             # IvpltEngine implementation
│   ├── rvplt-engine.ts             # Stub for future
│   ├── lateral-engine.ts           # Stub for future
│   └── uplift-engine.ts            # Stub for future
│
├── lib/
│   ├── utils.ts
│   ├── supabase.ts                 # NEW: Supabase client
│   ├── calculations.ts             # NEW: Shared calc utilities
│   └── pdf/
│       ├── generator.ts            # Playwright PDF logic
│       └── templates/
│           └── ivplt-template.tsx  # HTML template for IVPLT
│
├── store/
│   └── test-store.ts               # Updated with new fields
│
├── types/
│   └── index.ts                    # Updated domain types
│
└── styles/
    └── globals.css

prisma/
├── schema.prisma                   # NEW: Database schema
└── migrations/                     # Auto-generated

supabase/
└── storage-policies.sql            # NEW: RLS policies for buckets
```

**Structure Decision**: Next.js App Router with new `/engines/` folder for Test Type Engine pattern. All test-type-specific logic lives in engines, keeping components generic.

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Test Type Engine | Future extensibility for RVPLT/Lateral/Uplift | Hardcoding IVPLT would require refactoring entire codebase later |
| Supabase Storage | Cloud persistence for images/certs | localStorage can't handle binary files reliably |
| Playwright PDF | Need actual rendered charts in PDF | window.print() doesn't capture Chart.js canvas |

## Implementation Phases

### Phase 1: Foundation (Engine + Schema)
- [ ] Create Test Type Engine interface and IvpltEngine
- [ ] Set up Prisma schema with Supabase
- [ ] Update TypeScript types in `src/types/`
- [ ] Create Supabase client and storage buckets

### Phase 2: Data Entry Enhancements
- [ ] Extend project-details.tsx with new fields
- [ ] Add gauge enable/disable toggles to add-reading-page.tsx
- [ ] Add visual indicator for faulty gauges
- [ ] Integrate engine.validateReading()

### Phase 3: Image & Certificate Management
- [ ] Create site-images.tsx component
- [ ] Create certificates.tsx component
- [ ] Set up Supabase Storage upload API
- [ ] Add drag-drop reordering for images

### Phase 4: Report Generation
- [ ] Update report-view.tsx with engine.calculate()
- [ ] Create IVPLT PDF template
- [ ] Implement Chart.js to image conversion
- [ ] Integrate PDF merging for certificates
- [ ] Test end-to-end PDF generation

### Phase 5: AI Conclusion
- [ ] Create AI conclusion API endpoint
- [ ] Integrate engine.getAIConclusionPrompt()
- [ ] Add edit/override UI for conclusion
- [ ] Connect to OpenAI/Anthropic API

## Key IS 2911 Formulas (IvpltEngine)

```typescript
// Load from pressure (FR-003)
load = (pressure × ramArea) / 1000  // MT

// Average settlement with faulty gauge handling (FR-004)
avgSettlement = sum(enabledGauges) / count(enabledGauges)

// Safe Load Criterion A: Settlement Limit (FR-012)
// Find load at 12mm settlement via linear interpolation
safeLoadA = (2/3) × loadAt12mm

// Safe Load Criterion B: Ultimate Capacity (FR-012)
// Find load at 10% pile diameter settlement
safeLoadB = 0.5 × loadAt10PercentDia

// Final Safe Load
safeLoadFinal = min(safeLoadA, safeLoadB)

// Pass/Fail (FR-011)
passed = netSettlement <= min(12mm, 2% × pileDiameter)
```

## Next Steps

1. Run `/speckit.tasks` to break this plan into actionable tasks
2. Review `research.md` for technology decisions
3. Review `data-model.md` for Prisma schema
4. Start implementation with Phase 1
