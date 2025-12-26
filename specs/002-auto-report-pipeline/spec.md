# Feature Specification: Automated Report Correction & Improvement Pipeline

**Feature Branch**: `002-auto-report-pipeline`  
**Created**: 2024-12-17  
**Status**: Draft  
**Input**: User description: "Automated Report Correction and Improvement Pipeline for pile load test reports. Full auto-correction (data, formatting, compliance), balanced human review, IVPLT first, all input types supported."

---

## Overview

An end-to-end agentic pipeline that:
1. **Ingests** data from any source (PDF scans, Excel, legacy reports)
2. **Generates** IS 2911-compliant pile load test reports
3. **Verifies** the generated report against raw data and standards
4. **Auto-Corrects** any issues found
5. **Presents** the final report for user approval

**Workflow Pattern**: Orchestrator-Worker (Anthropic best practice)
- **Orchestrator**: Manages state machine, decides next step
- **Workers**: Extraction Agent, Report Generator, Verification Agent, Correction Agent

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Excel Ingestion & Report Generation (Priority: P1)

A manager receives an Excel file from a sub-contractor containing IVPLT test readings. They upload it to PileTest Pro and get a professional PDF report in seconds.

**Why this priority**: Excel is the most structured input → lowest extraction risk → highest success rate. Quick win for production.

**Independent Test**: Upload `sample-ivplt-readings.xlsx`, verify all readings are extracted correctly, generate report, verify score ≥ 90.

**Acceptance Scenarios**:

1. **Given** an Excel file with IVPLT readings in a known format, **When** user uploads the file, **Then** system extracts Project Info and all Load/Settlement readings with >95% accuracy.
2. **Given** extracted data from Excel, **When** user clicks "Generate Report", **Then** system produces a PDF that scores ≥ 90 on verification.
3. **Given** a generated report with score ≥ 90, **When** user reviews and clicks "Approve", **Then** report is marked as "Verified" and available for download.

---

### User Story 2 - PDF Scan Ingestion (Handwritten Notes) (Priority: P2)

A site engineer takes photos of handwritten field notes. They upload the PDF/images to PileTest Pro. The system uses Vision AI to extract readings and generates a report.

**Why this priority**: This is the most common field scenario but has higher extraction complexity. Builds on Story 1's pipeline.

**Independent Test**: Upload a scanned PDF of handwritten readings, verify Vision AI extracts key values, confirm user can review/edit extractions before report generation.

**Acceptance Scenarios**:

1. **Given** a PDF scan of handwritten field notes, **When** user uploads the file, **Then** system uses Vision API to extract readings with confidence scores.
2. **Given** extracted data with some low-confidence values (<80%), **When** system presents extraction results, **Then** low-confidence fields are highlighted for user review.
3. **Given** user corrects a low-confidence field, **When** user confirms all extractions, **Then** system proceeds to report generation.

---

### User Story 3 - Auto-Correction of Data Errors (Priority: P2)

During verification, the agent detects a data mismatch (e.g., OCR read "52mm" instead of "5.2mm"). The system auto-corrects this obvious error and re-verifies.

**Why this priority**: Core value proposition of the "auto-correction" pipeline. Reduces manual review time.

**Independent Test**: Inject a known OCR error into test data, run verification, confirm agent flags and corrects it, verify score improves after correction.

**Acceptance Scenarios**:

1. **Given** a generated report with a data integrity issue (PDF shows 52mm, raw data says 5.2mm), **When** Verification Agent runs, **Then** issue is flagged as "critical" with suggested correction.
2. **Given** a flagged critical issue with high correction confidence (>90%), **When** Correction Agent runs, **Then** data is auto-corrected and report is re-generated.
3. **Given** a re-generated report after correction, **When** Verification Agent re-runs, **Then** score improves (target: ≥ 90).

---

### User Story 4 - Compliance Interpretation (IS 2911) (Priority: P3)

The Verification Agent checks if the report conclusion (PASS/FAIL) matches IS 2911 rules. If net settlement is 12.1mm (just over the 12mm limit), the agent applies domain knowledge to flag or interpret.

**Why this priority**: Important for regulatory compliance but less frequent than data errors.

**Independent Test**: Create a test case with borderline settlement (12.1mm), verify agent flags for human review rather than auto-deciding.

**Acceptance Scenarios**:

1. **Given** a report with net settlement exactly at 12.0mm, **When** Verification Agent runs, **Then** conclusion is marked "PASS" per IS 2911.
2. **Given** a report with net settlement at 12.1mm (borderline), **When** Verification Agent runs, **Then** issue is flagged as "warning" for human review, not auto-failed.
3. **Given** domain context (loading phase typically shows increasing pressure, 24/48hr cycle), **When** agent encounters ambiguous patterns, **Then** it applies domain heuristics before flagging.

---

### User Story 5 - Legacy PDF Report Re-Verification (Priority: P3)

A reviewer uploads an existing PDF report (generated elsewhere) to verify its accuracy against IS 2911 standards and check for common formatting issues.

**Why this priority**: Useful for QA workflows but not core report generation flow.

**Independent Test**: Upload a legacy PDF report, verify system extracts tables/values, runs verification checks, outputs a score.

**Acceptance Scenarios**:

1. **Given** an existing PDF report from legacy system, **When** user uploads it, **Then** system extracts tables and key values using `pdfplumber`.
2. **Given** extracted data from legacy report, **When** Verification Agent runs, **Then** system produces a verification scorecard (Pass/Warn/Fail).
3. **Given** a legacy report with formatting issues (overlapping text), **When** Visual Quality check runs, **Then** issues are flagged in the report.

---

### User Story 6 - Report Formatting Corrections (Priority: P4)

The Verification Agent detects that a table is cut off or a graph is missing. The Correction Agent adjusts the template/layout and re-generates.

**Why this priority**: Lower priority as our templates are well-tested; this is a fallback safety net.

**Independent Test**: Simulate a truncated table by providing oversized data, verify agent detects and suggests layout adjustment.

**Acceptance Scenarios**:

1. **Given** a report where table rows exceed page height, **When** Verification Agent runs Visual Quality check, **Then** "table overflow" is flagged.
2. **Given** a flagged formatting issue, **When** Correction Agent runs, **Then** it adjusts layout (e.g., smaller font, page break) and re-generates.

---

### Edge Cases

- **Empty file upload**: System shows clear error message, no crash.
- **Unsupported file format**: System rejects with "Supported formats: PDF, XLSX, CSV, DOCX, Images".
- **Corrupted PDF**: System attempts extraction, fails gracefully, prompts user to re-upload.
- **All readings identical**: Flag as potential data entry error (unlikely in real tests).
- **Missing required fields**: System prompts user to fill in missing data before generation.
- **Verification loop stuck**: Max 3 correction iterations; if still failing, escalate to human.

---

## Requirements *(mandatory)*

### Functional Requirements

**Ingestion**
- **FR-001**: System MUST accept file uploads in PDF, XLSX, CSV, and image formats (JPG, PNG).
- **FR-002**: System MUST use Vision API (GPT-4V / Claude Vision) to extract text from scanned/handwritten PDFs.
- **FR-003**: System MUST parse Excel files using `xlsx` library and map columns to `ProjectInfo` and `Reading` schemas.
- **FR-004**: System MUST display extracted data with confidence scores for user review before proceeding.

**Report Generation**
- **FR-005**: System MUST generate IS 2911-compliant PDF reports using existing report templates.
- **FR-006**: System MUST support IVPLT test type initially; RVPLT, Uplift, Lateral in future iterations.

**Verification**
- **FR-007**: System MUST run Data Integrity checks (compare PDF values vs. raw data).
- **FR-008**: System MUST run IS 2911 Compliance checks (settlement limits, test load ratios).
- **FR-009**: System MUST run Visual Quality checks (table overflow, missing graphs, broken layout).
- **FR-010**: System MUST output a Verification Score (0-100) with Pass (≥90) / Warn (80-89) / Fail (<80) status.

**Correction**
- **FR-011**: System MUST auto-correct data errors with >90% confidence without user confirmation.
- **FR-012**: System MUST flag corrections with <90% confidence for user review.
- **FR-013**: System MUST re-run verification after each correction cycle.
- **FR-014**: System MUST limit correction loops to 3 iterations; escalate to human if unresolved.

**User Approval**
- **FR-015**: System MUST require user approval ("Approve" button) before finalizing any report.
- **FR-016**: System MUST mark approved reports as "Verified" in the database.

### Key Entities

- **IngestionJob**: Represents a file upload session. Tracks file metadata, extraction status, extracted data.
- **VerificationReport**: Output of the Verification Agent. Contains score, status, issues array, summary.
- **CorrectionLog**: Tracks each correction attempt (what was changed, before/after values, confidence).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can upload an Excel file and receive a verified report (score ≥ 90) in under 2 minutes.
- **SC-002**: Vision API extraction achieves ≥ 85% accuracy on handwritten field notes (measured against 10 sample PDFs).
- **SC-003**: Auto-correction resolves ≥ 70% of flagged data errors without human intervention.
- **SC-004**: 95% of generated reports require ≤ 3 manual edits before user approval.
- **SC-005**: System handles 50 concurrent ingestion jobs without degradation.
- **SC-006**: User approval rate (user clicks "Approve" on first review) exceeds 80%.

---

## Domain Context (For AI Agents)

Provide this context to extraction and verification agents:

- **Pressure Gauge**: During LOADING phase, pressure increases. During UNLOADING, it decreases.
- **Dial Gauges**: Measure settlement in mm. 4 gauges are averaged.
- **Typical Test Duration**: 24-hour or 48-hour cycle.
- **Test Load**: IVPLT = 2.5x Design Load, RVPLT = 1.5x Design Load.
- **Pass Criteria (IS 2911)**: Net settlement ≤ 12mm at test load for vertical tests.
- **Ram Area Formula**: Load (MT) = Pressure (kg/cm²) × Ram Area (cm²) / 1000.

---

## Assumptions

- Users have stable internet for Vision API calls.
- Excel files follow a semi-consistent column structure (agent can adapt to minor variations).
- Handwritten notes are legible (not severely damaged or faded).
- Existing report templates are well-tested and rarely need layout corrections.

---

## Out of Scope (Future)

- RVPLT, Uplift, Lateral test types (Phase 2).
- DOCX file support (low priority - Excel/PDF covers 99% of use cases).
- Batch processing (upload 10 files at once).
- Integration with external sensors/loggers.
- Native mobile app.
