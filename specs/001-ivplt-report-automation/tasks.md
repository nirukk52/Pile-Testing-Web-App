# Tasks: IVPLT Report Automation

**Input**: Design documents from `/specs/001-ivplt-report-automation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: User-facing behavior tests only (per project rules). No petty unit tests.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

## Path Conventions

- **Framework**: Next.js 14 (App Router)
- **Source**: `src/` at repository root
- **API Routes**: `src/app/api/`
- **Components**: `src/components/`
- **Engines**: `src/engines/` (NEW)

---

## Phase 1: Setup (Project Infrastructure)

**Purpose**: Initialize new dependencies, Supabase connection, and Prisma schema

- [ ] T001 Install new dependencies: `@supabase/supabase-js @prisma/client pdf-lib` in package.json
- [ ] T002 Install dev dependencies: `prisma playwright` in package.json
- [ ] T003 [P] Create Supabase client in `src/lib/supabase.ts`
- [ ] T004 [P] Create Prisma schema with all models in `prisma/schema.prisma`
- [ ] T005 Run Prisma migration: `npx prisma migrate dev --name init`
- [ ] T006 [P] Create environment variables template in `.env.example`
- [ ] T007 [P] Create Supabase Storage buckets (site-images, certificates) via dashboard or SQL
- [ ] T008 Install Playwright browsers: `npx playwright install chromium`

**Checkpoint**: Database ready, Supabase connected, dependencies installed

---

## Phase 2: Foundational (Test Type Engine + Core Types)

**Purpose**: Create the Test Type Engine abstraction and shared calculation utilities

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create Test Type Engine interface in `src/engines/types.ts`
- [ ] T010 [P] Create engine factory in `src/engines/factory.ts`
- [ ] T011 Create IvpltEngine implementation in `src/engines/ivplt-engine.ts`
- [ ] T012 [P] Create stub RvpltEngine in `src/engines/rvplt-engine.ts` (throws "not implemented")
- [ ] T013 [P] Create stub LateralEngine in `src/engines/lateral-engine.ts` (throws "not implemented")
- [ ] T014 [P] Create stub UpliftEngine in `src/engines/uplift-engine.ts` (throws "not implemented")
- [ ] T015 Create shared calculation utilities in `src/lib/calculations.ts`
- [ ] T016 Update TypeScript types with new entities in `src/types/index.ts`
- [ ] T017 [P] Create barrel export for engines in `src/engines/index.ts`

**Checkpoint**: Test Type Engine ready, UI can now use `getTestEngine(testType)`

---

## Phase 3: User Story 1 - Complete IVPLT Test Data Entry (Priority: P1) 🎯 MVP

**Goal**: Site engineer creates IVPLT test, enters project details with new fields, records readings with faulty gauge support

**Independent Test**: Create a test, enter project details, add 5+ readings with one gauge disabled, verify calculations display correctly

### Implementation for User Story 1

- [ ] T018 [US1] Create Project API route in `src/app/api/projects/route.ts`
- [ ] T019 [US1] Create Test API route in `src/app/api/tests/route.ts`
- [ ] T020 [US1] Create Test by ID API route in `src/app/api/tests/[testId]/route.ts`
- [ ] T021 [US1] Create Readings API route in `src/app/api/tests/[testId]/readings/route.ts`
- [ ] T022 [US1] Extend `src/components/test/project-details.tsx` with new fields: pileId, testDate, jackName, concreteGrade, pileDepth
- [ ] T023 [US1] Add gauge enable/disable toggles to `src/components/test/add-reading-page.tsx`
- [ ] T024 [US1] Add bold visual indicator for faulty gauges (strikethrough + red badge) in `src/components/test/add-reading-page.tsx`
- [ ] T025 [US1] Update average settlement calculation to exclude disabled gauges in `src/components/test/add-reading-page.tsx`
- [ ] T026 [US1] Integrate engine.validateReading() before save in `src/components/test/add-reading-page.tsx`
- [ ] T027 [US1] Update `src/components/test/data-entry.tsx` to show phase groupings (Loading/Hold/Unloading)
- [ ] T028 [US1] Update Zustand store to use Supabase instead of localStorage in `src/store/test-store.ts`
- [ ] T029 [US1] Add auto-calculation of testLoad from designLoad × multiplier in project-details

**Checkpoint**: User Story 1 complete - data entry works with extended fields and faulty gauge handling

---

## Phase 4: User Story 4 - View Report Preview with KPIs and Graph (Priority: P1) 🎯 MVP

**Goal**: Site engineer views report preview with KPIs, load-settlement chart, and pass/fail status

**Independent Test**: Complete data entry, view Report tab, verify KPIs show correct values, chart displays loading/unloading curves

### Implementation for User Story 4

- [ ] T030 [US4] Create Calculate API route in `src/app/api/tests/[testId]/calculate/route.ts`
- [ ] T031 [US4] Update `src/components/test/report-view.tsx` to use engine.calculate() for KPIs
- [ ] T032 [US4] Update Chart.js configuration using engine.getGraphConfig() in report-view.tsx
- [ ] T033 [US4] Add loading curve (blue) and unloading curve (green) to chart
- [ ] T034 [US4] Add 12mm settlement limit annotation line to chart
- [ ] T035 [US4] Add safe load horizontal annotation line to chart
- [ ] T036 [US4] Display pass/fail status with color indicator (green=PASS, red=FAIL)
- [ ] T037 [US4] Display acceptance criteria text from engine.getAcceptanceCriteria()
- [ ] T038 [US4] Add specifications panel showing all pile details

**Checkpoint**: User Story 4 complete - report preview shows accurate KPIs and professional chart

---

## Phase 5: User Story 2 - Upload Site Images with Captions (Priority: P2)

**Goal**: Site engineer uploads 3-5 test setup photos with optional captions

**Independent Test**: Upload 3 images, add captions, reorder via drag-drop, delete one, verify changes persist

### Implementation for User Story 2

- [ ] T039 [US2] Create Image Upload API route in `src/app/api/tests/[testId]/images/route.ts`
- [ ] T040 [US2] Create Image by ID API route in `src/app/api/tests/[testId]/images/[imageId]/route.ts`
- [ ] T041 [US2] Create SiteImages component in `src/components/test/site-images.tsx`
- [ ] T042 [US2] Add image upload with preview in site-images.tsx
- [ ] T043 [US2] Add caption input field (max 200 chars) per image
- [ ] T044 [US2] Implement drag-and-drop reordering for images
- [ ] T045 [US2] Add delete button with confirmation for images
- [ ] T046 [US2] Compress images to max 2MB before upload
- [ ] T047 [US2] Add SiteImages tab/section to test workspace in `src/app/test/page.tsx`

**Checkpoint**: User Story 2 complete - site images can be uploaded, captioned, reordered, deleted

---

## Phase 6: User Story 3 - Attach Calibration Certificates (Priority: P2)

**Goal**: Site engineer uploads calibration certificate PDFs categorized by type

**Independent Test**: Upload 2 PDF certificates with different types, verify they're listed, replace one, verify update

### Implementation for User Story 3

- [ ] T048 [US3] Create Certificate Upload API route in `src/app/api/tests/[testId]/certificates/route.ts`
- [ ] T049 [US3] Create Certificate by ID API route in `src/app/api/tests/[testId]/certificates/[certId]/route.ts`
- [ ] T050 [US3] Create Certificates component in `src/components/test/certificates.tsx`
- [ ] T051 [US3] Add PDF upload with type selector (Hydraulic Jack, Pressure Gauge, Dial Gauge, Proving Ring, Other)
- [ ] T052 [US3] Add PDF validation (reject non-PDF files)
- [ ] T053 [US3] Display list of uploaded certificates with type and filename
- [ ] T054 [US3] Implement replace logic (re-upload same type replaces existing)
- [ ] T055 [US3] Add delete button for certificates
- [ ] T056 [US3] Add Certificates tab/section to test workspace in `src/app/test/page.tsx`

**Checkpoint**: User Story 3 complete - calibration certificates can be uploaded and managed

---

## Phase 7: User Story 6 - Export Professional PDF Report (Priority: P1) 🎯 MVP

**Goal**: Generate 15-20 page PDF with all sections, actual chart, images, and certificates

**Independent Test**: Complete test with images and certificates, click Export PDF, verify all 12 sections present in output

### Implementation for User Story 6

- [ ] T057 [US6] Create PDF Generation API route in `src/app/api/tests/[testId]/pdf/route.ts`
- [ ] T058 [US6] Create IVPLT HTML template in `src/lib/pdf/templates/ivplt-template.tsx`
- [ ] T059 [US6] Implement title page section in template
- [ ] T060 [US6] Implement table of contents section in template
- [ ] T061 [US6] Implement general/introduction section with IS 2911 reference
- [ ] T062 [US6] Implement scope of work section with pile details table
- [ ] T063 [US6] Implement methodology section with equipment details
- [ ] T064 [US6] Implement results section with acceptance criteria and pass/fail
- [ ] T065 [US6] Implement data table section with all readings
- [ ] T066 [US6] Convert Chart.js canvas to base64 image for PDF embedding
- [ ] T067 [US6] Implement graph section with actual rendered chart
- [ ] T068 [US6] Implement site images section (2 per page with captions)
- [ ] T069 [US6] Use pdf-lib to merge calibration certificate PDFs at end
- [ ] T070 [US6] Create Playwright PDF generator in `src/lib/pdf/generator.ts`
- [ ] T071 [US6] Add "Export PDF" button to report-view.tsx
- [ ] T072 [US6] Implement PDF download with filename: `{PileID}_{TestType}_{Date}_Report.pdf`

**Checkpoint**: User Story 6 complete - professional PDF report generated with all sections

---

## Phase 8: User Story 5 - AI-Generated Conclusion with Override (Priority: P3) ✅ DONE

**Goal**: System generates IS 2911-compliant conclusion, user can edit before finalizing

**Independent Test**: Complete test, click "Generate Conclusion", verify AI output, edit text, verify edited version saved

### Implementation for User Story 5

- [x] T073 [US5] Create Conclusion API route in `src/app/api/tests/[testId]/conclusion/route.ts`
- [x] T074 [US5] Implement AI prompt template from engine.getAIConclusionPrompt()
- [x] T075 [US5] Add OpenAI Agents SDK integration via `src/lib/ai/conclusion-agent.ts`
- [x] T076 [US5] Add fallback static template when AI unavailable
- [x] T077 [US5] Add "Generate Conclusion" button to report-view.tsx
- [x] T078 [US5] Add editable textarea for conclusion with save button
- [x] T079 [US5] Store edited conclusion in Test.conclusion field
- [x] T080 [US5] Use custom conclusion in PDF generation if provided

**Checkpoint**: User Story 5 complete - AI conclusion works with override capability

---

## Phase 9: User Story 7 - Persist Data to Supabase with Offline Fallback (Priority: P2)

**Goal**: Primary storage via Supabase with localStorage fallback when offline. Clear visual indicator when using fallback. Sync button to push local data when back online.

**Independent Test**: Create test, disconnect network, verify localStorage fallback with visual indicator, reconnect, use sync button, verify data synced to Supabase

### Implementation for User Story 7

- [ ] T081 [US7] Ensure all API routes use Prisma client for database operations
- [ ] T082 [US7] Create hybrid persistence layer in `src/lib/storage.ts` (Supabase primary, localStorage fallback)
- [ ] T083 [US7] Add connection status detection hook `useConnectionStatus()` in `src/hooks/use-connection-status.ts`
- [ ] T084 [US7] Add "Offline Mode" banner component showing when using localStorage fallback
- [ ] T085 [US7] Add "Sync Now" button component that appears when local data exists and online
- [ ] T086 [US7] Implement sync logic to push localStorage queue to Supabase when online
- [ ] T087 [US7] Add loading states for data fetching in components
- [ ] T088 [US7] Add error handling for network failures with retry UI
- [ ] T089 [US7] Implement optimistic updates in Zustand store
- [ ] T090 [US7] Add Supabase Storage signed URL generation for images/certificates
- [ ] T091 [US7] Show last sync timestamp in footer/header

**Checkpoint**: User Story 7 complete - data persists with Supabase/localStorage hybrid, clear offline indicator, sync button works

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [ ] T092 [P] Update CLAUDE.md with new file locations and patterns
- [ ] T093 [P] Add loading spinners during API calls
- [ ] T094 [P] Add toast notifications for success/error states
- [ ] T095 Validate all forms before submission
- [ ] T096 [P] Add mobile-responsive styling to new components
- [ ] T097 Run quickstart.md validation - full end-to-end test
- [ ] T098 [P] Update README.md with new features

**Checkpoint**: Application polished and ready for production

---

## Phase 11: Validation Warnings (Data Quality Guards)

**Purpose**: Implement IS 2911 compliance warnings and data quality checks from gap-analysis.md section 9

**Goal**: Warn users about data inconsistencies without blocking workflow. User can acknowledge warnings with optional comment.

**Independent Test**: Enter data with issues (e.g., test load < required), verify warning appears, acknowledge with comment, verify workflow continues

### Validation Warning Tasks

- [ ] T099 [VAL] Create ValidationWarning type in `src/types/index.ts` with code, message, severity, acknowledged, acknowledgeComment fields
- [ ] T100 [VAL] Create `validateTestData()` function in `src/lib/validation.ts`
- [ ] T101 [VAL] Add warning: Test load < 2.5× design load (9.1 from gap-analysis)
- [ ] T102 [VAL] Add warning: Missing holding phase readings (9.2 from gap-analysis)
- [ ] T103 [VAL] Add warning: Settlement jump > 2mm between readings (9.3 from gap-analysis)
- [ ] T104 [VAL] Add warning: Gauge disabled banner showing which gauges are off (9.4 from gap-analysis)
- [ ] T105 [VAL] Add warning: Settlement not monotonic during loading phase (4.1 from gap-analysis)
- [ ] T106 [VAL] Create WarningBanner component in `src/components/ui/warning-banner.tsx`
- [ ] T107 [VAL] Add acknowledge button with optional comment modal
- [ ] T108 [VAL] Store acknowledged warnings in Test record
- [ ] T109 [VAL] Display warnings in data-entry.tsx and report-view.tsx
- [ ] T110 [VAL] Include acknowledged warnings with comments in PDF report

**Checkpoint**: Phase 11 complete - validation warnings show for data quality issues, can be acknowledged

---

## Phase 12: Chart Annotations (Gap 6.x)

**Purpose**: Add visual reference lines to Load vs Settlement chart per gap-analysis.md section 6

- [ ] T111 [CHART] Install chartjs-plugin-annotation: `npm install chartjs-plugin-annotation`
- [ ] T112 [CHART] Add design load vertical marker line (green dashed) in report-view.tsx
- [ ] T113 [CHART] Add test load vertical marker line (blue dashed) in report-view.tsx  
- [ ] T114 [CHART] Add 12mm settlement limit horizontal line (red dashed) in report-view.tsx
- [ ] T115 [CHART] Add annotation labels showing "Design Load", "Test Load", "12mm Limit"

**Checkpoint**: Phase 12 complete - chart shows all reference markers per IS 2911

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────────────┐
                                                              │
Phase 2 (Foundational) ◄─────────────────────────────────────┘
    │
    │ BLOCKS ALL USER STORIES
    ▼
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│  Phase 3 (US1: Data Entry) ──────► Phase 4 (US4: Report Preview)  │
│         │                                    │                    │
│         │                                    ▼                    │
│         │                          Phase 7 (US6: PDF Export)      │
│         │                                    │                    │
│         │                                    ▼                    │
│         │                          Phase 8 (US5: AI Conclusion)   │
│         │                                                         │
│         ▼                                                         │
│  Phase 5 (US2: Site Images) ─────────────────────────────────────►│
│         │                                                         │
│         ▼                                                         │
│  Phase 6 (US3: Certificates) ────────────────────────────────────►│
│                                                                   │
│  Phase 9 (US7: Supabase Persistence) ◄────────────────────────────│
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        Phase 10 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (Data Entry) | Phase 2 | - |
| US4 (Report Preview) | US1 | - |
| US2 (Site Images) | Phase 2 | US3 |
| US3 (Certificates) | Phase 2 | US2 |
| US6 (PDF Export) | US4, US2, US3 | - |
| US5 (AI Conclusion) | US4 | US6 |
| US7 (Persistence) | All API routes created | - |

### Parallel Opportunities

**Within Phase 1 (Setup):**
```
T003 (Supabase client) ║ T004 (Prisma schema) ║ T006 (env template) ║ T007 (Storage buckets)
```

**Within Phase 2 (Foundational):**
```
T010 (factory) ║ T012 (RVPLT stub) ║ T013 (Lateral stub) ║ T014 (Uplift stub) ║ T017 (barrel export)
```

**After Phase 2, parallel story tracks:**
```
Track A: US1 → US4 → US6 → US5  (Core MVP path)
Track B: US2 (Images)            (Independent)
Track C: US3 (Certificates)      (Independent)
```

---

## Implementation Strategy

### MVP First (Recommended)

1. **Week 1**: Phase 1 (Setup) + Phase 2 (Foundational)
2. **Week 2**: Phase 3 (US1: Data Entry) + Phase 4 (US4: Report Preview)
3. **STOP & VALIDATE**: Test data entry and report preview independently
4. **Week 3**: Phase 7 (US6: PDF Export) - This completes core MVP
5. **Demo**: Show working PDF generation

### Incremental Delivery

| Milestone | Phases | Deliverable |
|-----------|--------|-------------|
| Foundation | 1-2 | Engine + DB ready |
| MVP-1 | 3-4 | Data entry + Preview |
| MVP-2 | 7 | PDF Export works |
| Enhancement | 5-6 | Images + Certificates |
| Polish | 8-10 | AI + Cleanup |

---

## Task Summary

| Phase | Story | Tasks | Parallel |
|-------|-------|-------|----------|
| 1 - Setup | - | 8 | 5 |
| 2 - Foundation | - | 9 | 5 |
| 3 - US1 | Data Entry | 12 | 0 |
| 4 - US4 | Report Preview | 9 | 0 |
| 5 - US2 | Site Images | 9 | 0 |
| 6 - US3 | Certificates | 9 | 0 |
| 7 - US6 | PDF Export | 16 | 0 |
| 8 - US5 | AI Conclusion | 8 | 0 |
| 9 - US7 | Persistence + Offline | 11 | 0 |
| 10 - Polish | - | 7 | 5 |
| 11 - Validation | Warnings | 12 | 0 |
| 12 - Chart | Annotations | 5 | 0 |
| **Total** | | **115** | **15** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USx] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **MVP scope**: Phases 1-4 + Phase 7 (US1 + US4 + US6) = Core data entry + PDF generation
