# Architecture: PileTest Pro — OpenClaw Agent System

**Feature Branch**: `006-openclaw-agent-setup`  
**Created**: 2026-03-14

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT INTERFACES                                  │
│                                                                             │
│   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐     │
│   │   WhatsApp    │          │   Web App     │          │   Cursor /   │     │
│   │   (Client)    │          │   (Engineer)  │          │   Claude     │     │
│   └──────┬───────┘          └──────┬───────┘          └──────┬───────┘     │
│          │                         │                         │              │
└──────────┼─────────────────────────┼─────────────────────────┼──────────────┘
           │                         │                         │
           ▼                         │                         │
┌─────────────────────┐              │                         │
│   OpenClaw Gateway   │              │                         │
│   (port 18789)       │              │                         │
│                      │              │                         │
│  ┌────────────────┐  │              │                         │
│  │ piletest agent  │  │              │                         │
│  │                 │  │              │                         │
│  │ SOUL.md         │  │              │                         │
│  │ AGENTS.md       │  │              │                         │
│  │ piletest-pro    │  │              │                         │
│  │ skill           │  │              │                         │
│  └───────┬────────┘  │              │                         │
│          │            │              │                         │
└──────────┼────────────┘              │                         │
           │                           │                         │
           │ MCP (stdio)               │ HTTP API                │ MCP (stdio)
           │                           │                         │
           ▼                           ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        PILETEST MCP SERVER                                  │
│                        (TypeScript / Node.js)                               │
│                                                                             │
│   ┌─────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────┐     │
│   │ ingest_file  │ │ validate_test│ │generate_report│ │   get_test   │     │
│   └──────┬──────┘ └──────┬───────┘ └───────┬───────┘ └──────┬───────┘     │
│          │               │                  │                │              │
│   ┌──────┴──────┐ ┌──────┴───────┐ ┌───────┴───────┐ ┌──────┴───────┐     │
│   │save_template│ │apply_template│ │ store_file     │ │ attach_file  │     │
│   └──────┬──────┘ └──────┬───────┘ └───────┬───────┘ └──────┬───────┘     │
│          │               │                  │                │              │
│   ───────┴───────────────┴──────────────────┴────────────────┴──────────   │
│                                                                             │
│                         SHARED CORE LIBRARY                                 │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │                                                                  │     │
│   │  calculations.ts    ← IS 2911 formulas (load, settlement, safe) │     │
│   │  engines/           ← Test type engines (IVPLT, RVPLT, etc.)    │     │
│   │  extraction-config  ← Field definitions, aliases, patterns       │     │
│   │  agent-swarm.ts     ← Gemini extraction (PDF/image → JSON)      │     │
│   │  excel-parser.ts    ← Excel/CSV parsing                         │     │
│   │  verification.ts    ← IS 2911 compliance checks                 │     │
│   │  ivplt-template.tsx ← Report HTML template                      │     │
│   │  chart-generator.ts ← Load vs Settlement chart                  │     │
│   │  generator.ts       ← Puppeteer/Browserless PDF render          │     │
│   │  merge.ts           ← pdf-lib merge (certs + field sheets)      │     │
│   │                                                                  │     │
│   └──────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ Prisma Client
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                     POSTGRESQL (SSOT)                                        │
│                     Neon (prod) / Local (dev)                               │
│                                                                             │
│   ┌──────────┐ ┌──────┐ ┌─────────┐ ┌───────────┐ ┌─────────────────┐    │
│   │ Project  │ │ Test │ │ Reading │ │ SiteImage │ │FieldReading     │    │
│   └──────────┘ └──────┘ └─────────┘ └───────────┘ └─────────────────┘    │
│                                                                             │
│   ┌───────────────────────┐ ┌──────────────┐ ┌─────────────────────┐      │
│   │CalibrationCertificate │ │ UserProfile  │ │ Template (new)      │      │
│   └───────────────────────┘ └──────────────┘ └─────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │          FILE STORAGE                │
                    │     Local FS (dev) / S3 (prod)      │
                    │                                     │
                    │  /uploads/site-images/               │
                    │  /uploads/field-readings/            │
                    │  /uploads/certificates/              │
                    │  /uploads/source-files/              │
                    │  /generated/reports/                 │
                    └─────────────────────────────────────┘
```

---

## Data Flow: WhatsApp → Report

```
USER (WhatsApp)                     OPENCLAW AGENT                     MCP SERVER                        DATABASE
     │                                    │                                │                                │
     │  1. Send field sheet PDF           │                                │                                │
     │ ──────────────────────────────────>│                                │                                │
     │                                    │                                │                                │
     │                                    │  2. ingest_file(pdf)           │                                │
     │                                    │ ─────────────────────────────>│                                │
     │                                    │                                │                                │
     │                                    │                                │── agent-swarm.ts ──>           │
     │                                    │                                │   Gemini Vision API            │
     │                                    │                                │<── extracted JSON ──           │
     │                                    │                                │                                │
     │                                    │  3. Return: projectInfo +      │                                │
     │                                    │     readings + confidence      │                                │
     │                                    │ <─────────────────────────────│                                │
     │                                    │                                │                                │
     │  4. Preview (formatted text)       │                                │                                │
     │ <──────────────────────────────────│                                │                                │
     │     ⚠️ low-confidence fields       │                                │                                │
     │     highlighted                    │                                │                                │
     │                                    │                                │                                │
     │  5. "pile diameter is 900mm"       │                                │                                │
     │ ──────────────────────────────────>│                                │                                │
     │                                    │── update in-memory JSON        │                                │
     │                                    │                                │                                │
     │  6. Updated preview                │                                │                                │
     │ <──────────────────────────────────│                                │                                │
     │                                    │                                │                                │
     │  7. "ok" / "confirm"               │                                │                                │
     │ ──────────────────────────────────>│                                │                                │
     │                                    │                                │                                │
     │                                    │  8. validate_test(data)        │                                │
     │                                    │ ─────────────────────────────>│                                │
     │                                    │                                │── calculations.ts              │
     │                                    │                                │── ivplt-engine.ts              │
     │                                    │                                │── verification.ts              │
     │                                    │  9. Return: pass/fail +        │                                │
     │                                    │     net settlement, safe load  │                                │
     │                                    │ <─────────────────────────────│                                │
     │                                    │                                │                                │
     │                                    │  10. Write to DB               │                                │
     │                                    │     (SSOT moment)              │                                │
     │                                    │ ─────────────────────────────>│── prisma.project.create ──────>│
     │                                    │                                │── prisma.test.create ─────────>│
     │                                    │                                │── prisma.reading.createMany ──>│
     │                                    │ <─────────────────────────────│ <──────── testId ──────────────│
     │                                    │                                │                                │
     │  11. "Send site photos?"           │                                │                                │
     │ <──────────────────────────────────│                                │                                │
     │                                    │                                │                                │
     │  12. Sends 3 JPEG photos           │                                │                                │
     │ ──────────────────────────────────>│                                │                                │
     │                                    │  13. store_file(photos)        │                                │
     │                                    │ ─────────────────────────────>│── save to /uploads/ ──────────>│
     │                                    │                                │── prisma.siteImage.create ───>│
     │                                    │ <─────────────────────────────│                                │
     │                                    │                                │                                │
     │  14. "Send certificates?"          │                                │                                │
     │ <──────────────────────────────────│                                │                                │
     │                                    │                                │                                │
     │  15. Sends jack cert + gauge cert  │                                │                                │
     │ ──────────────────────────────────>│                                │                                │
     │                                    │  16. store_file(certs)         │                                │
     │                                    │ ─────────────────────────────>│── save to /uploads/ ──────────>│
     │                                    │                                │── prisma.certificate.create ─>│
     │                                    │ <─────────────────────────────│                                │
     │                                    │                                │                                │
     │  17. "that's all"                  │                                │                                │
     │ ──────────────────────────────────>│                                │                                │
     │                                    │                                │                                │
     │                                    │  18. generate_report(testId)   │                                │
     │                                    │ ─────────────────────────────>│                                │
     │                                    │                                │── READ FROM DB ONLY ──────────>│
     │                                    │                                │<── test + readings + images ──│
     │                                    │                                │                                │
     │                                    │                                │── ivplt-template.tsx (HTML)    │
     │                                    │                                │── chart-generator.ts (chart)   │
     │                                    │                                │── generator.ts (Puppeteer→PDF) │
     │                                    │                                │── merge.ts (append certs +     │
     │                                    │                                │   field sheets)                │
     │                                    │                                │                                │
     │                                    │  19. Return: PDF bytes         │                                │
     │                                    │ <─────────────────────────────│                                │
     │                                    │                                │                                │
     │  20. Report PDF attachment         │                                │                                │
     │ <──────────────────────────────────│                                │                                │
     │                                    │                                │                                │
     │  ✅ DONE (< 3 min total)           │                                │                                │
```

---

## OpenClaw Configuration

```
~/.openclaw/
├── openclaw.json                    ← add "piletest" agent entry + MCP config
│
├── workspace-piletest/              ← NEW dedicated workspace
│   ├── AGENTS.md                    ← behavior rules (conversation flow, approval gates)
│   ├── SOUL.md                      ← persona (geotech specialist, IS 2911 expert)
│   ├── USER.md                      ← client info (company, projects, preferences)
│   ├── IDENTITY.md                  ← name: "PileTest", emoji: 🏗️, theme: "IS 2911 report automation"
│   ├── TOOLS.md                     ← MCP server connection notes, file paths, DB info
│   ├── MEMORY.md                    ← long-term: client history, template preferences
│   ├── HEARTBEAT.md                 ← periodic: check for pending reports, stale sessions
│   ├── BOOTSTRAP.md                 ← first-run: verify DB connection, test MCP tools
│   ├── memory/
│   │   └── YYYY-MM-DD.md           ← daily session logs
│   └── skills/
│       └── piletest-pro/            ← symlink or copy from .claude/skills/piletest-pro
│           └── SKILL.md
│
├── agents/
│   └── piletest/
│       └── agent/                   ← agent-specific overrides
│
└── skills/
    └── piletest-pro -> ...          ← global skill symlink
```

### Workspace File Contents

```
~/.openclaw/workspace-piletest/
│
├── IDENTITY.md          ← Agent card
│   │
│   │  # IDENTITY.md - Who Am I?
│   │  - Name: PileTest
│   │  - Creature: Domain-specialist AI (pile load testing)
│   │  - Vibe: Precise, methodical, field-engineer-friendly
│   │  - Emoji: 🏗️
│   │
│   │  ## Agent Card
│   │  - ID: piletest
│   │  - Role: Intake field data → extract → validate → generate IS 2911 reports
│   │  - Goal: Zero-friction report generation from WhatsApp file uploads
│   │  - Model: anthropic/claude-opus-4-6
│   │  - Workspace: ~/.openclaw/workspace-piletest/
│   │  - Bindings: WhatsApp (piletest channel)
│   │  - Skills: piletest-pro
│   │  - MCP: piletest (ingest_file, validate_test, generate_report, get_test,
│   │         store_file, attach_file, save_template, apply_template)
│   │  - Upstream: main (router can delegate here)
│   │  - Downstream: none (leaf agent)
│   │  - Status: active
│
├── SOUL.md              ← Persona and boundaries
│   │
│   │  # SOUL.md - Who You Are
│   │
│   │  ## Core Truths
│   │  You are a geotechnical engineering assistant specializing in pile load
│   │  testing. You help site engineers turn raw field data into IS 2911
│   │  (Part 4) - 2013 compliant reports.
│   │
│   │  Be precise with numbers. Settlement values, pressure readings, and
│   │  load calculations are not approximate — they determine structural safety.
│   │  When in doubt about a reading, flag it. Never silently guess.
│   │
│   │  ## Communication Style
│   │  - Speak like a senior site engineer, not a chatbot
│   │  - Use field terminology: "dial gauge", "loading cycle", "net settlement"
│   │  - WhatsApp messages: short, clear, no markdown tables
│   │  - When showing previews: use bullet lists with field names bolded
│   │  - IST timezone always (Asia/Kolkata) — all projects are in India
│   │
│   │  ## Boundaries
│   │  - NEVER alter readings without explicit user confirmation
│   │  - NEVER generate a report from unconfirmed extracted data
│   │  - ALWAYS write to database BEFORE generating report (DB is SSOT)
│   │  - ALWAYS highlight fields with confidence < 0.85
│   │  - If extraction fails entirely, say so and ask user to re-send or
│   │    enter readings manually
│   │
│   │  ## Domain Knowledge
│   │  Your piletest-pro skill has IS 2911 formulas, acceptance criteria,
│   │  test types, and chart specs. Read it on first session.
│
├── AGENTS.md            ← Operating manual
│   │
│   │  # AGENTS.md - PileTest Agent
│   │
│   │  ## Every Session
│   │  1. Read SOUL.md
│   │  2. Read USER.md
│   │  3. Read memory/ (today + yesterday)
│   │  4. If main session: also read MEMORY.md
│   │
│   │  ## Conversation Flow (STRICT)
│   │  When a user sends a file:
│   │    1. Call MCP ingest_file → get extracted JSON + confidence
│   │    2. Format preview as WhatsApp message (bullet list, flag low-confidence)
│   │    3. Wait for user to confirm or correct
│   │    4. On corrections: update in-memory JSON, re-preview
│   │    5. On confirm: call MCP validate_test → show pass/fail + key values
│   │    6. Write to DB via MCP (SSOT moment)
│   │    7. Ask: "Send site photos? (or say skip)"
│   │    8. Accept photos → call MCP store_file for each
│   │    9. Ask: "Send calibration certificates? (or say skip)"
│   │   10. Accept cert PDFs → call MCP store_file for each
│   │   11. On "done"/"skip"/"that's all" → call MCP generate_report(testId)
│   │   12. Send PDF back as WhatsApp document
│   │
│   │  ## Safety
│   │  - No external actions without user confirmation
│   │  - trash > rm
│   │  - Never share client data across sessions or with other agents
│   │
│   │  ## Templates
│   │  - If user says "save as template [name]": call MCP save_template
│   │  - If user says "use [name] template": call MCP apply_template before
│   │    ingesting, so extracted data merges with template defaults
│   │
│   │  ## Non-Pile-Test Files
│   │  - If file doesn't look like a field sheet/observation/excel:
│   │    respond: "This doesn't appear to be a pile load test document.
│   │    Please send a field sheet, observation sheet, or Excel with test data."
│   │
│   │  ## WhatsApp Formatting
│   │  - No markdown tables (WhatsApp doesn't render them)
│   │  - Use *bold* for field names, plain text for values
│   │  - Keep messages under 1000 chars; split if needed
│   │  - Send PDFs as document attachments, not media
│
├── USER.md              ← Client/user info
│   │
│   │  # USER.md - About Your Users
│   │  - Primary user: Niranjan (owner/developer)
│   │  - End users: Site engineers in India
│   │  - Timezone: Asia/Kolkata (IST)
│   │  - Language: English + occasional Hindi/Marathi
│   │  - Context: Engineers send files from job sites on phones
│   │    — keep messages short, responses fast, avoid jargon overload
│   │  - Active projects: [populated as clients onboard]
│
├── TOOLS.md             ← Environment-specific notes
│   │
│   │  # TOOLS.md - Local Environment
│   │
│   │  ## MCP Server
│   │  - Server: piletest (stdio transport)
│   │  - Tools: ingest_file, validate_test, generate_report, get_test,
│   │    store_file, attach_file, save_template, apply_template
│   │
│   │  ## Database
│   │  - Engine: PostgreSQL (Neon prod / local dev)
│   │  - ORM: Prisma
│   │  - Schema: <repo>/prisma/schema.prisma
│   │  - Models: Project, Test, Reading, SiteImage, CalibrationCertificate,
│   │    FieldReading, UserProfile, Template
│   │
│   │  ## File Storage
│   │  - Path: /uploads/ (local dev)
│   │  - Buckets: site-images/, field-readings/, certificates/, source-files/
│   │  - Generated reports: /generated/reports/
│   │
│   │  ## PDF Generation
│   │  - Dev: local Puppeteer (Chrome)
│   │  - Prod: Browserless.io (wss://production-sfo.browserless.io)
│   │  - Viewport: 794×1123 (A4 at 96 DPI, 2× device scale)
│   │
│   │  ## AI / Extraction
│   │  - Vision: Gemini 2.5 Pro (via Google AI SDK)
│   │  - Two-agent swarm: ProjectInfo agent + Readings agent (parallel)
│   │  - Excel: xlsx package parser
│   │
│   │  ## Repo Path
│   │  - <repo-path> (this project)
│   │
│   │  ## Test Types Supported
│   │  - IVPLT, RVPLT, LATERAL, UPLIFT
│   │  - Currently only IVPLT has full engine + template
│
├── MEMORY.md            ← Long-term curated memory
│   │
│   │  # MEMORY.md
│   │  (Starts empty. Agent populates as it processes tests.)
│   │
│   │  ## Template: entries look like this after use
│   │  ## 2026-03-XX — First test processed
│   │  - Client: [name], Project: [name], Pile: TP-XX
│   │  - Test type: IVPLT, Design load: XXX MT
│   │  - Result: PASSED/FAILED, Net settlement: X.Xmm
│   │  - Template saved: [name] (if applicable)
│   │  - Issues encountered: [any extraction problems, corrections needed]
│
├── HEARTBEAT.md         ← Periodic checks
│   │
│   │  # HEARTBEAT.md
│   │  ## Periodic Checks (when heartbeat fires)
│   │  - Check for stale sessions: if extraction was started > 24h ago
│   │    without confirmation, remind user
│   │  - Check for pending report requests that failed and need retry
│
├── BOOTSTRAP.md         ← First-run setup (deleted after completion)
│   │
│   │  # BOOTSTRAP.md — First Run
│   │
│   │  ## Prerequisites
│   │  1. Verify MCP server is reachable: call get_test with a known testId
│   │  2. Verify DB connection: get_test should return data or empty (not error)
│   │  3. Verify piletest-pro skill is loaded: check skill list
│   │  4. Verify file storage path exists and is writable
│   │
│   │  ## Smoke Test
│   │  1. Call ingest_file with training-data/report-001/field-sheet/TP-01.pdf
│   │  2. Verify extracted JSON has projectInfo.pileId = "TP-01"
│   │  3. Call validate_test with expected.json data
│   │  4. Verify isPassed = true, netSettlement < 12mm
│   │
│   │  ## After Bootstrap
│   │  - Update IDENTITY.md if name/emoji needs changing
│   │  - Delete this file
│
├── memory/              ← Daily session logs
│   └── YYYY-MM-DD.md   ← Created per session
│
└── skills/
    └── piletest-pro/    ← Symlink to .claude/skills/piletest-pro or copy
        ├── SKILL.md
        └── references/
            ├── is2911-standards.md
            ├── report-structure.md
            └── test-types.md
```

### openclaw.json addition

```jsonc
{
  "agents": {
    "list": [
      // ... existing agents (main, morya-pa, pranav, mahesh, abhi, maps-manager)
      {
        "id": "piletest",
        "name": "piletest",
        "workspace": "/Users/priyankalalge/.openclaw/workspace-piletest",
        "agentDir": "/Users/priyankalalge/.openclaw/agents/piletest/agent",
        "model": "anthropic/claude-opus-4-6",
        "skills": ["piletest-pro"],
        "mcp": {
          "servers": {
            "piletest": {
              "command": "node",
              "args": ["<repo-path>/mcp-server/dist/index.js"],
              "description": "PileTest Pro MCP — ingest, validate, generate reports"
            }
          }
        },
        "identity": {
          "name": "PileTest",
          "theme": "IS 2911 pile load test report automation",
          "emoji": "🏗️"
        }
      }
    ]
  },
  "bindings": [
    // ... existing bindings
    {
      "agentId": "piletest",
      "match": {
        "channel": "whatsapp",
        "accountId": "piletest"
        // or match by phone number allowlist
      }
    }
  ]
}
```

---

## MCP Server Tool Schema

```
piletest-mcp-server/
├── src/
│   ├── index.ts                     ← MCP server entry (stdio transport)
│   ├── tools/
│   │   ├── ingest-file.ts           ← wraps agent-swarm + excel-parser
│   │   ├── validate-test.ts         ← wraps calculations + verification
│   │   ├── generate-report.ts       ← wraps template + PDF gen + merge
│   │   ├── get-test.ts              ← wraps Prisma queries
│   │   ├── store-file.ts            ← stores images/certs to FS + DB
│   │   ├── attach-file.ts           ← associates uploaded file with a test
│   │   ├── save-template.ts         ← saves project presets
│   │   └── apply-template.ts        ← loads project presets
│   ├── shared/                      ← imports from main repo's src/lib/
│   │   ├── prisma.ts                ← re-exports Prisma client
│   │   ├── calculations.ts          ← re-exports from src/lib/
│   │   └── engines/                 ← re-exports from src/engines/
│   └── storage/
│       └── local-fs.ts              ← replaces Supabase Storage
├── package.json
├── tsconfig.json
└── prisma/ → ../../prisma/          ← symlink to shared schema
```

---

## Database: Before vs After

```
BEFORE (Supabase)                          AFTER (Neon / Local PG)
─────────────────                          ──────────────────────

Supabase PostgreSQL ──┐                    PostgreSQL ──────────────┐
Supabase Storage   ──┤                    Local FS / S3          ──┤
Supabase Auth      ──┤ (coupled)          (no auth layer yet)    ──┤ (decoupled)
Supabase SDK       ──┘                    Prisma Client only     ──┘

.env:                                     .env:
  NEXT_PUBLIC_SUPABASE_URL                  DATABASE_URL=postgresql://...
  NEXT_PUBLIC_SUPABASE_ANON_KEY             DIRECT_URL=postgresql://...
  DATABASE_URL (via Supabase)               STORAGE_PATH=/uploads
  BROWSERLESS_API_KEY                       BROWSERLESS_API_KEY
                                            GOOGLE_AI_API_KEY

Files affected:
  src/lib/supabase.ts        → DELETE (or replace with local-fs)
  src/lib/pdf/merge.ts       → replace Supabase download with local FS read
  src/app/api/**/route.ts    → remove getSupabase() calls, use Prisma only
  prisma/schema.prisma       → no changes (already pure Prisma)
```

---

## Quality Gate: Parity Testing

```
training-data/report-001/
├── field-sheet/TP-01 BDD-No-3 IVPLT.pdf   ← INPUT to MCP ingest_file
├── expected.json                           ← GROUND TRUTH
├── extracted.json                          ← COMPARE: MCP extraction output
├── eval-result.json                        ← COMPARE: field-by-field accuracy
└── og-report/Report IVPLT TP-01-900mm.pdf  ← VISUAL COMPARE: generated PDF

Parity test script:
  1. Call MCP ingest_file(field-sheet.pdf)
  2. Compare extracted JSON vs expected.json → must be ≥ 95% match
  3. Call MCP validate_test(extracted data)
  4. Compare computed values (net settlement, safe load, pass/fail)
     → must be 100% match with web app calculate API
  5. Call MCP generate_report(testId)
  6. Visual diff generated PDF vs og-report → same sections, layout, values
```
