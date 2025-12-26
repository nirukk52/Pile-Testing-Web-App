# Implementation Plan: Auto Report Pipeline

**Branch**: `002-auto-report-pipeline` | **Date**: 2024-12-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-auto-report-pipeline/spec.md`

---

## Summary

Build an agentic pipeline that ingests pile load test data from the **"Upload PDF" button** (existing in `project-details.tsx`), extracts project info and readings using AI, **auto-fills existing forms**, generates IS 2911-compliant reports, verifies them, auto-corrects issues, and presents for user approval.

**Key Decision**: Extend existing UI rather than rebuild. The "Upload PDF" button becomes the universal ingestion entry point.

---

## Technical Context

**Language/Version**: TypeScript 5+, Node.js 18+  
**Primary Dependencies**: Next.js 14 (App Router), Zustand, Chart.js, Playwright (PDF), OpenAI SDK, `xlsx`  
**Storage**: Supabase PostgreSQL + Supabase Storage (files)  
**Testing**: Playwright E2E (user-facing behavior only)  
**Target Platform**: Mobile-first web (PWA-ready)  
**Project Type**: Web application (Next.js full-stack)  
**Performance Goals**: Extraction < 15s, Report generation < 20s, 50 concurrent users  
**Constraints**: Vision API latency ~5-10s per image, max 3 correction loops, user approval required  
**Scale/Scope**: IVPLT only (MVP), ~500 reports/month initially

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Mobile-First | ✅ PASS | Using existing mobile-optimized components |
| II. IS 2911 Compliance | ✅ PASS | Verification agent enforces IS 2911 rules |
| III. Data Integrity | ✅ PASS | Confidence scores, human review, audit trail |
| IV. Progressive Enhancement | ✅ PASS | Manual entry baseline, ingestion enhances |
| V. Extend, Don't Rebuild | ✅ PASS | Modifying existing "Upload PDF" button |

### Quality Gates Alignment

- [x] Calculations via `ivplt-engine.ts` (existing, verified)
- [x] Auto-correction only with >90% confidence
- [x] User approval ALWAYS required before finalizing
- [x] Source files attached for audit trail

**Gate Status**: ✅ PASS - Proceed to implementation

---

## Architecture: Entry Point Integration

### The "Upload PDF" Button

**Location**: `src/components/test/project-details.tsx` → Field Readings section

**Current behavior**: Upload PDF scans (reference only, stored in Supabase)

**New behavior**:
```
Upload File → Detect Type → Extract → Preview → "Apply to Form" → Auto-fill all tabs
                  │
                  ├── .xlsx/.csv → excel-parser.ts
                  ├── .pdf (text) → pdf-parser.ts  
                  ├── .pdf (scan) → vision-parser.ts (GPT-4V)
                  └── .jpg/.png   → vision-parser.ts (GPT-4V)
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         project-details.tsx                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Field Readings (Optional)                                         │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  [Upload PDF/Excel]  ← ENTRY POINT (modified)                │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   /api/ingest (POST)          │
                    │   - Upload to Supabase        │
                    │   - Detect file type          │
                    │   - Route to parser           │
                    │   - Return IngestionJob       │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Extraction Preview Modal    │
                    │   - Show ProjectInfo fields   │
                    │   - Show Readings table       │
                    │   - Highlight low confidence  │
                    │   - [Apply to Form] button    │
                    └───────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────┴───────────────────────────┐
        │                                                       │
        ▼                                                       ▼
┌───────────────────┐                               ┌───────────────────┐
│ project-details   │                               │ data-entry        │
│ Auto-fill fields: │                               │ Auto-add readings │
│ - pileId          │                               │ - All LoadEntry[] │
│ - client          │                               │ - With phases     │
│ - designLoad      │                               │ - Calculated load │
│ - ramArea, etc.   │                               └───────────────────┘
└───────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   report-view.tsx             │
                    │   + Verification Score Card   │
                    │   + Issues List (collapsible) │
                    │   + [Approve Report] button   │
                    └───────────────────────────────┘
```

---

## Project Structure

### Documentation (this feature)

```text
specs/002-auto-report-pipeline/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Technology decisions ✅
├── data-model.md        # Entity definitions ✅
├── quickstart.md        # Developer setup ✅
├── contracts/           # API contracts ✅
│   └── api.yaml
├── verifyer.md          # Verification agent spec
└── tasks.md             # Task breakdown ✅
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                    # Home (existing)
│   ├── test/
│   │   └── page.tsx                # Test workspace (existing)
│   └── api/
│       ├── ingest/                 # NEW: File upload & extraction
│       │   └── route.ts
│       ├── verify/                 # NEW: Verification endpoint
│       │   └── [testId]/
│       │       ├── route.ts
│       │       └── correct/
│       │           └── route.ts
│       └── tests/                  # Existing test CRUD
│           └── [testId]/
│
├── components/
│   ├── test/
│   │   ├── project-details.tsx    # MODIFY: Expand upload handler
│   │   ├── data-entry.tsx         # Existing (auto-fill target)
│   │   ├── report-view.tsx        # MODIFY: Add verification UI
│   │   └── extraction-preview.tsx # NEW: Preview modal
│   └── ui/
│       └── score-badge.tsx        # NEW: Pass/Warn/Fail badge
│
├── lib/
│   ├── parsers/                   # NEW: File parsers
│   │   ├── excel-parser.ts
│   │   ├── pdf-parser.ts
│   │   └── vision-parser.ts
│   ├── ai/
│   │   ├── extraction-agent.ts    # NEW: Routes to parsers
│   │   ├── verification-agent.ts  # NEW: Scores reports
│   │   └── correction-agent.ts    # NEW: Fixes issues
│   └── pdf/                       # Existing PDF generation
│
├── engines/                       # Existing from 001
│   └── ivplt-engine.ts            # Reuse for calculations
│
├── store/
│   └── test-store.ts              # MODIFY: Add ingestion state
│
└── types/
    └── index.ts                   # MODIFY: Add new types
```

**Structure Decision**: Extend existing Next.js App Router structure. New code in `/lib/parsers/` and `/lib/ai/`. UI changes in existing components.

---

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Vision API (GPT-4V) | Handwritten note extraction | Local OCR (Tesseract) has poor accuracy |
| Extraction Preview Modal | User reviews before auto-fill | Direct auto-fill could corrupt good data |
| Verification Agent | Auto-QA for compliance | Manual review doesn't scale |

---

## Phase 0 Research Summary

See [research.md](./research.md) for detailed findings.

| Component | Decision | Risk |
|-----------|----------|------|
| Excel Parsing | `xlsx` npm package | Low |
| PDF Text | `pdf-parse` | Low |
| PDF Scans | GPT-4V (primary), Claude Vision (fallback) | Low |
| Verification | Server-side API route | Low |
| Correction | Rule-based + LLM hybrid | Medium |
| Orchestrator | Zustand state machine | Low |
| File Storage | Supabase Storage | Low |

---

## Phase 1 Design Summary

See [data-model.md](./data-model.md) and [contracts/api.yaml](./contracts/api.yaml).

### New Entities

1. **IngestionJob**: Tracks file upload → extraction process
2. **VerificationReport**: Output of verification (score 0-100, issues)
3. **CorrectionLog**: Audit trail for auto-corrections

### Extended Entities

- **SavedTest**: Added `sourceFile`, `verificationStatus`, `verificationScore`, `approvedAt`

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingest` | POST | Upload file, start extraction |
| `/api/ingest/{id}` | GET | Get extraction status |
| `/api/ingest/{id}/confirm` | POST | Apply extracted data to test |
| `/api/verify/{testId}` | POST | Run verification |
| `/api/verify/{testId}/correct` | POST | Apply corrections |
| `/api/tests/{testId}/approve` | POST | Mark as approved |

---

## Implementation Phases

### Phase 1: Setup (T001-T003)
- Install dependencies: `xlsx`, `pdf-parse`, `openai`
- Add types to `src/types/index.ts`

### Phase 2: Foundation (T004-T007)
- Create `excel-parser.ts`
- Create `extraction-agent.ts`
- Create `verification-agent.ts`

### Phase 3: MVP - Excel + Verification (T008-T019)
- Modify "Upload PDF" handler in `project-details.tsx`
- Create extraction preview modal
- Wire extraction → store auto-fill
- Add verification score to `report-view.tsx`
- Add "Approve Report" button

### Phase 4-8: Enhanced Features
- Vision AI for PDF scans
- Auto-correction pipeline
- IS 2911 compliance checks
- Legacy PDF re-verification

---

## Next Steps

1. ✅ Plan complete
2. → Run `/speckit.tasks` to verify task breakdown
3. → Start implementation with T001-T003 (Setup)

---

## Key Constraints (from Constitution)

- **IS 2911 Compliance**: All calculations via `ivplt-engine.ts`
- **User Approval**: ALWAYS required before finalizing
- **Auto-Correction**: Only with >90% confidence
- **Extend, Don't Rebuild**: Use existing UI components
- **Mobile-First**: 44px touch targets, 16px fonts
