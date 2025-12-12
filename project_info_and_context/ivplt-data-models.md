Here’s a clean E2E shape just for IVPLT, keeping it tight.

1. Core domain models (conceptual)
Project

id – string (UUID)

name – string

clientName – string

contractorName – string

siteLocation – string

createdAt – datetime

Pile (Test Pile)

id – string

projectId – FK → Project

pileId – string (TP-04 etc.)

pileDiameterMm – number

pileDepthM – number

concreteGrade – string

designLoadT – number

testType – enum: "IVPLT" (later "RVPLT" | "Lateral" | "Uplift") 

Pile Load Test Report Generator…

Jack / Calibration

id – string

jackName – string

ramAreaCm2 – number

calibrationDate – date

calibrationValidTill – date (optional) 

Pile Load Test Report Generator…

IVPLT Test Instance

(one per pile test run)

id – string

projectId – FK

pileId – FK

testType – "IVPLT"

designLoadT – number

requiredTestLoadT – number (2.5 × design) 

Pile Load Test Report Generator…

plannedMaxTestLoadT – number

actualMaxTestLoadT – number (filled after readings)

jackId – FK

dialGaugeLeastCountMm – number

testDate – date

status – enum: "draft" | "in_progress" | "completed" | "reported"

IVPLT Reading (matches your “Add New Reading” UI)

id – string

testId – FK → IVPLT Test

sequenceNumber – integer (1,2,3…)

phase – enum "Loading" | "Hold" | "Unloading" (optional MVP) 

Pile Load Test Report Generator…

dateTime – datetime

pressureKgCm2 – number

loadT – number (computed from pressure × ram area / 1000) 

Pile Load Test Report Generator…

r1Mm – number

r2Mm – number

r3Mm – number

r4Mm – number

g1Enabled/g2Enabled/g3Enabled/g4Enabled – boolean (for faulty gauges) 

Pile Load Test Report Generator…

avgSettlementMm – number (computed) 

Pile Load Test Report Generator…

remark – string (optional; “loading 0.5DL”, “unload” etc.)

Computed IVPLT Result / Report Snapshot

id – string

testId – FK

maxSettlementMm – number

elasticReboundMm – number

netSettlementMm – number 

Developer Guidelines for Automa…

loadAt12mmT – number (from interpolation) 

Pile Load Test Report Generator…

safeLoadFrom12mmT – number (2/3 × loadAt12mm)

loadAt10pcDiaT – number (if reached / interpolated)

safeLoadFrom10pcDiaT – number (0.5 × loadAt10pcDia) 

Pile Load Test Report Generator…

governingCriterion – enum "settlement_12mm" | "ultimate_10pcDia"

safeLoadAdoptedT – number

passesDesignLoad – boolean

conclusionText – string (IS-style sentence) 

Developer Guidelines for Automa…

generatedAt – datetime

reportJson – JSON (full structured report, see below)

2. JSON structures
2.1 IVPLT test + metadata (internal app JSON)
{
  "id": "ivplt_001",
  "testType": "IVPLT",
  "project": {
    "id": "proj_001",
    "name": "97 MLD STP, Agartakli",
    "clientName": "XYZ Corp",
    "contractorName": "ABC Infra",
    "siteLocation": "Nasik"
  },
  "pile": {
    "id": "pile_TP-04",
    "pileId": "TP-04",
    "pileDiameterMm": 600,
    "pileDepthM": 7.5,
    "concreteGrade": "M25",
    "designLoadT": 147
  },
  "testConfig": {
    "requiredTestLoadT": 367.5,
    "plannedMaxTestLoadT": 367.5,
    "dialGaugeLeastCountMm": 0.01,
    "jack": {
      "id": "jack_01",
      "ramAreaCm2": 2251.0
    },
    "testDate": "2025-12-11"
  }
}


(Shape follows the IVPLT “scopeOfWork.pileDetails” and header info. 

Developer Guidelines for Automa…

)

2.2 Reading row JSON (from your “Add New Reading” screen)
{
  "id": "read_012",
  "testId": "ivplt_001",
  "sequenceNumber": 12,
  "phase": "Loading",
  "dateTime": "2025-12-11T23:58:00+05:30",
  "pressureKgCm2": 50.0,
  "loadT": 112.6,
  "r1Mm": 3.78,
  "r2Mm": 3.92,
  "r3Mm": 3.84,
  "r4Mm": 3.90,
  "g1Enabled": true,
  "g2Enabled": true,
  "g3Enabled": true,
  "g4Enabled": true,
  "avgSettlementMm": 3.86,
  "remark": "Load ≈ 0.75 × DL"
}

2.3 Final report JSON (output to report generator)

Reuse the IVPLT stub from the guidelines, trimmed:

{
  "testType": "IVPLT",
  "general": "Clients decided to carry out a static vertical pile load test on a 600 mm diameter pile to estimate its load carrying capacity and settlement.",
  "scopeOfWork": {
    "pileDetails": {
      "location": "AGARTAKLI 97 MLD STP",
      "pileDiameter_mm": 600,
      "pileDepth_m": 7.5,
      "concreteGrade": "M25",
      "designLoad_T": 147,
      "testLoad_T": 367.5
    }
  },
  "methodology": "The load testing on piles was conducted as per IS:2911 (Part 4) – 2013...",
  "results": {
    "acceptanceCriteria": [
      "Two-thirds of load at 12 mm total settlement or 2% diameter (whichever is less)",
      "50% of load at 10% pile diameter (settlement = 60 mm)"
    ],
    "maxSettlement_mm": 9.88,
    "elasticRebound_mm": 2.36,
    "netSettlement_mm": 7.52,
    "safeLoadAdopted_T": 147,
    "conclusion": "As per the test data and graph, the test pile showed higher capacity than the 147 T design load. Therefore, 147 T is adopted as the safe vertical load for the working piles."
  },
  "readingsAndGraphs": {
    "loadSettlementTable": [ /* array of reading rows */ ],
    "graph": {
      "title": "Load vs Settlement Curve",
      "xAxis": "Settlement (mm)",
      "yAxis": "Load (T)",
      "dataPoints": [ [0,0], [0.37,38.3], [0.71,76.5] ]
    }
  }
}


This is exactly the structure in the guideline doc. 

Developer Guidelines for Automa…

3. Database tables (relational; e.g., Postgres / SQLite)

Based on the spec’s suggested schema for Projects / Test_Piles / Readings / Calibration_Data. 

Pile Load Test Report Generator…

projects

id PK

name

client_name

contractor_name

site_location

created_at

piles

id PK

project_id FK → projects.id

pile_code (TP-04 etc.)

diameter_mm

depth_m

concrete_grade

design_load_t

ivplt_tests

id PK

project_id FK

pile_id FK

test_type (enum: IVPLT)

design_load_t

required_test_load_t

planned_max_test_load_t

actual_max_test_load_t

jack_id FK

dial_lc_mm

test_date

status

calibration_data (jacks)

id PK

jack_name

ram_area_cm2

calibration_date

valid_till

readings

id PK

test_id FK → ivplt_tests.id

sequence_no

phase

timestamp

pressure_kg_cm2

load_t

dg1_mm

dg2_mm

dg3_mm

dg4_mm

g1_enabled … g4_enabled

avg_settlement_mm

remark

ivplt_results

id PK

test_id FK

max_settlement_mm

elastic_rebound_mm

net_settlement_mm

load_at_12mm_t

safe_from_12mm_t

load_at_10pcD_t

safe_from_10pcD_t

governing_criterion

safe_load_adopted_t

passes_design (bool)

conclusion_text

report_json (JSONB)

generated_at