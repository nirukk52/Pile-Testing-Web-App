# Pile Load Test Report Structure

Professional report structure for IS 2911-compliant pile load test reports.

## Table of Contents
1. [Report Sections](#report-sections)
2. [Cover Page](#1-cover-page)
3. [Table of Contents](#2-table-of-contents)
4. [General Section](#3-general)
5. [Scope of Work](#4-scope-of-work)
6. [Methodology](#5-methodology)
   - [Load Increment Summary](#54-load-increment-summary-section-34)
7. [Results](#6-results)
8. [Load Settlement Curve](#7-load-settlement-curve)
9. [Conclusion](#8-conclusion)
10. [Data Tables](#9-data-tables)
11. [Annexures](#10-annexures)

---

## Report Sections

Standard IS 2911 report contains these sections:

| Section | Title | Page Break |
|---------|-------|------------|
| Cover | Title & Project Info | Yes |
| TOC | Contents | Yes |
| 1.0 | General | Yes |
| 2.0 | Scope of Work | No |
| 3.0 | Methodology | Yes |
| 3.4 | Load Increment Summary | Yes |
| 4.0 | Results | Yes |
| 5.0 | Load vs Settlement Curve | Yes |
| 6.0 | Conclusion | No |
| 7.0 | Load Test Data | Yes |
| 8.0 | Site Images | Optional |
| - | Signature Page | Yes |
| A | Calibration Certificates | Yes |

---

## 1. Cover Page

### Required Elements

```html
<cover>
  <test_type>INITIAL STATIC VERTICAL PILE LOAD TEST</test_type>
  <pile_info>ON {diameter}mm DIA PILE</pile_info>
  <project>FOR {project_name}</project>
  <location>AT {location}</location>
  <pile_id>(TEST PILE {pile_id})</pile_id>
  
  <image>Site photograph</image>
  
  <client>CLIENT: {client_name}</client>
  <contractor>CONTRACTOR: {contractor_name}</contractor>
  <pmc>PMC: {pmc_name}</pmc>
  <test_date>TEST DATE: {formatted_date}</test_date>
  <report_no>REPORT NO: {report_number}</report_no>
  
  <badge>Test conducted as per IS 2911 (Part 4) - 2013</badge>
</cover>
```

### Styling

- Title: 22pt, Blue (#1e40af), uppercase
- Project: 14pt, Dark slate (#334155)
- Info fields: 11pt, left-aligned
- Badge: Border, centered

---

## 2. Table of Contents

### Structure

```
CONTENTS

1.0 General
2.0 Scope of Work  
3.0 Methodology
4.0 Results
5.0 Readings and Graph
6.0 Conclusion
7.0 Load Test Data
8.0 Site Images (if applicable)
A.  Calibration Certificates
```

Can include TOC image (second site photo).

---

## 3. General

### Standard Text Template

```
1.0 GENERAL

1.1 {client} decided to carry out static pile testing work on {diameter}mm 
diameter pile to estimate load carrying capacity in vertical direction and 
settlement. This is the Initial Vertical Pile Load Test at {location}.

1.2 This report covers data for one vertical pile load test. This report 
covers calculation of safe load capacity for pile based on data collected 
during fieldwork.

1.3 The following codes of practices have been adopted:
• IS 2911 (Part 4) - 2013 "Code of Practice for Design and Construction 
  of Pile Foundations - Load Tests on Piles"
• IS 14593 - 1998 (Reaffirmed 2003) "Design and Construction of Bored 
  Cast-in-Situ Piles Founded on Rocks – Guidelines"
```

---

## 4. Scope of Work

### 4.1 Pile Details Table

| Field | Value |
|-------|-------|
| Location | {location} |
| Pile ID | {pile_id} |
| Pile Diameter | {diameter} mm |
| Pile Depth | {depth} m |
| Concrete Grade | {concrete_grade} |
| Maximum Vertical Safe Capacity | {design_load} MT |

### 4.2 Test Load Statement

```
The design vertical load on the pile is {design_load} MT.
The pile is required to be tested to a load of {test_load} MT 
({multiplier}× design load).
```

### 4.3 Equipment Details Table

| Field | Value |
|-------|-------|
| Hydraulic Jack | {jack_name} |
| Ram Area | {ram_area} cm² |
| Dial Gauge Least Count | {least_count} mm |

---

## 5. Methodology

### Standard Text Template

```
3.0 METHODOLOGY

The Initial Vertical Pile Load Test was conducted in accordance with 
IS 2911 (Part 4) - 2013.

3.1 Test Setup
A hydraulic jack of adequate capacity was used to apply the load, 
reacting against a sturdy reaction frame. Four dial gauges ({least_count}mm 
least count) were fixed on the pile head to record settlements.

3.2 Test Procedure
1. Load was applied in increments of approximately 20% of design load 
   ({20pct_load} MT) up to the test load of {test_load} MT.
2. Each load increment was maintained until the rate of settlement was 
   less than 0.1mm/hour, or for a minimum of 1 hour.
3. Maximum load was maintained for 24 hours as per IS 2911 requirements 
   for initial tests.
4. Load was released in the same increments as the loading phase.
5. Settlement readings were recorded at each load increment using four 
   dial gauges positioned at 90° intervals.

3.3 Acceptance Criteria (IS 2911 Part 4)
As per IS 2911 (Part 4) - 2013:
• Net settlement at design load shall not exceed 12mm or 2% of pile 
  diameter ({2pct_dia}mm), whichever is less.
• Safe load shall be taken as two-thirds of the load at which total 
  settlement equals 12mm.
• Safe load shall not exceed half the load at which total settlement 
  equals 10% of pile diameter ({10pct_dia}mm).
```

### 5.4 Load Increment Summary (Section 3.4)

New subsection showing the planned load sequence for the test.

#### Summary Info Box

| Parameter | Value |
|-----------|-------|
| Jack Ram Area | {ram_area} cm² |
| Design Load | {design_load} MT |
| Test Load (2.5× Design) | {test_load} MT |
| Load Increment (20% of Design) | {20pct_load} MT |

> Note: As the least count of the pressure gauge is limited, exact incremental loads may not be attained. Hence, values close to the incremental load are considered.

#### Table 1 – Load Sequence

The sequence of loading and unloading for IVPLT on {diameter}mm Dia Pile ({design_load} MT Design Load).

| Sr. No. | Pressure (kg/cm²) | Load (MT) | Reading Time |
|---------|-------------------|-----------|--------------|
| **LOADING PHASE** ||||
| 1 | 0 | 0.00 | 0 |
| 2 | {p1} | {20% load} | 1, 15, 30, 45, 60 mins |
| 3 | {p2} | {40% load} | 1, 15, 30, 45, 60 mins |
| ... | ... | ... | ... |
| n | {pn} | {test_load} | 24 hours (1440 mins) |
| **UNLOADING PHASE** ||||
| n+1 | {pn-1} | {test - 20%} | 1, 5, 15 mins |
| ... | ... | ... | 1, 5, 15 mins |
| final | 0 | 0.00 | 1, 5, 15 mins |

#### Styling

- **Loading rows**: Default row color
- **Max hold row**: Yellow/amber highlight (#fef3c7)
- **Unloading rows**: Light green (#ecfdf5)
- **Section headers**: Dark slate (#334155) with white text

---

## 6. Results

### 6.1 Results Summary Table

| Metric | Value |
|--------|-------|
| Maximum Settlement Recorded | {max_settlement} mm |
| Elastic Rebound | {elastic_rebound} mm |
| Net Settlement | {net_settlement} mm |
| Settlement Limit (IS 2911) | {settlement_limit} mm |
| Safe Load Adopted | {safe_load} MT |
| Governing Criterion | {criterion} |
| Test Status | {PASSED/FAILED} |

### 6.2 Assessment Text

```
The net settlement of {net_settlement} mm is {within/exceeding} the 
permissible limit of {settlement_limit} mm as per IS 2911 (Part 4) - 2013.

The safe load adopted for the pile is {safe_load} MT based on the 
{criterion} criterion.
```

---

## 7. Load Settlement Curve

### Chart Requirements

- **Size**: Full page width, ~400px height
- **X-axis**: Load (MT), starting at 0
- **Y-axis**: Settlement (mm), **inverted** (0 at top)
- **Curves**: 
  - Loading (blue #2563eb)
  - Holding (amber #f59e0b)  
  - Unloading (green #10b981)

### KPI Cards (3 across)

| Label | Value | Unit |
|-------|-------|------|
| Test Load | {test_load} | MT |
| Max Settlement | {max_settlement} | mm |
| Net Settlement | {net_settlement} | mm |

### Summary Box

```
TEST {PASSED ✓ / FAILED ✗}
Net settlement {value}mm is {within/exceeding} the {limit}mm limit 
(IS 2911 Part 4)
```

Color: Green for PASS, Red for FAIL.

---

## 8. Conclusion

### Standard Conclusion Structure

```
6.0 CONCLUSION

Based on the Initial Vertical Pile Load Test conducted on pile {pile_id} 
at {location}, the following observations and conclusions are drawn:

1. The pile was loaded up to {test_load} MT (2.5 times the design load 
   of {design_load} MT) as per IS 2911 (Part 4) - 2013.

2. The maximum settlement recorded at test load was {max_settlement} mm.

3. After complete unloading, the elastic rebound was {elastic_rebound} mm.

4. The net settlement (residual) is {net_settlement} mm, which is 
   {within/exceeding} the permissible limit of {settlement_limit} mm.

5. The safe load adopted for the pile is {safe_load} MT based on the 
   {criterion} criterion.

6. The pile {HAS PASSED / HAS FAILED} the Initial Vertical Pile Load Test 
   as per IS 2911 (Part 4) - 2013.

[If PASSED:]
Therefore, the design safe load of {design_load} MT can be adopted as the 
working load capacity for this pile.

[If FAILED:]
Further investigation and remedial measures are recommended before 
adopting the design load.
```

---

## 9. Data Tables

### Load Test Data Table

| Column | Width | Alignment |
|--------|-------|-----------|
| S.No | 5% | Center |
| Date | 10% | Center |
| Time | 8% | Center |
| Pressure (kg/cm²) | 10% | Right |
| Load (MT) | 10% | Right |
| DG1 (mm) | 8% | Right |
| DG2 (mm) | 8% | Right |
| DG3 (mm) | 8% | Right |
| DG4 (mm) | 8% | Right |
| Avg (mm) | 8% | Right |
| Phase | 8% | Center |
| Remark | 9% | Left |

### Phase Styling

- LOADING: Blue (#2563eb)
- HOLD: Amber (#d97706)
- UNLOADING: Green (#16a34a)

---

## 10. Annexures

### Site Images (8.0)

- Grid: 2×2 layout
- Image size: ~200px height
- Caption below each image
- Numbered: Image 1, Image 2, etc.

### Calibration Certificates (Annex A)

- Append as separate PDF pages
- Types: Jack calibration, Pressure gauge, Dial gauges
- Include validity period

### Signature Page

```
Signature Section:

Prepared by: ________________    Checked by: ________________
             Site Engineer                   Quality Engineer

Reviewed by: ________________    Approved by: ________________
             Project Manager                 Client Representative
```

---

## PDF Generation Settings

| Setting | Value |
|---------|-------|
| Page Size | A4 (210 × 297 mm) |
| Margins | 20mm top/bottom, 15mm left/right |
| Font | Segoe UI, Tahoma, sans-serif |
| Body Size | 11pt |
| Header Size | 9pt |
| Footer | Page X of Y |
| Print Background | Yes |
