# Quickstart: Auto Report Pipeline

**Feature**: 002-auto-report-pipeline  
**Date**: 2024-12-17

---

## Prerequisites

1. **Node.js 18+** and **npm**
2. **Supabase** account (for storage)
3. **OpenAI API key** (for Vision extraction)
4. **Python 3.9+** (optional, for pdfplumber table extraction)

---

## Setup

### 1. Clone and Install

```bash
cd Pile-Testing-Web-App
npm install
```

### 2. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (for Vision API)
OPENAI_API_KEY=sk-...

# Optional: Anthropic (fallback)
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Supabase Storage Setup

Create a bucket named `pile-test-files` with folders:
- `uploads/`
- `generated/`
- `extractions/`

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Testing the Pipeline

### Story 1: Excel Ingestion (P1)

1. Prepare a sample Excel file with columns:
   - Time, Pressure, DG1, DG2, DG3, DG4, Phase, Remarks

2. Navigate to Home → Click "Start New Test" → Select "Import from File"

3. Upload the Excel file

4. Review extracted data (should show confidence scores)

5. Confirm extraction → Test is created

6. Navigate to Report tab → Click "Generate Report"

7. View verification score (target: ≥ 90)

8. Click "Approve" if satisfied

### Story 2: PDF Scan (P2)

1. Prepare a scanned PDF of handwritten field notes

2. Upload via same "Import from File" flow

3. System uses Vision API → may take 5-10 seconds

4. Review extracted data (low-confidence fields highlighted)

5. Correct any errors → Confirm → Generate → Verify → Approve

### Story 3: Auto-Correction (P2)

1. Intentionally introduce an error (e.g., change "5.2" to "52" in readings)

2. Generate report → Verification will flag as "critical"

3. System suggests correction ("52 → 5.2")

4. Click "Apply Corrections"

5. Report re-generates, score improves

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest` | POST | Upload file, start extraction |
| `/api/ingest/{id}` | GET | Get extraction status |
| `/api/ingest/{id}/confirm` | POST | Confirm extraction, create test |
| `/api/verify/{testId}` | POST | Run verification |
| `/api/verify/{testId}` | GET | Get latest verification report |
| `/api/verify/{testId}/correct` | POST | Apply corrections, re-verify |
| `/api/tests/{testId}/approve` | POST | Approve final report |

---

## Troubleshooting

### "Extraction failed" on PDF upload
- Check if PDF is scanned (needs Vision API) vs. text-based
- Ensure OPENAI_API_KEY is set
- Check file size < 10MB

### Low confidence scores on handwritten notes
- Ensure notes are legible
- Provide more context in extraction prompt
- Consider manual entry for severely damaged documents

### Verification score < 80
- Review issues list for specific problems
- Apply suggested corrections
- If still failing after 3 loops, check raw data manually

---

## Sample Test Data

Located in `project_info_and_context/these-are-the-reports-to-automate/`:
- `Report IVPLT TP-01-900mm (420T)..pdf` - Reference output
- Use this to validate report generation matches expected format

---

## Next Steps

1. Run `/speckit.tasks` to get task breakdown
2. Start with Task 1: Excel parser implementation
3. Use sample data to validate extraction accuracy

