# PileTest Pro — User-Facing Application Requirements

> **Purpose:** Define the complete user experience from uploading field images to generating IS 2911-compliant pile load test reports.

---

## 1. Application Overview

**PileTest Pro** enables site engineers to convert handwritten pile load test field sheets into professional engineering reports in minutes instead of hours.

### Target Users
- Site Engineers at construction sites
- Quality Control Engineers
- Civil Engineering Consultants
- Project Managers reviewing test results

### Core Value Proposition
| Manual Process | With PileTest Pro |
|----------------|-------------------|
| 2-4 hours per report | 10-15 minutes per report |
| Prone to transcription errors | Validated extraction with confidence scores |
| Inconsistent formatting | IS 2911-compliant standardized reports |

---

## 2. User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [1. UPLOAD]  →  [2. VERIFY]  →  [3. REPORT]  →  [4. EXPORT]               │
│                                                                             │
│  • Photos/PDFs      • Review extracted    • View dashboard    • Download    │
│  • Select test type   data               • Charts & KPIs     • Share       │
│  • Basic metadata   • Edit errors        • Pass/Fail status  • Print       │
│                     • Confirm specs                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Screen 1: Upload

### 3.1 User Goals
- Quickly upload field sheet photos
- Select the correct test type
- Provide basic project information

### 3.2 Functional Requirements

#### File Upload
| Requirement | Details |
|-------------|---------|
| Supported formats | PNG, JPEG, JPG, PDF |
| File size limit | Up to 10 MB per file |
| Multi-file upload | 1-5 images per test |
| Upload methods | Drag & drop, Click to browse, Mobile camera capture |

#### Test Type Selection
User MUST select one test type before proceeding:

| Test Type | Display Name | Description |
|-----------|--------------|-------------|
| `IVPLT` | Initial Vertical Pile Load Test | First test on pile, 2.5x design load |
| `RVPLT` | Routine Vertical Pile Load Test | Production piles, 1.5x design load |
| `PULLOUT` | Pullout / Uplift Test | Tests uplift capacity |
| `LATERAL` | Lateral Load Test | Tests horizontal resistance |

**UI Behavior:**
- Test type shown as radio buttons or cards
- Brief description visible for each type
- Selection required before "Extract" button is enabled

#### Optional Metadata Entry
These fields are optional at upload (can be edited in Verify screen):
- Project Name
- Location
- Client Name
- Pile ID / Test Pile Number
- Engineer Name

### 3.3 User Actions
| Action | Behavior |
|--------|----------|
| Drop files | Files appear in preview list with thumbnails |
| Remove file | Click X to remove from queue |
| Select test type | One selection persists |
| Click "Extract Data" | Sends to OCR, shows loading state, navigates to Verify |

### 3.4 Edge Cases

| Scenario | Behavior |
|----------|----------|
| User uploads non-image file (e.g., .docx) | Show error: "Unsupported file type. Please upload PNG, JPEG, or PDF." |
| User uploads > 5 files | Show warning: "Maximum 5 files per test. Extra files will be ignored." |
| User uploads 0 files | "Extract" button disabled |
| File upload fails mid-way | Show retry option for failed file only |
| User navigates away during upload | Confirm dialog: "Upload in progress. Are you sure you want to leave?" |
| Very large PDF (multi-page) | Extract only first 5 pages, show info message |
| Blurry/dark image detected | Proceed but warn: "Image quality may affect extraction accuracy" |

---

## 4. Screen 2: Verify & Edit

### 4.1 User Goals
- Review extracted data against original images
- Correct any OCR errors
- Confirm pile specifications
- Proceed only when data is accurate

### 4.2 Layout
Split-screen view:
- **Left (60%)**: Original image(s) with zoom/pan
- **Right (40%)**: Extracted data in editable tables

### 4.3 Functional Requirements

#### Image Viewer
| Feature | Description |
|---------|-------------|
| Zoom | Scroll to zoom, pinch on mobile |
| Pan | Click and drag to move |
| Multi-image navigation | Tabs or thumbnails for multiple pages |
| Full-screen mode | Expand image to full screen |

#### Project Info Section
Editable cards for:
- Project Name
- Location  
- Client Name
- Pile ID
- Test Type (locked after extraction, requires restart to change)

#### Technical Specifications Section
Editable fields with validation:

| Field | Validation | Example |
|-------|------------|---------|
| Pile Diameter | Number, 300-2000 mm | 600 mm |
| Pile Depth | Number, 5-100 m | 10.31 m |
| Ram Area | Number, 20-200 cm² | 71.2 cm² |
| Design Load | Number, 10-2000 MT | 147 MT |
| Test Load | Number, 15-5000 MT | 367.5 MT |
| Concrete Grade | String pattern M## | M25 |
| Date of Casting | Valid date | 03/09/2025 |
| Date of Testing | Valid date, after casting | 25/10/2025 |

#### Readings Table
Editable data table with columns varying by test type:

**Vertical Tests (IVPLT, RVPLT, PULLOUT):**
| Column | Editable | Type |
|--------|----------|------|
| Row # | No | Auto |
| Date | Yes | Date |
| Time | Yes | Time (HH:MM) |
| Pressure (kg/cm²) | Yes | Number |
| Load (MT) | Yes | Number |
| Dial 1 (mm) | Yes | Decimal |
| Dial 2 (mm) | Yes | Decimal |
| Dial 3 (mm) | Yes | Decimal |
| Dial 4 (mm) | Yes | Decimal |
| Avg Settlement (mm) | Auto-calculated | Decimal |
| Phase | Yes | Dropdown |
| Confidence | No | Visual indicator |

**Lateral Tests:**
| Column | Editable | Type |
|--------|----------|------|
| Row # | No | Auto |
| Date | Yes | Date |
| Time | Yes | Time |
| Pressure (kg/cm²) | Yes | Number |
| Load (MT) | Yes | Number |
| Test Pile Dial 1 (mm) | Yes | Decimal |
| Test Pile Dial 2 (mm) | Yes | Decimal |
| Reaction Pile Dial 1 (mm) | Yes | Decimal |
| Reaction Pile Dial 2 (mm) | Yes | Decimal |
| Avg Test Deflection | Auto-calculated | Decimal |
| Avg Reaction Deflection | Auto-calculated | Decimal |
| Phase | Yes | Dropdown |
| Confidence | No | Visual indicator |

#### Confidence Indicators
Visual cues for extraction quality:

| Confidence | Visual | Meaning |
|------------|--------|---------|
| ≥ 0.9 | Green | High confidence, likely correct |
| 0.7 - 0.89 | Yellow | Medium confidence, review recommended |
| < 0.7 | Red | Low confidence, manual verification required |

**Behavior:** Low-confidence cells are highlighted and should draw user attention.

#### Table Actions
| Action | Behavior |
|--------|----------|
| Add Row | Insert blank row at end |
| Delete Row | Remove selected row (confirm if >1 row selected) |
| Insert Row Above/Below | Context menu option |
| Copy/Paste | Standard clipboard support |
| Undo/Redo | Ctrl+Z / Ctrl+Y support |

### 4.4 Validation Rules (User-Facing)

These validations run in real-time and show inline warnings:

| Rule | Warning Message |
|------|-----------------|
| Load doesn't match Pressure × Ram Area | "⚠️ Load should be ~{calculated} MT based on pressure and ram area" |
| Time goes backward | "⚠️ Time appears earlier than previous row" |
| Settlement decreases during loading | "⚠️ Settlement typically increases during loading phase" |
| Date format invalid | "Please enter date as DD/MM/YYYY" |
| Required field empty | "This field is required" |
| Test date before casting date | "Test date cannot be before casting date" |

**Note:** Warnings don't block proceeding — user can acknowledge and continue.

### 4.5 User Actions
| Action | Behavior |
|--------|----------|
| Edit any cell | Inline editing, tab to next cell |
| Click "Re-extract" | Re-runs OCR on images (loses current edits) |
| Click "Generate Report" | Validates data, shows any warnings, proceeds to Report |
| Click "Back" | Returns to Upload (warns about losing changes) |

### 4.6 Edge Cases

| Scenario | Behavior |
|----------|----------|
| OCR returns 0 readings | Show message: "No data extracted. Please check image quality and try again." |
| User clears all rows | "Generate Report" disabled until at least 1 row exists |
| Ram Area is 0 or missing | Block proceeding: "Ram Area required for load calculations" |
| User enters text in number field | Show inline error, don't accept input |
| User pastes data from Excel | Parse and populate matching columns |
| Very long table (100+ rows) | Virtualized scrolling, "Jump to row" feature |
| User refreshes page | Persist state in browser storage, restore on reload |
| Session timeout | Auto-save every 30 seconds, recover on return |

---

## 5. Screen 3: Report Dashboard

### 5.1 User Goals
- See at-a-glance test results
- Understand Pass/Fail status
- View Load vs Settlement chart
- Review all data before export

### 5.2 Layout
Professional report view matching IS 2911 standards:

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Project Name | Pile ID | Test Type | Date             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KPI CARDS (4 cards in row):                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Max Load │ │ Final    │ │ Net      │ │ Status   │           │
│  │ 367.5 MT │ │ Settlement│ │ Settlement│ │ ✓ PASS  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│  LOAD vs SETTLEMENT CHART:                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Interactive chart with loading/unloading curves        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  SPECIFICATIONS TABLE | READINGS TABLE                          │
│                                                                 │
│  ATTACHMENTS: Original images                                   │
│                                                                 │
│  [Edit Data] [Export PDF] [Share]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 KPI Cards

| KPI | Calculation | Pass Criteria |
|-----|-------------|---------------|
| Maximum Test Load | Highest load value in readings | N/A (display only) |
| Gross Settlement | Max dial gauge average during test | N/A (display only) |
| Net Settlement | Final reading - Initial reading | ≤ 12mm for vertical tests |
| Test Status | Based on net settlement vs limit | PASS (green) / FAIL (red) |

**Status Determination:**
- **Vertical Tests**: Net settlement ≤ 12mm → PASS
- **Lateral Tests**: Net deflection within specified limit → PASS
- **Pullout Tests**: Net uplift within specified limit → PASS

### 5.4 Load vs Settlement Chart

Interactive chart requirements:
| Feature | Description |
|---------|-------------|
| X-axis | Load (MT) |
| Y-axis | Average Settlement (mm), inverted (0 at top) |
| Data series | Loading curve + Unloading curve |
| Hover | Show exact values at each point |
| Zoom | Click and drag to zoom region |
| Legend | Toggle Loading/Unloading visibility |
| Grid lines | Major and minor grid lines |

### 5.5 Data Tables

**Specifications Table:**
Two-column layout showing all technical specs:
- Pile ID, Diameter, Depth
- Design Load, Test Load
- Concrete Grade, Dates
- Ram Area, Dial Gauge LC

**Readings Table:**
Full data table (read-only view) with:
- Cycle column (loading cycles numbered)
- All time/pressure/load/dial data
- Calculated averages
- Row highlighting for key points (max load, unloading start)

### 5.6 User Actions
| Action | Behavior |
|--------|----------|
| Click "Edit Data" | Returns to Verify screen |
| Click "Export PDF" | Generates and downloads PDF |
| Click "Share" | Generates shareable link (if implemented) |
| Toggle chart series | Show/hide individual curves |
| Hover on chart | Tooltip with exact values |

### 5.7 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Test fails (net settlement > 12mm) | Show FAIL status prominently, but allow export |
| Only loading data (no unloading) | Show single curve, note "Unloading data not recorded" |
| Negative settlement values | Display as-is (indicates pile heave) |
| Chart has 100+ points | Decimate for display, full data in table |
| User has slow connection | Show chart placeholder while loading |

---

## 6. Export & PDF Generation

### 6.1 PDF Requirements

| Aspect | Requirement |
|--------|-------------|
| Page size | A4 (210 × 297 mm) |
| Orientation | Portrait |
| Margins | 1 cm all sides |
| Font | Professional serif/sans-serif |
| Logo | Company logo placeholder (top-left) |
| Page numbers | "Page X of Y" (bottom-right) |

### 6.2 PDF Structure

**Page 1: Cover & Summary**
- Project header
- Test summary table
- KPI cards
- Pass/Fail verdict

**Page 2: Chart**
- Full-page Load vs Settlement chart
- Legend and annotations

**Page 3+: Data Tables**
- Complete readings table
- Specifications
- Continues on additional pages if needed

**Final Page: Attachments**
- Thumbnails of original field sheets
- Notes section

### 6.3 User Actions
| Action | Behavior |
|--------|----------|
| Click "Export PDF" | Shows loading spinner, then triggers download |
| Filename | `{PileID}_{TestType}_{Date}_Report.pdf` |
| Preview before export | Optional: Show PDF preview modal |

### 6.4 Edge Cases

| Scenario | Behavior |
|----------|----------|
| PDF generation fails | Show error with retry option |
| Very long table (100+ rows) | Split across multiple pages |
| Browser blocks download | Show manual download link |
| User wants different format | "Export as Excel" option (future) |

---

## 7. Global Edge Cases & Error Handling

### 7.1 Network & Connectivity

| Scenario | Behavior |
|----------|----------|
| OCR request times out | Show retry button after 60 seconds |
| User goes offline mid-process | Save progress locally, show offline indicator |
| Reconnection | Auto-resume pending operations |
| Server error (500) | Friendly error message with support contact |

### 7.2 Browser & Device

| Scenario | Behavior |
|----------|----------|
| Unsupported browser | Show banner: "For best experience, use Chrome, Firefox, or Safari" |
| Mobile device | Responsive layout, touch-friendly controls |
| Small screen (<768px) | Stack split view vertically |
| No JavaScript | Show static message: "JavaScript required" |

### 7.3 Data Integrity

| Scenario | Behavior |
|----------|----------|
| Duplicate upload | Warn: "This file was already uploaded" |
| Corrupted image | Show error: "Unable to read file. Please try another image." |
| Mixed test types in images | Use selected test type, warn if images appear different |
| Conflicting data across pages | Flag discrepancies for manual review |

### 7.4 Session & State

| Scenario | Behavior |
|----------|----------|
| User closes tab accidentally | Recover state on return (within 24 hours) |
| Multiple tabs open | Warn: "You have another session open" |
| Clear browser data | Data lost, show empty upload screen |
| Import from previous session | Optional: "Continue previous report?" prompt |

---

## 8. Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | All actions accessible via keyboard |
| Screen reader support | Proper ARIA labels on all controls |
| Color contrast | Minimum 4.5:1 ratio for text |
| Focus indicators | Visible focus rings on interactive elements |
| Error announcements | Screen reader announces validation errors |
| Zoom support | UI functional at 200% zoom |

---

## 9. Performance Requirements

| Metric | Target |
|--------|--------|
| Initial page load | < 3 seconds on 3G |
| OCR extraction | < 30 seconds for 3 images |
| Chart render | < 500ms |
| PDF generation | < 10 seconds |
| Table scroll | 60 FPS with 100+ rows |

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| OCR accuracy | > 90% of readings correct on first extraction |
| User correction time | < 5 minutes average on Verify screen |
| Report generation success | > 99% completion rate |
| User satisfaction | > 4.0/5.0 rating |

---

## 11. Out of Scope (Future Phases)

These features are NOT included in MVP:

- User authentication / accounts
- Saving reports to cloud database
- Multi-report management / history
- Approval workflows
- Email/notification system
- Mobile-native app
- Offline OCR processing
- Custom report templates
- Multi-language support
- Batch processing multiple tests

---

## 12. Reference Documents

| Document | Purpose |
|----------|---------|
| `GOOGLE_AI_STUDIO_REQUIREMENTS.md` | OCR extraction technical spec |
| `report.html` | Target PDF/UI design |
| `these-are-the-reports-to-automate/` | Sample output reports |
| `IS 2911 Part 4` | Indian Standard for pile testing |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| MT | Metric Tonnes (unit of load) |
| Ram Area | Cross-sectional area of hydraulic jack piston |
| Settlement | Downward movement of pile under load |
| Net Settlement | Permanent settlement after load removal |
| Dial Gauge | Instrument measuring displacement (0.01mm precision) |
| IS 2911 | Indian Standard for Design and Construction of Pile Foundations |
| Loading Phase | Period when load is being increased |
| Unloading Phase | Period when load is being decreased |
| Holding Phase | Period when load is held constant |





