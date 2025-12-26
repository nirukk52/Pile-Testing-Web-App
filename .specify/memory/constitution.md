# PileTest Pro Constitution

> Engineering principles and non-negotiable standards for the pile load test report automation platform.

## Core Principles

### I. Mobile-First & Field-Ready

All features MUST be usable on mobile devices in field conditions.
- Touch targets minimum 44px
- Input fields minimum 16px font (prevents iOS zoom)
- Works in bright sunlight (high contrast)
- Offline-capable where possible (localStorage fallback)
- Fat-finger friendly forms

### II. IS 2911 Compliance (NON-NEGOTIABLE)

All calculations, terminology, and report formats MUST comply with IS 2911 (Part 4) - 2013.
- Settlement limit: ≤12mm or ≤2% pile diameter (whichever is less)
- Test load: IVPLT = 2.5× design load, RVPLT = 1.5× design load
- Load formula: `Load (MT) = Pressure (kg/cm²) × Ram Area (cm²) / 1000`
- Average settlement: Mean of enabled dial gauges only
- All dates: dd/mm/yyyy format (Indian standard)

### III. Data Integrity First

Data MUST be accurate and traceable.
- Auto-save on every change (no data loss)
- Calculations MUST match manual IS 2911 verification 100%
- Source files attached to reports for audit trail
- Confidence scores for AI extractions
- Human review required before approval

### IV. Progressive Enhancement

Start simple, add complexity only when proven necessary.
- Manual entry is the baseline (always works)
- Ingestion auto-fills existing forms (enhancement)
- Verification suggests corrections (enhancement)
- Auto-correction applies only with high confidence (>90%)
- User approval is ALWAYS required before finalizing

### V. Extend, Don't Rebuild

New features MUST integrate with existing UI and patterns.
- Use existing components: `project-details.tsx`, `data-entry.tsx`, `report-view.tsx`
- Use existing store: Zustand with localStorage persistence
- Use existing patterns: kebab-case files, "why" comments, Tailwind + slate/blue palette
- No new frameworks without explicit justification

## Technology Constraints

### Stack (Locked)
- **Frontend**: Next.js 14 (App Router), TypeScript 5+, Tailwind CSS
- **State**: Zustand with localStorage persistence
- **Charts**: Chart.js + react-chartjs-2
- **PDF**: Playwright for generation
- **Storage**: Supabase (PostgreSQL + Storage)
- **AI**: OpenAI SDK / Anthropic SDK for extraction and verification

### Forbidden Without Justification
- Additional CSS frameworks (shadcn/ui is allowed as component library)
- Additional state management libraries
- Client-side PDF generation libraries (use Playwright server-side)
- Heavy UI frameworks (Material UI, Ant Design, etc.)

## Quality Gates

### Before Merge
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] IS 2911 calculations verified against manual calculation
- [ ] Mobile-responsive (tested on 375px width)
- [ ] Accessible (keyboard navigation, screen reader labels)

### Before Release
- [ ] End-to-end test: Upload → Extract → Generate → Verify → Approve
- [ ] PDF output matches reference report structure
- [ ] Performance: Report generation < 30 seconds
- [ ] Data persists across sessions

## Governance

- This constitution supersedes ad-hoc decisions
- Amendments require explicit documentation and rationale
- IS 2911 compliance is NEVER negotiable
- User approval is ALWAYS required before finalizing reports

**Version**: 1.0.0 | **Ratified**: 2024-12-17 | **Last Amended**: 2024-12-17
