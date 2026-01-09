# Spec 002: Intelligent Ingestion & Verification

> **Status**: Draft
> **Owner**: AI Agent
> **Date**: 2024-12-17

## 1. Overview

This specification defines the "Intelligent Ingestion & Verification" phase of PileTest Pro. The goal is to transform the application from a manual data entry tool into an intelligent assistant that can ingest data from various sources (PDF, Excel, Word) and automatically verify the accuracy of generated reports.

## 2. User Stories

1.  **As a Site Engineer**, I want to upload a PDF scan of my handwritten field notes so that I don't have to manually type 50+ readings and generate a report.
2.  **As a Manager**, I want to upload an Excel file sent by a sub-contractor to instantly generate a standardized report.
3.  **As a Reviewer**, I want the system to automatically flag if the generated report data differs from the uploaded source file as well as flag reports mismatch compared to test-data.
4.  **As a New User**, I want a clear Landing Page that explains what the tool does and lets me get started quickly.

## 3. Functional Requirements

### 3.1. Landing Page
- **Path**: `/` (New root route)
- **Features**:
    - Hero section with value proposition ("Automated Pile Test Reporting").
    - "Get Started" / "Login" buttons.
    - Feature highlights (Universal Ingestion, IS 2911 Compliance).
    - Footer with links.

### 3.2. Universal Ingestion
- **UI**: A prominent "Upload File" area on the Home/Test creation screen.
- **Supported Formats**:
    - `.pdf` (Scanned field notes, legacy reports)
    - `.xlsx` / `.csv` (Digital logs)
    - `.docx` (Word reports)
    - Images (via OCR/Vision API)
- **Process**:
    1.  User uploads file.
    2.  **Extraction Agent** processes the file.
    3.  System presents extracted data (Project Info, Readings) for confirmation.
    4.  User approves/edits -> Data saved to `TestStore`.

### 3.3. Report Verification Agent
- **Trigger**: When a report is generated/finalized.
- **Input**:
    - The Generated PDF Report.
    - The Raw Source Data (from Store/DB).
- **Process**:
    1.  Agent reads the generated PDF text/tables.
    2.  Compares key values against Raw Data:
        - Project Metadata (Name, Date, Pile ID).
        - Critical Load/Settlement values.
    3.  Checks IS 2911 Compliance (e.g., "Is settlement < 12mm at test load?").
- **Output**: A "Verification Scorecard" displayed to the user (Pass/Fail/Warn).

## 4. Technical Architecture

### 4.1. Extraction Agent
- **Tools**:
    - `pdf-parse` or similar for text extraction.
    - `xlsx` for spreadsheet parsing.
    - OpenAI/Anthropic API for semantic understanding (mapping unstructured text to `ProjectInfo` schema).
- **Logic**:
    - Convert file to text/structured context.
    - Prompt LLM: "Extract pile test data from this text into this JSON schema..."
    - Return JSON.

### 4.2. Verification Agent (`specs/002/verifyer`)
- **Logic**:
    - See `specs/002/verifyer` for detailed scoring logic.
    - Implemented as a server-side action or edge function.

## 5. Implementation Plan

1.  **Landing Page**: Create `app/page.tsx` (move current home to `app/home/page.tsx` or similar, or just update root).
    - *Decision*: Keep app structure simple. Maybe `app/(marketing)/page.tsx` for landing and `app/(app)/...` for the app? For MVP, just update `app/page.tsx` to include a "Landing" mode or component if not logged in/no tests. Or, better, `app/page.tsx` becomes the dashboard, and we add a "New Test from File" feature.
    - *Revised*: The prompt asks for a "Landing Page". We will create a new marketing landing page at `src/components/landing/` and serve it on `/` for visitors.

2.  **Ingestion UI**:
    - Add `FileUploader` component.
    - Add "Import" button on Home Screen.

3.  **Agents**:
    - Implement `src/lib/ai/extraction-agent.ts`.
    - Implement `src/lib/ai/verification-agent.ts`.

## 6. Schema Changes
No major schema changes for `Test` object, but we might add:
```typescript
interface SavedTest {
  // ... existing fields
  sourceFile?: {
    name: string;
    url: string;
    type: 'pdf' | 'excel' | 'image';
  };
  verificationStatus?: 'pending' | 'verified' | 'failed';
  verificationReport?: VerificationResult; // JSON from verifyer
}
```

## 7. Future Considerations
- Batch processing (upload 10 files at once).
- Integration with external sensors/loggers.



