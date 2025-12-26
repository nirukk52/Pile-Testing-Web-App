# Research: Auto Report Pipeline

**Feature**: 002-auto-report-pipeline  
**Date**: 2024-12-17

---

## 1. Vision API for Handwritten Text Extraction

### Decision: OpenAI GPT-4V (primary), Claude Vision (fallback)

### Rationale
- GPT-4V has strong performance on handwritten text recognition
- Claude Vision is competitive and provides redundancy
- Both support structured output (JSON mode)
- Cost: ~$0.01-0.03 per image (acceptable for <500 reports/month)

### Alternatives Considered
- **Google Cloud Vision**: Good OCR but less semantic understanding
- **AWS Textract**: Table extraction is good, but more complex setup
- **Local OCR (Tesseract)**: Free but poor accuracy on handwritten text

### Implementation Notes
```typescript
// Prompt strategy for extraction
const extractionPrompt = `
You are analyzing a pile load test field sheet. Extract:
1. Project Info (name, location, client, contractor)
2. Pile Specs (diameter, depth, design load, ram area)
3. Readings table (time, pressure, dial gauges 1-4, remarks)

Domain context:
- Pressure increases during LOADING phase
- Settlement values are in mm
- Typical test is 24-48 hours
- Load = Pressure × Ram Area / 1000

Return JSON matching this schema: {...}
`;
```

---

## 2. Excel Parsing

### Decision: `xlsx` npm package

### Rationale
- Pure JavaScript, no native dependencies
- Works in Node.js API routes
- Handles `.xlsx` and `.csv`
- Lightweight (~500KB)

### Alternatives Considered
- **exceljs**: More features but heavier
- **SheetJS Pro**: Paid, unnecessary for our needs
- **Python (openpyxl)**: Would require separate service

### Implementation Notes
```typescript
import * as XLSX from 'xlsx';

function parseExcel(buffer: Buffer): ExtractedData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  // Map columns to schema
  return mapToSchema(data);
}
```

---

## 3. PDF Text/Table Extraction

### Decision: Hybrid approach

| Use Case | Tool | Why |
|----------|------|-----|
| Simple text | `pdf-parse` (Node.js) | Fast, lightweight |
| Tables | `pdfplumber` (Python) | Best table extraction |
| Scanned PDFs | Vision API | OCR needed |

### Rationale
- `pdf-parse` is fast for text-based PDFs
- `pdfplumber` is industry-standard for table extraction
- Python dependency acceptable since we may already use Playwright

### Alternatives Considered
- **pdf.js**: Client-side only, limited table support
- **Tabula**: Java dependency, complex setup
- **Camelot**: Python, good but pdfplumber is simpler

### Implementation Notes
For complex table extraction, call a Python microservice:
```python
# scripts/extract_tables.py
import pdfplumber
import json
import sys

def extract_tables(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        tables = []
        for page in pdf.pages:
            tables.extend(page.extract_tables())
    return tables

if __name__ == '__main__':
    print(json.dumps(extract_tables(sys.argv[1])))
```

---

## 4. Verification Architecture

### Decision: Server-side API route with structured checks

### Rationale
- Verification needs access to generated PDF (server-side)
- Heavy PDF parsing should not block UI
- Can run asynchronously, update status via polling/websocket

### Implementation Notes
```typescript
// Verification pipeline
async function verify(testId: string): Promise<VerificationReport> {
  const rawData = await fetchTestData(testId);
  const pdfContent = await extractPdfContent(testId);
  
  const checks = await Promise.all([
    checkDataIntegrity(rawData, pdfContent),
    checkIS2911Compliance(rawData),
    checkVisualQuality(pdfContent),
  ]);
  
  const score = calculateScore(checks);
  return { testId, score, status: getStatus(score), checks, issues: [] };
}
```

---

## 5. Correction Agent Strategy

### Decision: Rule-based + LLM hybrid

### Rationale
- **Rule-based**: For obvious fixes (unit conversion errors, decimal shifts)
- **LLM**: For semantic corrections (interpreting ambiguous values)
- Confidence scoring determines auto-correct vs. human review

### Implementation Notes
```typescript
interface Correction {
  field: string;
  originalValue: string;
  correctedValue: string;
  confidence: number;  // 0-100
  reason: string;
}

// Auto-correct if confidence > 90
// Flag for review if 50-90
// Skip if < 50
```

---

## 6. Orchestrator State Machine

### Decision: Simple state machine in Zustand store

### States
```
IDLE → UPLOADING → EXTRACTING → REVIEWING → GENERATING → VERIFYING → [CORRECTING] → APPROVED
                                                              ↓
                                                        (loop max 3x)
```

### Rationale
- Zustand already in use for app state
- Simple state machine pattern is maintainable
- No need for complex workflow engines (overkill)

---

## 7. File Storage

### Decision: Supabase Storage

### Rationale
- Already using Supabase for DB
- Built-in CDN, signed URLs
- Easy integration with existing auth (future)

### Bucket Structure
```
pile-test-files/
├── uploads/           # Raw uploaded files
│   └── {testId}/
│       └── {filename}
├── generated/         # Generated PDFs
│   └── {testId}/
│       └── report-v{n}.pdf
└── extractions/       # Intermediate extraction results
    └── {testId}/
        └── extraction.json
```

---

## Summary

| Component | Technology | Risk Level |
|-----------|------------|------------|
| Excel Parsing | `xlsx` | Low |
| PDF Text | `pdf-parse` | Low |
| PDF Tables | `pdfplumber` (Python) | Medium (new dep) |
| Vision OCR | GPT-4V | Low |
| Verification | Custom API route | Low |
| Correction | Rule-based + LLM | Medium |
| Orchestrator | Zustand state machine | Low |
| File Storage | Supabase Storage | Low |

