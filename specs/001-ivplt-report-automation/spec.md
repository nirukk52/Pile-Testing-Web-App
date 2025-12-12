# Feature Specification: IVPLT Report Automation

**Feature Branch**: `001-ivplt-report-automation`  
**Created**: 2025-12-12  
**Status**: Draft  
**Input**: Automate IVPLT (Initial Vertical Pile Load Test) report generation matching the sample report "Report IVPLT TP-02 600mm (147T).pdf" with Supabase backend, site image uploads, calibration certificate attachments, and professional 15-20 page PDF export.

## Context & Background

Site engineers conduct pile load tests at construction sites following IS 2911 (Part 4) - 2013 standards. Currently, test data is entered manually into the app, but the final report generation is incomplete. The target is to produce professional, IS 2911-compliant PDF reports that match (and improve upon) the sample report structure.

**Reference Report Structure** (from sample):
1. Title Page - Project details, client, contractor, lab info
2. Table of Contents
3. General Introduction - Purpose of the test
4. Scope of Work - Pile specifications, test load calculations
5. Methodology - IS 2911 compliance details, equipment setup
6. Results - Acceptance criteria, max/net settlement, safe load determination
7. Load vs Settlement Table - All readings with phases
8. Load vs Settlement Graph - Visual curve showing loading/unloading
9. Observations - Field notes and analysis
10. Conclusion - Safe load adopted, pass/fail status
11. Site Images (3-5 photos with captions)
12. Calibration Certificates (4 pages - Jack, gauges, proving ring PDFs)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete IVPLT Test Data Entry (Priority: P1)

A site engineer creates a new IVPLT test, enters all project details (including new fields like Pile ID, test date, jack specifications), and records load readings throughout the test cycle. The system calculates load from pressure readings and average settlement from dial gauges, with support for marking faulty gauges.

**Why this priority**: Core functionality - without complete data entry, no report can be generated. This extends the existing form with essential missing fields.

**Independent Test**: Can be tested by creating a test, entering project details with new fields, adding readings with gauge fault flags, and verifying calculations display correctly.

**Acceptance Scenarios**:

1. **Given** a user starts a new IVPLT test, **When** they view the project details form, **Then** they see all required fields including: Pile ID, test date, pile diameter, pile depth, concrete grade, design load, ram area, jack name, dial gauge least count, client, contractor, PMC, and location.

2. **Given** a user is entering a reading, **When** they mark a dial gauge as faulty (disabled), **Then** the average settlement is calculated from only the enabled gauges and the faulty gauge is displayed with a bold visual indicator.

3. **Given** a user enters pressure gauge reading and ram area is configured, **When** viewing the reading, **Then** the calculated load (pressure × ram area / 1000) is displayed automatically.

4. **Given** all readings are entered, **When** the user views the data entry screen, **Then** readings are organized by phase (Loading, 24hr Hold, Unloading) with clear visual separation.

---

### User Story 2 - Upload Site Images with Captions (Priority: P2)

A site engineer uploads 3-5 photos of the test setup (hydraulic jack, dial gauges, kentledge platform, etc.) with optional captions describing each image. These images will appear in the final report.

**Why this priority**: Site photos provide visual documentation of test setup and are required in professional reports. Builds on P1 data.

**Independent Test**: Can be tested by uploading multiple images, adding captions, viewing the gallery, and deleting/reordering images.

**Acceptance Scenarios**:

1. **Given** a user is on the test workspace, **When** they navigate to the site images section, **Then** they can upload up to 5 images from their device.

2. **Given** images are uploaded, **When** the user views the images, **Then** they can add/edit an optional caption for each image.

3. **Given** multiple images are uploaded, **When** the user wants to reorder them, **Then** they can drag and drop to set the display order for the report.

4. **Given** an image is no longer needed, **When** the user deletes it, **Then** it is removed from storage and the test.

---

### User Story 3 - Attach Calibration Certificates (Priority: P2)

A site engineer uploads calibration certificate PDFs (for hydraulic jack, pressure gauges, dial gauges, proving ring) that will be embedded at the end of the final report. Each certificate is categorized by type.

**Why this priority**: Calibration certificates are mandatory for IS 2911 compliance and legal documentation. Essential for professional reports.

**Independent Test**: Can be tested by uploading certificate PDFs, selecting certificate types, previewing uploads, and seeing them listed for report inclusion.

**Acceptance Scenarios**:

1. **Given** a user is on the test workspace, **When** they navigate to the calibration certificates section, **Then** they can upload PDF files and select the certificate type (Hydraulic Jack, Pressure Gauge, Dial Gauge, Proving Ring, Other).

2. **Given** certificates are uploaded, **When** the user views the list, **Then** they see each certificate with its type, filename, and upload date.

3. **Given** a certificate needs to be replaced, **When** the user deletes and re-uploads, **Then** the new certificate replaces the old one for that type.

4. **Given** certificates are attached, **When** generating the report, **Then** all certificate PDFs are appended at the end of the generated report.

---

### User Story 4 - View Report Preview with KPIs and Graph (Priority: P1)

A site engineer views the report preview showing key performance indicators (test load, max settlement, net settlement, pass/fail status), the load vs settlement graph with actual data points, pile specifications, and the data table.

**Why this priority**: Report preview is essential for verification before PDF generation. Includes real-time calculations per IS 2911.

**Independent Test**: Can be tested by completing data entry and viewing the report tab to see KPIs, graph, specs, and data table rendered correctly.

**Acceptance Scenarios**:

1. **Given** test data is entered, **When** the user navigates to the Report tab, **Then** they see KPI cards displaying: Test Load, Max Settlement, Elastic Rebound, Net Settlement, and Pass/Fail status.

2. **Given** readings exist for loading and unloading phases, **When** viewing the report, **Then** the Load vs Settlement chart displays both curves with distinct colors (blue for loading, green for unloading).

3. **Given** the net settlement exceeds 12mm, **When** viewing the report, **Then** the status shows "FAILED" with red indicator; otherwise shows "PASSED" with green indicator.

4. **Given** all project details are entered, **When** viewing the report, **Then** the specifications panel shows all pile details, test configuration, and methodology reference (IS 2911 Part 4 - 2013).

---

### User Story 5 - AI-Generated Conclusion with Override (Priority: P3)

The system generates a conclusion statement based on test results using AI, following IS 2911 standards language. The engineer can review and edit the generated conclusion before finalizing.

**Why this priority**: Automates tedious report writing while maintaining engineer oversight. Valuable but not blocking for MVP.

**Independent Test**: Can be tested by completing a test, generating the conclusion, editing it, and seeing the edited version persist.

**Acceptance Scenarios**:

1. **Given** all test data is complete, **When** the user clicks "Generate Conclusion", **Then** the system produces a conclusion statement referencing: max settlement, net settlement, elastic rebound, safe load adopted, and pass/fail determination.

2. **Given** a conclusion is generated, **When** the user edits the text, **Then** the edited version is saved and used in the final report.

3. **Given** the test shows passing results, **When** conclusion is generated, **Then** it states that the design load can be adopted as the safe vertical load.

4. **Given** the test shows failing results, **When** conclusion is generated, **Then** it recommends remedial actions or further investigation.

---

### User Story 6 - Export Professional PDF Report (Priority: P1)

A site engineer exports the complete IVPLT report as a professional PDF (15-20 pages) that includes: title page, table of contents, all report sections, actual load vs settlement chart, site images, and calibration certificates.

**Why this priority**: The primary deliverable of the entire feature. Without PDF export, the app provides no tangible output.

**Independent Test**: Can be tested by completing a full test with images and certificates, generating PDF, and verifying all sections are present and properly formatted.

**Acceptance Scenarios**:

1. **Given** all test data, images, and certificates are ready, **When** the user clicks "Export PDF", **Then** a downloadable PDF file is generated with all report sections.

2. **Given** the PDF is generated, **When** opened in a PDF viewer, **Then** it contains: title page, table of contents, general section, scope of work, methodology, results, data table, graph (actual rendered chart), site images with captions, and calibration certificates.

3. **Given** the Load vs Settlement graph, **When** viewing the PDF, **Then** the chart shows actual data points with loading curve (blue) and unloading curve (green).

4. **Given** site images were uploaded, **When** viewing the PDF, **Then** images appear at specified resolution with their captions.

5. **Given** calibration certificates were attached, **When** viewing the PDF, **Then** each certificate PDF is embedded as separate pages at the end.

6. **Given** the PDF is exported, **When** checking page count, **Then** it is between 15-20 pages depending on content.

---

### User Story 7 - Persist Data to Supabase (Priority: P2)

All test data, images, and certificates are stored in Supabase (database and storage) instead of localStorage, enabling data persistence across devices and sessions.

**Why this priority**: Essential for production use and multi-device access, but MVP can function with localStorage initially during development.

**Independent Test**: Can be tested by creating a test, closing browser, reopening, and verifying all data persists.

**Acceptance Scenarios**:

1. **Given** a user creates a new test, **When** data is saved, **Then** it is persisted to Supabase database (not localStorage).

2. **Given** images are uploaded, **When** stored, **Then** they are saved to Supabase Storage bucket with test reference.

3. **Given** certificates are uploaded, **When** stored, **Then** they are saved to Supabase Storage bucket with type metadata.

4. **Given** a user logs in from a different device, **When** viewing tests, **Then** all previously created tests are available.

---

### Edge Cases

- What happens when a user tries to generate PDF without any readings? → Show error message requiring minimum readings.
- What happens when all 4 dial gauges are marked as faulty? → Show error preventing reading submission.
- What happens when image upload fails mid-way? → Show retry option and preserve already uploaded images.
- What happens when certificate PDF is corrupted? → Validate PDF format before accepting upload.
- How does system handle very large images (>10MB)? → Compress images before upload, reject if still too large.
- What happens when user navigates away during PDF generation? → PDF generation continues in background, download link provided when ready.
- What if network disconnects during Supabase sync? → Queue changes for retry when connection restores.

## Requirements *(mandatory)*

### Functional Requirements

**Data Entry & Forms**

- **FR-001**: System MUST capture extended project details: Pile ID (e.g., TP-02), test date, pile diameter (mm), pile depth (m), concrete grade, design load (T), ram area (cm²), jack name, dial gauge least count (mm), client, contractor, PMC, and location.

- **FR-002**: System MUST calculate test load as 2.5× design load for IVPLT automatically.

- **FR-003**: System MUST calculate load from pressure reading: `load = (pressure × ramArea) / 1000` in metric tons.

- **FR-004**: System MUST calculate average settlement from enabled dial gauges only, excluding any disabled (faulty) gauges.

- **FR-005**: System MUST display disabled/faulty gauges with bold visual indicator (e.g., strikethrough + "Faulty" badge).

- **FR-006**: System MUST support reading phases: Loading, 24hr Hold, Unloading with visual differentiation.

- **FR-007**: System MUST auto-number readings in sequence (1, 2, 3...) within the test.

**Calculations (IS 2911 Compliance)**

- **FR-008**: System MUST calculate max settlement as highest average settlement recorded.

- **FR-009**: System MUST calculate elastic rebound as difference between max settlement and final settlement after complete unloading.

- **FR-010**: System MUST calculate net settlement as max settlement minus elastic rebound.

- **FR-011**: System MUST determine pass/fail: PASS if net settlement ≤ 12mm OR net settlement ≤ 2% of pile diameter (whichever is less).

- **FR-012**: System MUST calculate safe load per IS 2911: two-thirds of load at which settlement reaches 12mm, or 50% of load at 10% pile diameter settlement.

**Image Management**

- **FR-013**: System MUST allow uploading up to 5 site images per test (JPEG, PNG, WebP formats).

- **FR-014**: System MUST support optional caption text (max 200 characters) per image.

- **FR-015**: System MUST allow reordering images via drag-and-drop.

- **FR-016**: System MUST compress images to max 2MB before storage.

**Certificate Management**

- **FR-017**: System MUST allow uploading PDF calibration certificates with type selection.

- **FR-018**: System MUST support certificate types: Hydraulic Jack, Pressure Gauge, Dial Gauge, Proving Ring, Other.

- **FR-019**: System MUST validate uploaded files are valid PDFs before accepting.

- **FR-020**: System MUST allow one certificate per type per test (replace on re-upload).

**Report Generation**

- **FR-021**: System MUST generate PDF report with sections: Title Page, Table of Contents, General, Scope of Work, Methodology, Results, Data Table, Graph, Site Images, Calibration Certificates.

- **FR-022**: System MUST render actual Load vs Settlement chart as image in PDF (not placeholder).

- **FR-023**: System MUST embed uploaded site images with captions in PDF.

- **FR-024**: System MUST append calibration certificate PDFs at end of report.

- **FR-025**: System MUST generate downloadable PDF file with naming convention: `{PileID}_{TestType}_{Date}_Report.pdf`.

**AI Conclusion**

- **FR-026**: System MUST generate conclusion text based on test results using AI.

- **FR-027**: System MUST allow user to edit/override AI-generated conclusion.

- **FR-028**: System MUST include in conclusion: max settlement, net settlement, elastic rebound, safe load, pass/fail status.

**Data Persistence**

- **FR-029**: System MUST store test data in Supabase PostgreSQL database.

- **FR-030**: System MUST store images and certificates in Supabase Storage buckets.

- **FR-031**: System MUST use Prisma ORM for database operations.

- **FR-032**: System MUST start fresh with new schema (no migration from localStorage).

### Key Entities

- **Project**: Organization-level container. Attributes: name, client, contractor, PMC, location.

- **Test (IVPLT)**: A single pile load test instance. Attributes: pile ID, test date, pile diameter, pile depth, concrete grade, design load, test load, jack reference, dial gauge least count, status (draft/in_progress/completed/reported).

- **Reading**: A single measurement during the test. Attributes: sequence number, phase, timestamp, pressure, calculated load, dial gauge readings (4), gauge enabled flags (4), average settlement, remark.

- **Test Result**: Computed summary. Attributes: max settlement, elastic rebound, net settlement, safe load adopted, pass/fail status, conclusion text.

- **Site Image**: Photo attachment. Attributes: file reference, caption, display order.

- **Calibration Certificate**: PDF attachment. Attributes: file reference, certificate type, upload date.

- **Jack/Calibration Data**: Equipment reference. Attributes: jack name, ram area, calibration date, validity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Site engineer can complete full IVPLT data entry (project details + 20 readings) in under 15 minutes.

- **SC-002**: Generated PDF report contains all 12 required sections in correct order.

- **SC-003**: Load vs Settlement chart in PDF accurately reflects entered data points with ±0.01mm precision.

- **SC-004**: 95% of users successfully generate a complete PDF report on first attempt.

- **SC-005**: PDF file size remains under 15MB for typical test (20 readings, 5 images, 4 certificates).

- **SC-006**: AI-generated conclusion requires zero edits for 80% of standard test results.

- **SC-007**: System correctly calculates pass/fail status matching manual IS 2911 calculation for 100% of tests.

- **SC-008**: Image upload and processing completes in under 5 seconds per image.

- **SC-009**: PDF generation completes in under 30 seconds for a full report.

- **SC-010**: Data persists correctly across browser sessions and devices via Supabase.

## Assumptions

1. Users have mobile devices with camera access for site photos.
2. Calibration certificates are already available as PDF files.
3. Internet connectivity is available during PDF generation (for Supabase storage access).
4. Single user per test (no concurrent editing).
5. English language only for MVP.
6. Test reports follow IS 2911 (Part 4) - 2013 standards.
7. Supabase project is provisioned and accessible.

## Out of Scope (Future Work)

- Template/language customization module (per test type).
- Reusable calibration certificate library across tests.
- User authentication and multi-user roles.
- Offline mode with sync.
- Other test types (RVPLT, Lateral, Uplift).
- Report approval workflows.
- Native mobile app.
