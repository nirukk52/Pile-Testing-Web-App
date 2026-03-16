# Feature Specification: OpenClaw Agent Setup

**Feature Branch**: `006-openclaw-agent-setup`  
**Created**: 2026-03-14  
**Status**: Draft  
**Input**: User description: "Build PileTest MCP server, create OpenClaw workspace with agent config, install piletest-pro skill, migrate from Supabase to Neon/local PostgreSQL, wire WhatsApp for client file intake and report delivery"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Client Sends Field Sheet via WhatsApp (Priority: P1)

A site engineer photographs or downloads a pile load test field sheet (PDF, Excel, or image) and sends it to a WhatsApp number. The system extracts structured data (project info + readings), returns a formatted preview for review, and upon confirmation generates an IS 2911-compliant report PDF back into the chat.

**Why this priority**: This is the entire product value proposition — zero-app-install report generation from WhatsApp.

**Independent Test**: Send a known training-data PDF (`report-001/field-sheet/TP-01 BDD-No-3 IVPLT.pdf`) via WhatsApp. Verify extracted JSON matches `expected.json` at ≥95% field accuracy. Verify returned PDF contains correct KPIs, chart, and data table.

**Acceptance Scenarios**:

1. **Given** a scanned IVPLT field sheet PDF, **When** user sends it on WhatsApp, **Then** system extracts project info and readings and replies with a structured preview within 60 seconds
2. **Given** an extracted preview with all fields correct, **When** user replies "confirm" or "ok", **Then** agent asks for optional attachments: site photos, calibration certificates, and additional field reading scans
3. **Given** the user sends site photos (JPEG/PNG), **When** agent receives them, **Then** they are stored and embedded in the report's Site Images section
4. **Given** the user sends calibration certificate PDFs (jack, gauge, dial gauge), **When** agent receives them, **Then** they are appended as pages at the end of the final report PDF
5. **Given** all attachments are collected (or user says "no more" / "skip"), **When** agent proceeds, **Then** it generates and sends back a complete IS 2911-compliant report PDF (main report + site images + field sheets + certificates merged) within 90 seconds
6. **Given** an extracted preview with an incorrect field (e.g. wrong pile diameter), **When** user replies with a correction ("pile diameter is 900mm"), **Then** system updates the field and re-shows the corrected preview
7. **Given** an Excel observation sheet (.xlsx), **When** user sends it on WhatsApp, **Then** system parses it using the Excel parser and returns the same structured preview as for PDF input

**Reference Reports**: See `project_info_and_context/generated-reports/TP-01_IVPLT_2025-12-09_Report.pdf` (complete merged report with site images + certificates) and `training-data/report-001/og-report/Report IVPLT TP-01-900mm (420T)..pdf` (original client report for comparison)

---

### User Story 2 — MCP Server Exposes PileTest Tools (Priority: P1)

A standalone MCP server wraps the existing PileTest calculation engine, extraction pipeline, and PDF generator as structured tools that any MCP client (OpenClaw, Cursor, Claude) can call programmatically.

**Why this priority**: This is the foundation layer — without the MCP server, the OpenClaw agent has no tools to execute.

**Independent Test**: Call each MCP tool via `openclaw tool call piletest/<tool_name>` with known inputs from `training-data/report-001/expected.json`. Verify outputs match expected values.

**Acceptance Scenarios**:

1. **Given** a file path to a PDF, **When** `ingest_file` tool is called, **Then** it returns structured JSON in the `expected.json` shape with confidence scores per field
2. **Given** extracted projectInfo + readings JSON, **When** `validate_test` tool is called, **Then** it returns IS 2911 pass/fail verdict, net settlement, safe load, and any compliance issues
3. **Given** validated test data, **When** `generate_report` tool is called, **Then** it produces a PDF matching the existing report template (same layout, chart, data table as current web app output)
4. **Given** a testId, **When** `get_test` tool is called, **Then** it returns the full test record from the database including readings, images, and certificates
5. **Given** a template name and project overrides, **When** `save_template` is called then `apply_template` is called with that name, **Then** the saved defaults are loaded into a new extraction session

---

### User Story 3 — OpenClaw Agent Workspace with PileTest Persona (Priority: P2)

A dedicated OpenClaw workspace (`~/.openclaw/workspace-piletest`) is configured with domain-specific agent files (AGENTS.md, SOUL.md, IDENTITY.md, etc.) so the agent behaves as a pile load testing specialist connected via WhatsApp.

**Why this priority**: The MCP server provides tools, but the agent needs persona and behavioral rules to use them correctly in client conversations.

**Independent Test**: Start the piletest agent (`openclaw agent start piletest`). Verify it loads SOUL.md persona, has access to MCP tools, and responds to a "hello" message with domain-appropriate greeting.

**Acceptance Scenarios**:

1. **Given** the openclaw.json config with a `piletest` agent entry, **When** the gateway starts, **Then** the agent loads its workspace files (AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md) in the correct injection order
2. **Given** a configured WhatsApp channel binding for the piletest agent, **When** a whitelisted number sends a message, **Then** it routes to the piletest agent (not the main workspace agent)
3. **Given** the piletest agent receives a file, **When** it processes the file, **Then** it uses MCP tools (ingest_file → validate_test → generate_report) in the correct sequence with appropriate user confirmations between steps

---

### User Story 4 — Database Migration from Supabase to Local/Neon PostgreSQL (Priority: P2)

The application's database dependency shifts from Supabase-hosted PostgreSQL to either a local PostgreSQL instance (for development/self-hosting) or Neon serverless PostgreSQL (for production), removing the Supabase SDK dependency.

**Why this priority**: Eliminates cloud vendor lock-in and monthly costs. The MCP server needs direct database access without Supabase auth overhead.

**Independent Test**: Run `prisma migrate deploy` against the new database. Seed with `expected.json` data. Query via Prisma client and verify all models (Project, Test, Reading, etc.) work correctly.

**Acceptance Scenarios**:

1. **Given** the current Prisma schema, **When** migrations run against a local PostgreSQL instance, **Then** all tables, indexes, and enums are created matching the current Supabase structure
2. **Given** existing test data in Supabase, **When** a migration script runs, **Then** all Projects, Tests, Readings, SiteImages, CalibrationCertificates, and FieldReadings are transferred to the new database with zero data loss
3. **Given** the new database connection, **When** the MCP server and web app both connect, **Then** both read/write to the same database with no conflicts
4. **Given** a Neon serverless PostgreSQL connection string, **When** set as DATABASE_URL, **Then** the application works identically to the local PostgreSQL setup (Prisma handles both)

---

### User Story 5 — Template Management for Repeat Clients (Priority: P3)

Engineers working with the same client/contractor repeatedly can save report presets (company name, pile specs, header/logo, disclaimers) as templates and apply them to new tests, reducing repeated data entry.

**Why this priority**: Quality-of-life feature that becomes critical at scale but not needed for first client handoff.

**Independent Test**: Save a template with known project defaults. Apply it to a new extraction. Verify the new session pre-fills the saved fields.

**Acceptance Scenarios**:

1. **Given** a completed and verified test, **When** user says "save as template ABC Infra IVPLT", **Then** system stores client name, contractor, pile diameter, ram area, concrete grade, and report layout preferences
2. **Given** a saved template "ABC Infra IVPLT", **When** user says "use ABC template" before uploading a new file, **Then** extracted data is pre-filled with template defaults and user only needs to confirm/edit readings

---

### Edge Cases

- What happens when the uploaded file is corrupted or unreadable? → Return clear error message with suggestion to re-photograph/re-send
- What happens when extraction confidence is below 80% on critical fields (pressure, dial gauges)? → Force explicit field-by-field confirmation before proceeding
- What happens when WhatsApp media download fails? → Retry once after 5 seconds, then inform user to resend
- What happens when the PDF generator (Browserless/Puppeteer) is unavailable? → Queue the request and notify user of delay, retry when service recovers
- What happens when two files are sent simultaneously? → Process sequentially, acknowledge both, deliver results in order
- What happens with non-pile-test documents (random PDFs, invoices)? → Detect and respond: "This doesn't look like a pile load test document. Please send a field sheet, observation sheet, or Excel with test readings."
- What happens when user sends site photos before the field sheet? → Agent stores them and asks for the observation sheet/readings first, then associates photos with the test once created
- What happens when user sends a mix of certificates and photos in one batch? → Agent classifies each file by type (image → site photo, PDF with "calibration" → certificate, PDF with readings → field sheet) and routes accordingly

## Requirements *(mandatory)*

### Functional Requirements

#### MCP Server

- **FR-001**: System MUST expose an `ingest_file` tool that accepts PDF, JPEG, PNG, WEBP, XLSX, XLS, CSV, DOC, and DOCX files and returns structured JSON in the `expected.json` schema with per-field confidence scores
- **FR-002**: System MUST expose a `validate_test` tool that accepts projectInfo + readings JSON and returns IS 2911 pass/fail verdict, computed values (net settlement, elastic rebound, safe load), and compliance issues list
- **FR-003**: System MUST expose a `generate_report` tool that produces a complete merged PDF: main report (header, KPIs, chart, data table, conclusion) + embedded site images + appended field reading scans + appended calibration certificate PDFs
- **FR-004**: System MUST expose a `get_test` tool that retrieves a full test record (with readings, images, certificates) from the database by testId
- **FR-005**: System MUST expose `save_template` and `apply_template` tools for managing reusable project presets
- **FR-006**: All MCP tools MUST return structured JSON output with consistent error schemas (error code, message, suggestion)
- **FR-007**: The MCP server MUST use the same calculation functions (`src/lib/calculations.ts`) and IS 2911 engine (`src/engines/ivplt-engine.ts`) as the web app — no duplicated formula logic
- **FR-007a**: PostgreSQL (via Prisma) is the **single source of truth** for all finalized test data. Extracted data remains temporary (agent conversation state) until user confirms, at which point it is written to the database. Report generation MUST read exclusively from the database, never from in-flight extraction JSON. All edits (WhatsApp corrections or web app changes) MUST update the database directly.

#### OpenClaw Agent

- **FR-008**: System MUST create a dedicated OpenClaw workspace at `~/.openclaw/workspace-piletest/` with AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, MEMORY.md, HEARTBEAT.md, and BOOTSTRAP.md
- **FR-009**: System MUST register a `piletest` agent in `openclaw.json` with the MCP server configured under its tools
- **FR-010**: The agent MUST follow a strict conversation flow: ingest → preview → user confirms/edits → collect attachments (site photos, certificates, field sheets) → validate → generate merged PDF → deliver
- **FR-010a**: The agent MUST accept site images (JPEG/PNG/WEBP) sent after confirmation and embed them in the report's Site Images section
- **FR-010b**: The agent MUST accept calibration certificate PDFs sent after confirmation and append them as pages in the final merged report
- **FR-010c**: The agent MUST accept additional field reading PDF scans and append them after the main report pages
- **FR-010d**: The agent MUST allow user to skip attachments ("no photos", "skip certificates", "that's all") and proceed to generation
- **FR-011**: The agent MUST highlight low-confidence fields (confidence < 0.85) and require explicit user confirmation before proceeding
- **FR-012**: The agent MUST install the `piletest-pro` skill (converted from `.claude/skills/piletest-pro/`) for IS 2911 domain knowledge

#### WhatsApp Channel

- **FR-013**: System MUST bind the piletest agent to a WhatsApp channel with allowlist-based access control
- **FR-014**: System MUST handle file attachments (images, PDFs, documents) received via WhatsApp and route them to the `ingest_file` MCP tool
- **FR-015**: System MUST send generated report PDFs back as WhatsApp document attachments
- **FR-016**: System MUST support correction flow: user sends text corrections → agent updates fields → re-validates → re-previews

#### Database Migration

- **FR-017**: System MUST replace Supabase SDK (`@supabase/supabase-js`) with direct Prisma client for all database operations
- **FR-018**: System MUST support both local PostgreSQL and Neon serverless PostgreSQL via the same Prisma schema (connection string swap only)
- **FR-019**: System MUST provide a data migration script that transfers existing Supabase data to the new database
- **FR-020**: System MUST remove Supabase Storage dependency for file uploads and replace with local filesystem or S3-compatible storage

### Key Entities

- **MCP Server**: Standalone TypeScript process exposing PileTest tools via Model Context Protocol (stdio transport for local use)
- **Agent Workspace**: Directory containing behavioral config files that define the agent's persona, rules, and memory
- **Template**: Reusable preset storing project defaults (client, contractor, pile specs, report layout) keyed by a human-readable name
- **Extraction Session**: Stateful conversation tracking an active file → preview → confirm → generate flow, stored in agent memory

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client can go from sending a field sheet PDF on WhatsApp to receiving a finished report PDF in under 3 minutes (automated path, no corrections needed)
- **SC-002**: Extraction accuracy on known training data (report-001, report-002) must be ≥95% field match (matching or exceeding the current 97% eval score)
- **SC-003**: Generated reports from the MCP pipeline must achieve 100% calculation parity with the web app (identical net settlement, safe load, pass/fail for the same input data)
- **SC-004**: The system handles all 4 supported test types (IVPLT, RVPLT, LATERAL, UPLIFT) through the same WhatsApp flow
- **SC-005**: Database migration results in zero data loss — all existing Projects, Tests, and Readings are verifiable post-migration
- **SC-006**: The agent correctly rejects non-pile-test documents and guides users to send appropriate files
- **SC-007**: Template save/apply round-trips correctly — saved defaults are accurately loaded into new sessions

## Assumptions

- The OpenClaw gateway is already running locally on the user's machine (port 18789) and WhatsApp channel is functional
- The existing `openclaw.json` agent list pattern (workspace + agentDir + skills + identity) applies to the new piletest agent
- The piletest-pro skill from `.claude/skills/piletest-pro/` can be adapted to OpenClaw skill format with minimal changes (markdown skill files are compatible)
- Neon PostgreSQL is the preferred production database; local PostgreSQL is for development — the choice is connection-string-only with no code changes
- The current Browserless.io PDF generation approach continues for production; local Puppeteer for development
- File storage (field sheets, certificates, site images) moves to local filesystem for the MCP server, with optional S3 mount later
- WhatsApp media size limit of 50MB (already configured in openclaw.json) is sufficient for all expected file types
