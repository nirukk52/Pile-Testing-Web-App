# Data Model: Auto Report Pipeline

**Feature**: 002-auto-report-pipeline  
**Date**: 2024-12-17

---

## New Entities

### 1. IngestionJob

Represents a file upload and extraction session.

```typescript
/**
 * Tracks the state of a file upload and data extraction process.
 * Why: Enables async processing and progress tracking for file ingestion.
 */
interface IngestionJob {
  id: string;                          // UUID
  testId: string;                      // FK to SavedTest (null until extraction complete)
  
  // File metadata
  fileName: string;
  fileType: 'pdf' | 'xlsx' | 'csv' | 'docx' | 'image';
  fileUrl: string;                     // Supabase Storage URL
  fileSizeBytes: number;
  
  // Processing state
  status: 'pending' | 'extracting' | 'review' | 'completed' | 'failed';
  extractionMethod: 'excel' | 'pdf-text' | 'pdf-table' | 'vision';
  
  // Extracted data (nullable until extraction complete)
  extractedProjectInfo?: Partial<ProjectInfo>;
  extractedReadings?: ExtractedReading[];
  
  // Confidence and errors
  overallConfidence: number;           // 0-100
  lowConfidenceFields: string[];       // Fields requiring user review
  extractionErrors?: string[];
  
  // Timestamps
  createdAt: string;                   // ISO-8601
  completedAt?: string;
}

/**
 * A reading extracted from uploaded file, with confidence score.
 * Why: Allows user to review and correct low-confidence extractions.
 */
interface ExtractedReading {
  rowIndex: number;
  timestamp?: string;
  pressureGauge: { value: string; confidence: number };
  dialGauge1: { value: string; confidence: number };
  dialGauge2: { value: string; confidence: number };
  dialGauge3: { value: string; confidence: number };
  dialGauge4: { value: string; confidence: number };
  phase?: { value: 'loading' | 'holding' | 'unloading'; confidence: number };
  remark?: { value: string; confidence: number };
}
```

### 2. VerificationReport

Output of the Verification Agent.

```typescript
/**
 * Result of verifying a generated report against raw data and standards.
 * Why: Provides actionable feedback on report quality and compliance.
 */
interface VerificationReport {
  id: string;                          // UUID
  testId: string;                      // FK to SavedTest
  reportVersion: number;               // Which version of the report was verified
  
  // Scoring
  score: number;                       // 0-100
  status: 'pass' | 'warn' | 'fail';    // pass >= 90, warn 80-89, fail < 80
  
  // Individual checks
  checks: {
    dataIntegrity: CheckResult;
    complianceIS2911: CheckResult;
    visualQuality: CheckResult;
  };
  
  // Issues found
  issues: VerificationIssue[];
  
  // Summary
  summary: string;                     // Natural language summary
  
  // Timestamps
  createdAt: string;
}

interface CheckResult {
  passed: boolean;
  score: number;                       // 0-100 for this check
  details?: string;
}

interface VerificationIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'data' | 'compliance' | 'formatting';
  message: string;
  location?: string;                   // e.g., "Page 3, Table 2, Row 5"
  suggestedCorrection?: string;
  correctionConfidence?: number;       // 0-100
}
```

### 3. CorrectionLog

Tracks each correction attempt.

```typescript
/**
 * Records a correction made by the Correction Agent.
 * Why: Audit trail for all automated changes, enables rollback if needed.
 */
interface CorrectionLog {
  id: string;                          // UUID
  testId: string;                      // FK to SavedTest
  verificationReportId: string;        // FK to VerificationReport that triggered this
  
  // What was corrected
  issueId: string;                     // FK to VerificationIssue
  field: string;                       // e.g., "readings[5].dialGauge1"
  originalValue: string;
  correctedValue: string;
  
  // Confidence and approval
  confidence: number;                  // 0-100
  autoApplied: boolean;                // true if confidence > 90
  userApproved?: boolean;              // true if user confirmed
  
  // Result
  resultedInImprovement: boolean;      // Did score improve after this correction?
  
  // Timestamps
  createdAt: string;
  appliedAt?: string;
}
```

---

## Extended Existing Entities

### SavedTest (extensions)

```typescript
interface SavedTest {
  // ... existing fields ...
  
  // NEW: Ingestion tracking
  ingestionJobId?: string;             // FK to IngestionJob (if created from upload)
  sourceFile?: {
    name: string;
    url: string;
    type: 'pdf' | 'excel' | 'image' | 'manual';
  };
  
  // NEW: Verification status
  verificationStatus: 'pending' | 'verified' | 'failed' | 'approved';
  latestVerificationId?: string;       // FK to VerificationReport
  verificationScore?: number;          // Cached from latest verification
  
  // NEW: Approval tracking
  approvedAt?: string;
  approvedBy?: string;                 // User ID (future)
}
```

---

## State Transitions

### IngestionJob States

```
pending → extracting → review → completed
              ↓                    ↓
           failed              (testId linked)
```

### SavedTest Verification States

```
pending → verified → approved
    ↓         ↓
  failed   (corrections applied, re-verify)
    ↑         ↓
    └─────────┘ (max 3 loops)
```

---

## Database Schema (Prisma)

```prisma
model IngestionJob {
  id                  String   @id @default(uuid())
  testId              String?  @unique
  test                Test?    @relation(fields: [testId], references: [id])
  
  fileName            String
  fileType            String
  fileUrl             String
  fileSizeBytes       Int
  
  status              String   @default("pending")
  extractionMethod    String?
  
  extractedData       Json?    // ProjectInfo + Readings
  overallConfidence   Float?
  lowConfidenceFields String[]
  extractionErrors    String[]
  
  createdAt           DateTime @default(now())
  completedAt         DateTime?
}

model VerificationReport {
  id              String   @id @default(uuid())
  testId          String
  test            Test     @relation(fields: [testId], references: [id])
  reportVersion   Int
  
  score           Float
  status          String
  checks          Json
  issues          Json
  summary         String
  
  createdAt       DateTime @default(now())
  
  corrections     CorrectionLog[]
}

model CorrectionLog {
  id                      String   @id @default(uuid())
  testId                  String
  verificationReportId    String
  verificationReport      VerificationReport @relation(fields: [verificationReportId], references: [id])
  
  issueId                 String
  field                   String
  originalValue           String
  correctedValue          String
  confidence              Float
  autoApplied             Boolean
  userApproved            Boolean?
  resultedInImprovement   Boolean?
  
  createdAt               DateTime @default(now())
  appliedAt               DateTime?
}
```

---

## Relationships

```
IngestionJob 1──1 SavedTest
SavedTest 1──* VerificationReport
VerificationReport 1──* CorrectionLog
```

