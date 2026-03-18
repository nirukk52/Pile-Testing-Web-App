# MCP Tools Reference

Complete parameter schemas for the PileTest MCP server tools.

## ingest_file

Extracts structured data from a pile load test document using AI vision.

```
Input:
  filePath: string        — absolute path to the file
  fileType: string        — "pdf" | "xlsx" | "image"
  templateName?: string   — optional template to merge defaults from

Output:
  projectInfo: {
    projectName, clientName, consultantName, contractorName,
    reportNo, testDate, pileNo, pileType, pileDiaMm, pileDepthM,
    concreteGrade, designLoadT, testLoadT, cutOffLevel,
    testType, hammerType, testLocation
  }
  readings: Array<{
    pressureKgCm2, loadMT, dg1Mm, dg2Mm, dg3Mm, dg4Mm,
    avgSettlementMm, phase, holdDurationMin, timestamp
  }>
  confidence: Record<string, number>   — per-field confidence 0-1
  warnings: string[]
```

## validate_test

Runs IS 2911 acceptance checks against stored test data.

```
Input:
  testId: string          — UUID of the test record

Output:
  passed: boolean
  testType: string
  maxLoadT: number
  maxSettlementMm: number
  netSettlementMm: number
  elasticReboundMm: number
  safeLoadT?: number            — null for RVPLT
  settlementLimitMm: number
  criterion: string             — governing criterion description
  failures: string[]            — list of failed checks
```

## generate_report

Generates a PDF report from stored test data.

```
Input:
  testId: string          — UUID of the test record
  themeId?: string        — optional theme override

Output:
  pdfPath: string         — path to generated PDF file
  pageCount: number
  reportLabel: string     — e.g. "IVPLT Report", "Lateral Report"
```

## get_test

Fetches full test data including project info, readings, and attachments.

```
Input:
  testId: string          — UUID of the test record

Output:
  test: {
    id, projectId, testType, status, createdAt, updatedAt,
    project: { ...projectInfo },
    readings: Array<{ ...readingFields }>,
    siteImages: Array<{ id, url, caption }>,
    certificates: Array<{ id, url, name }>,
    fieldReadings: Array<{ id, url }>
  }
```

## store_file

Uploads a file and associates it with a test.

```
Input:
  testId: string          — UUID of the test record
  filePath: string        — absolute path to the file
  fileCategory: string    — "site-image" | "certificate" | "field-reading" | "source-file"
  caption?: string        — optional caption for images

Output:
  fileId: string          — UUID of the stored file record
  url: string             — storage URL
```

## attach_file

Links an already-uploaded file to a test record.

```
Input:
  testId: string          — UUID of the test record
  fileId: string          — UUID of the file to attach
  attachmentType: string  — "site-image" | "certificate" | "field-reading"

Output:
  success: boolean
```

## save_template

Saves project defaults as a reusable template.

```
Input:
  name: string            — template name (e.g. "DNR-Pune-M30")
  templateData: {
    projectName?, clientName?, consultantName?, contractorName?,
    concreteGrade?, pileType?, testType?, ...any projectInfo field
  }

Output:
  templateId: string
  name: string
```

## apply_template

Applies a saved template's defaults to a test before or during ingestion.

```
Input:
  templateName: string    — name of the saved template
  testId?: string         — optional test to apply to immediately

Output:
  appliedFields: string[] — list of field names that were set from template
  templateData: object    — the template's stored defaults
```
