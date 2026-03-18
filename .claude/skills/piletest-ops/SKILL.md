---
name: piletest-ops
description: Operational workflows for the PileTest Telegram/OpenClaw agent. Covers file ingestion, data confirmation, report generation, attachment handling, template management, error recovery, and backend sync. Use when building or updating the conversational agent pipeline, MCP tool integrations, message formatting, or theme customization for pile load test report workflows.
---

# PileTest Ops - Agent Workflows

Operational guide for the PileTest agent running on Telegram via OpenClaw.

## Core Pipeline

```
User sends file
  → ingest_file (extract JSON + confidence)
  → Preview (bullet list, flag low-confidence fields)
  → User confirms / corrects
  → validate_test (pass/fail + key values)
  → Metadata gate (reportNo, testDate, pileDepthM, concreteGrade)
  → DB write via MCP (SSOT moment)
  → Prompt for site photos → store_file each
  → Prompt for calibration certs → store_file each
  → generate_report(testId)
  → Verifier (score ≥ 90 → send PDF; < 90 → show diffs, retry)
  → Send PDF as Telegram document
```

## MCP Tool Usage

See `references/mcp-tools.md` for full parameter schemas. Quick dispatch:

| Action | Tool | Key Params |
|--------|------|------------|
| Extract data from file | `ingest_file` | filePath, fileType (pdf/xlsx/image) |
| Run IS 2911 checks | `validate_test` | testId |
| Generate PDF report | `generate_report` | testId |
| Fetch test data | `get_test` | testId |
| Upload photo/cert/file | `store_file` | testId, filePath, fileCategory |
| Link file to test | `attach_file` | testId, fileId, attachmentType |
| Save reusable defaults | `save_template` | name, templateData |
| Apply template before ingest | `apply_template` | templateName, testId |

## Metadata Gate

Before any DB write, enforce these required fields:
- `reportNo` — user-provided report number
- `testDate` — official test date in DD/MM/YYYY (display as-is on cover, no timezone shift)
- `pileDepthM` — pile depth in metres
- `concreteGrade` — e.g. M25, M30

If any are missing after extraction, ask user explicitly and wait. Do not guess.

## Attachment Workflows

### Site Photos
1. After DB write, ask: "Send site photos? (or say skip)"
2. Accept images one-by-one or batched
3. Call `store_file` with `fileCategory: 'site-image'` for each
4. On "done"/"skip" → proceed to certificates

### Calibration Certificates
1. Ask: "Send calibration certificates? (or say skip)"
2. Accept PDFs
3. Call `store_file` with `fileCategory: 'certificate'` for each
4. On "done"/"skip" → trigger report generation

## Template System

- **Save**: User says "save as template [name]" → call `save_template`
- **Apply**: User says "use [name] template" → call `apply_template` before ingestion, so extracted data merges with template defaults (project name, client, consultant, etc.)

## Error Recovery

| Scenario | Action |
|----------|--------|
| Extraction confidence < 0.85 on a field | Flag with ⚠️, ask user to confirm or correct |
| Extraction fails entirely | Say so, ask user to re-send or enter readings manually |
| Validation fails (IS 2911 check) | Show specific failures, ask if user wants to proceed or fix |
| Verifier score < 90 | Show diffs, do NOT publish as final, allow retry |
| MCP tool call fails | Retry once, then report error with tool name + message |
| File not a pile test document | Respond: "This doesn't appear to be a pile load test document." |

## Message Formatting

See `references/telegram-formatting.md` for patterns. Key rules:
- No markdown tables (Telegram basic bots don't render them well)
- Use **bold** for field names, plain text for values
- Keep messages under 4000 chars (Telegram limit); split if needed
- Send PDFs as document attachments, not media
- Use bullet lists for data previews

## Theme Customization

Report styling is controlled by the theme-factory skill. The agent does not directly modify themes — it passes `themeId` to the report generator if the user has a saved preference.

## Backend Sync

- DB is the Single Source of Truth (SSOT) — always write before generating reports
- Use IST timezone (Asia/Kolkata) for all date operations
- Date format: DD/MM/YYYY for display, ISO for storage
- Never alter readings without explicit user confirmation
