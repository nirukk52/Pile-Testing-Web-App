# Tasks: Auto Report Pipeline

**Input**: Design documents from `/specs/002-auto-report-pipeline/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.yaml ✅, quickstart.md ✅

**Tests**: User-facing behavior tests only (per project rules). No petty unit tests.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5, US6)
- Include exact file paths in descriptions

## Path Conventions

- **Framework**: Next.js 14 (App Router)
- **Source**: `src/` at repository root
- **API Routes**: `src/app/api/`
- **Components**: `src/components/`
- **Libraries**: `src/lib/`

## Existing Assets (Already Built from 001-ivplt-report-automation)

✅ **UI Components** (working):
- `src/components/test/project-details.tsx` - Project info form + **"Upload PDF" button** (entry point!)
- `src/components/test/data-entry.tsx` - Readings timeline table
- `src/components/test/add-reading-page.tsx` - Add reading form
- `src/components/test/report-view.tsx` - KPIs, chart, data table

✅ **Pipeline** (working):
- Manual entry → Zustand store → Report generation → PDF export

✅ **Test Type Engine** (reusable):
- `src/engines/ivplt-engine.ts` - IVPLT calculations, validation, acceptance criteria
- `src/engines/factory.ts` - getTestEngine(testType)

**Entry Point**: The "Upload PDF" button in `project-details.tsx` Field Readings section

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and add new types

- [X] T001 Install new dependencies: `xlsx pdf-parse openai` via `npm install xlsx pdf-parse openai`
- [X] T002 [P] Add environment variables template for OPENAI_API_KEY in `.env.example`
- [X] T003 [P] Add new types to `src/types/index.ts`: IngestionJob, ExtractedReading, VerificationReport, VerificationIssue, CheckResult, CorrectionLog

**Checkpoint**: Dependencies installed, types ready for use

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create parsers and agents that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create Excel parser in `src/lib/parsers/excel-parser.ts` - Parse XLSX → ProjectInfo + LoadEntry[]
- [X] T005 [P] Create extraction agent in `src/lib/ai/extraction-agent.ts` - Routes files to correct parser
- [X] T006 [P] Create verification agent in `src/lib/ai/verification-agent.ts` - Scores reports (0-100)
- [X] T007 [P] Extend SavedTest type in `src/types/index.ts` with sourceFile, verificationStatus, verificationScore, approvedAt fields

**Checkpoint**: Foundation ready - parsers and agents available, user story implementation can begin

---

## Phase 3: User Story 1 - Excel Ingestion & Report Generation (Priority: P1) 🎯 MVP

**Goal**: User uploads Excel file via "Upload PDF" button → System extracts data → Auto-fills existing forms → Generates report → Verification shows score → User approves

**Independent Test**: Upload sample Excel file, verify ProjectInfo and Readings auto-populate in existing tabs, generate report, see verification score ≥ 90

### Implementation for User Story 1

- [X] T008 [US1] Create ingest API route in `src/app/api/ingest/route.ts` - Accepts file upload, returns IngestionJob
- [X] T009 [US1] Implement Excel → ProjectInfo + LoadEntry[] mapping in `src/lib/parsers/excel-parser.ts`
- [X] T010 [US1] Create ingest job status API route in `src/app/api/ingest/[jobId]/route.ts` - GET extraction status
- [X] T011 [US1] Create confirm extraction API route in `src/app/api/ingest/[jobId]/confirm/route.ts` - Creates test from extracted data
- [X] T012 [US1] Modify "Upload PDF" button handler in `src/components/test/project-details.tsx` to accept .xlsx files
- [X] T013 [US1] Add file type detection in `src/lib/ai/extraction-agent.ts` - Route .xlsx → excel-parser, .pdf → vision/pdf-parser
- [X] T014 [US1] Create extraction preview modal component in `src/components/test/extraction-preview-modal.tsx`
- [X] T015 [US1] Add confidence score display per field in `src/components/test/extraction-preview-modal.tsx`
- [X] T016 [US1] Add "Apply to Form" button in extraction preview modal - calls store actions
- [X] T017 [US1] Wire extraction to Zustand store in `src/store/test-store.ts` - updateProjectField(), addLoadEntry() for each reading
- [X] T018 [US1] Create verify API route in `src/app/api/verify/[testId]/route.ts` - POST runs verification, GET returns latest report
- [X] T019 [US1] Implement data integrity check in `src/lib/ai/verification-agent.ts` - Compare report values vs raw data
- [X] T020 [US1] Implement IS 2911 compliance check in `src/lib/ai/verification-agent.ts` - Settlement limits, test load ratios
- [X] T021 [US1] Add verification score badge component in `src/components/ui/score-badge.tsx` - Pass (green) / Warn (amber) / Fail (red)
- [X] T022 [US1] Add verification score card to `src/components/test/report-view.tsx` - Shows score + status badge
- [X] T023 [US1] Add collapsible issues list to `src/components/test/report-view.tsx` - Lists VerificationIssue[]
- [ ] T024 [US1] Create approve API route in `src/app/api/tests/[testId]/approve/route.ts` - Marks report as approved
- [ ] T025 [US1] Add "Approve Report" button to `src/components/test/report-view.tsx` - Enabled when score ≥ 90 AND user clicks

**Checkpoint**: User Story 1 complete - Excel upload → Auto-fill → Verified Report → Approve flow works end-to-end

---

## Phase 4: User Story 2 - PDF Scan Ingestion with Vision AI (Priority: P2)

**Goal**: User uploads scanned PDF/image → Vision AI extracts readings → User reviews low-confidence values → Proceeds to report generation

**Independent Test**: Upload scanned PDF, see Vision API extract values with confidence scores, correct a low-confidence field, confirm extraction

### Implementation for User Story 2

- [ ] T026 [US2] Create vision parser in `src/lib/parsers/vision-parser.ts` - GPT-4V extraction with structured output
- [ ] T027 [US2] Add domain context prompt in `src/lib/parsers/vision-parser.ts` - Loading/unloading phases, 24hr cycle, pressure patterns
- [ ] T028 [US2] Extend extraction-agent to route .pdf (scanned) and .jpg/.png → vision-parser in `src/lib/ai/extraction-agent.ts`
- [ ] T029 [US2] Add PDF text detection in `src/lib/parsers/pdf-parser.ts` - Detect if PDF is text-based or scanned
- [ ] T030 [US2] Highlight low-confidence fields (<80%) with amber border in `src/components/test/extraction-preview-modal.tsx`
- [ ] T031 [US2] Add inline edit capability for low-confidence fields in `src/components/test/extraction-preview-modal.tsx`

**Checkpoint**: User Story 2 complete - Scanned PDFs/images extract via Vision AI with confidence highlighting

---

## Phase 5: User Story 3 - Auto-Correction of Data Errors (Priority: P2)

**Goal**: Verification agent detects data mismatch (e.g., 52mm vs 5.2mm) → System suggests correction → Auto-applies if high confidence → Re-verifies

**Independent Test**: Inject known error, run verification, see correction suggested, apply correction, verify score improves

### Implementation for User Story 3

- [ ] T032 [US3] Create correction agent in `src/lib/ai/correction-agent.ts` - Rule-based + LLM hybrid
- [ ] T033 [US3] Add decimal shift detection rule in `src/lib/ai/correction-agent.ts` - Detects 52 → 5.2 type errors
- [ ] T034 [US3] Add unit conversion detection rule in `src/lib/ai/correction-agent.ts` - Detects mm/cm confusion
- [ ] T035 [US3] Create correct API route in `src/app/api/verify/[testId]/correct/route.ts` - Applies corrections, re-generates, re-verifies
- [ ] T036 [US3] Add correction loop logic in `src/lib/ai/correction-agent.ts` - Max 3 iterations, escalate if unresolved
- [ ] T037 [US3] Add "Suggested Corrections" panel in `src/components/test/report-view.tsx` - Shows CorrectionLog[] with Accept/Reject
- [ ] T038 [US3] Add "Apply Corrections" button in `src/components/test/report-view.tsx` - Auto-applies high-confidence (>90%) corrections

**Checkpoint**: User Story 3 complete - Auto-correction pipeline detects and fixes obvious errors

---

## Phase 6: User Story 4 - IS 2911 Compliance Interpretation (Priority: P3)

**Goal**: Verification agent checks PASS/FAIL conclusion against IS 2911 rules → Flags borderline cases for human review

**Independent Test**: Create test with 12.1mm net settlement, verify agent flags as "warning" (not auto-fail)

### Implementation for User Story 4

- [ ] T039 [US4] Add IS 2911 settlement limit rule in `src/lib/ai/verification-agent.ts` - ≤12mm OR ≤2% pile diameter
- [ ] T040 [US4] Add test load ratio check in `src/lib/ai/verification-agent.ts` - IVPLT = 2.5× design load
- [ ] T041 [US4] Add borderline handling logic in `src/lib/ai/verification-agent.ts` - 12.0-12.5mm → WARN, not auto-FAIL
- [ ] T042 [US4] Add domain heuristics in `src/lib/ai/verification-agent.ts` - Pressure should increase during loading phase

**Checkpoint**: User Story 4 complete - IS 2911 compliance checks integrated with borderline handling

---

## Phase 7: User Story 5 - Legacy PDF Report Re-Verification (Priority: P3)

**Goal**: User uploads existing PDF report → System extracts tables/values → Runs verification checks → Outputs scorecard

**Independent Test**: Upload legacy PDF report, verify system extracts data, see verification scorecard output

### Implementation for User Story 5

- [ ] T043 [US5] Create PDF table extractor in `src/lib/parsers/pdf-parser.ts` - Extract tables from text-based PDFs
- [ ] T044 [US5] Add "Re-verify existing report" option in `src/components/test/project-details.tsx` upload flow
- [ ] T045 [US5] Implement legacy PDF → verification flow (skip report generation) in `src/lib/ai/verification-agent.ts`

**Checkpoint**: User Story 5 complete - Legacy PDFs can be uploaded and verified

---

## Phase 8: User Story 6 - Report Formatting Corrections (Priority: P4)

**Goal**: Verification agent detects formatting issues (table overflow, missing graph) → Correction agent adjusts layout → Re-generates

**Independent Test**: Provide oversized data causing table overflow, verify agent flags and suggests layout adjustment

### Implementation for User Story 6

- [ ] T046 [US6] Add visual quality check in `src/lib/ai/verification-agent.ts` - Detect table overflow, missing graphs
- [ ] T047 [US6] Add layout adjustment logic in `src/lib/ai/correction-agent.ts` - Smaller font, page breaks for overflow

**Checkpoint**: User Story 6 complete - Formatting issues detected and corrected

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T048 [P] Add loading states during extraction and verification in `src/components/test/project-details.tsx`
- [ ] T049 [P] Add error handling for failed extractions in `src/lib/ai/extraction-agent.ts`
- [ ] T050 [P] Add toast notifications for success/error in `src/components/test/report-view.tsx`
- [ ] T051 Update CLAUDE.md with new file locations and patterns
- [ ] T052 [P] Update README.md with ingestion and verification features
- [ ] T053 Run quickstart.md validation - end-to-end test: Upload Excel → Extract → Generate → Verify → Approve

**Checkpoint**: Application polished and ready for production

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup: 3 tasks) ─────────────────────────────────────────────┐
                                                                       │
Phase 2 (Foundational: 4 tasks) ◄─────────────────────────────────────┘
    │
    │ BLOCKS ALL USER STORIES
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Phase 3 (US1: Excel + Verify) ────────► MVP DEMO READY                 │
│         │                                                               │
│         ▼                                                               │
│  Phase 4 (US2: Vision AI) ◄──────────── Can start after US1 or in ║    │
│         │                                                               │
│         ▼                                                               │
│  Phase 5 (US3: Auto-Correction) ◄────── Depends on US1 verification    │
│         │                                                               │
│         ▼                                                               │
│  Phase 6 (US4: IS 2911 Rules) ◄──────── Extends US1 verification       │
│         │                                                               │
│         ▼                                                               │
│  Phase 7 (US5: Legacy PDF) ◄─────────── Uses US4 verification          │
│         │                                                               │
│         ▼                                                               │
│  Phase 8 (US6: Formatting) ◄─────────── Uses US3 correction agent      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        Phase 9 (Polish: 6 tasks)
```

### User Story Dependencies

| Story | Priority | Depends On | Can Parallel With |
|-------|----------|------------|-------------------|
| US1 (Excel + Verify) | P1 | Phase 2 | - |
| US2 (Vision AI) | P2 | Phase 2 | US3 |
| US3 (Auto-Correction) | P2 | US1 (verification) | US2 |
| US4 (IS 2911 Rules) | P3 | US1 (verification) | US5 |
| US5 (Legacy PDF) | P3 | US4 | US4 |
| US6 (Formatting) | P4 | US3 (correction agent) | - |

### Parallel Opportunities

**Within Phase 1 (Setup):**
```
T002 (env vars) ║ T003 (types)
```

**Within Phase 2 (Foundational):**
```
T005 (extraction agent) ║ T006 (verification agent) ║ T007 (types extension)
```

**After Phase 2 - Parallel story tracks:**
```
Track A: US1 → US3 → US6  (Core + Correction path)
Track B: US2              (Vision AI - independent)
Track C: US4 → US5        (Compliance + Legacy path)
```

---

## Parallel Example: User Story 1 (MVP)

```bash
# Setup phase (parallel):
T002: "Add environment variables template for OPENAI_API_KEY in .env.example"
T003: "Add new types to src/types/index.ts"

# Foundational phase (parallel):
T005: "Create extraction agent in src/lib/ai/extraction-agent.ts"
T006: "Create verification agent in src/lib/ai/verification-agent.ts"
T007: "Extend SavedTest type in src/types/index.ts"

# US1 - API routes (parallel):
T008: "Create ingest API route in src/app/api/ingest/route.ts"
T010: "Create ingest job status API route in src/app/api/ingest/[jobId]/route.ts"
T011: "Create confirm extraction API route in src/app/api/ingest/[jobId]/confirm/route.ts"

# US1 - UI components (parallel after APIs):
T014: "Create extraction preview modal component"
T021: "Add verification score badge component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Day 1**: Phase 1 (Setup) - 3 tasks
2. **Day 2**: Phase 2 (Foundational) - 4 tasks
3. **Day 3-5**: Phase 3 (US1) - 18 tasks
4. **STOP & VALIDATE**: Test Excel → Auto-fill → Verify → Approve flow
5. **Demo**: Show working ingestion + verification

### Incremental Delivery

| Milestone | Phases | Tasks | Deliverable |
|-----------|--------|-------|-------------|
| Foundation | 1-2 | 7 | Parsers + Agents ready |
| **MVP** | 3 | 18 | Excel → Auto-fill → Verify → Approve |
| Vision AI | 4 | 6 | PDF/Image extraction |
| Auto-Correct | 5 | 7 | Fix errors automatically |
| Compliance | 6 | 4 | IS 2911 rules |
| Legacy | 7 | 3 | Re-verify old reports |
| Formatting | 8 | 2 | Layout fixes |
| Polish | 9 | 6 | Production ready |

---

## Task Count Summary

| Phase | Story | Tasks | Parallel |
|-------|-------|-------|----------|
| 1 - Setup | - | 3 | 2 |
| 2 - Foundational | - | 4 | 3 |
| 3 - US1 | Excel + Verify | 18 | 5 |
| 4 - US2 | Vision AI | 6 | 0 |
| 5 - US3 | Auto-Correction | 7 | 0 |
| 6 - US4 | IS 2911 Compliance | 4 | 0 |
| 7 - US5 | Legacy PDF | 3 | 0 |
| 8 - US6 | Formatting | 2 | 0 |
| 9 - Polish | - | 6 | 4 |
| **Total** | | **53** | **14** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USx] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **MVP scope**: Phase 1-3 (US1) = 25 tasks for core ingestion + verification
- Entry point is existing "Upload PDF" button in `project-details.tsx`
