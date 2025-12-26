# PileTest Pro

> Mobile-first pile load test data entry, intelligent ingestion, and IS 2911-compliant report generation.

---

## Problem Statement

The current pile load testing workflow is **manual, slow, and error-prone**. Site engineers often have to manually copy data from handwritten logs, Excel sheets, or various legacy file formats into reports. This leads to:

1.  **Data Silos**: Valuable data locked in paper or isolated files.
2.  **Transcription Errors**: Mistakes during manual entry.
3.  **Compliance Risks**: Reports that may not fully adhere to IS 2911 standards.
4.  **Inefficiency**: 4-8 hours to produce a single report.

---

## Solution: The "Geotech Engineer Bot"

PileTest Pro is evolving into an intelligent assistant for geotechnical engineers.

**Core Capabilities:**
1.  **Universal Ingestion**: Upload PDF scans, Excel sheets, Word docs, or images. The system intelligently extracts project info and readings.
2.  **Automated Verification**: An AI agent verifies the generated report against the raw input data to ensure integrity and compliance.
3.  **Instant Reports**: Professional PDF generation on-site.

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   📥 INGEST   │ ──▶ │   ✅ VERIFY   │ ──▶ │   📊 REPORT   │ ──▶ │   🏁 DONE     │
│               │     │               │     │               │     │               │
│ Upload Any    │     │ AI checks     │     │ IS 2911       │     │ PDF Export    │
│ File/Format   │     │ data accuracy │     │ Compliant     │     │               │
└───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
```

---

## Roadmap

### Phase 1: Manual Data Entry MVP (Completed)
- [x] Home screen with test list
- [x] Manual entry forms (Details, Readings)
- [x] Report generation (KPIs, Charts)
- [x] LocalStorage persistence

### Phase 2: Intelligent Ingestion & Verification (Current)
- [ ] **Landing Page**: New entry point marketing the tool.
- [ ] **Universal Ingestion**: Support for PDF, Excel, Word, Image uploads.
- [ ] **Extraction Agent**: AI-powered parsing of unstructured data.
- [ ] **Verification Agent**: Automated QA of generated reports.
- [ ] **Spec**: `specs/002/spec.md` defining the agentic architecture.

### Phase 3: Cloud & Collaboration (Future)
- [ ] Supabase Backend
- [ ] Multi-user roles
- [ ] Project sharing

### Phase 4: Advanced Geotech (Future)
- [ ] Foundation Sizing
- [ ] Seismic Analysis
- [ ] Fence Diagrams

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## License

Private - ZedGeo Engineering Solutions


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     ZedGeo Systems Private Limited., Mumbai                          │
│                                                                                      │
│ RECORD OF PILE LOAD TEST NO: [pileId]          │ L.C OF DIAL GAUGE: [lcDialGauge]   │
│ PROJECT: [project]                              │ TYPE OF TEST: [testType]           │
│                                                 │ DESIGN LOAD: [designLoad]          │
│ LOCATION: [location]                            │ TEST LOAD: [testLoad]              │
│ CLIENTS NAME: [client]                          │ MIXED DESIGN: [concreteGrade]      │
│ CONSULTANT: [consultant]                        │ PILE DIAMETER: [pileDiameter]      │
│ CONTRACTOR: [contractor]                        │                                    │
│                                                 │ RAM AREA: [ramArea]                │
│                                                 │ DATE OF CASTING: [dateOfCasting]   │
│                                                 │ PILE DEPTH: [pileDepth]            │
└─────────────────────────────────────────────────────────────────────────────────────┘

							
ZedGeo Systems Private Limited., Mumbai.							Page:-2
RECORD OF PILE LOAD TEST NO:- .				lc of dial gauge:- 0.01mm		Ram Area :-  	1412.2 cm2
PROJECT:-  L SHYAPE BUILDING				Type of Test:- 	Routine Vertical Pile Load Test	Date of Casting :- 	
						Pile Depth:-	
LOCATION :- 				Design load on pile:- 175MT			
CLIENT:- BMC/BMC				Test Load :- 263 MT			
CONSULTANT:- 				Mixed Design :- M45			
CONTRACTOR:-  RELCONE				Pile Diameter: - mm			






+--------------------------------------------------------------------------------------------------------------------------------------+
| **{companyName}**, {companyCity}                                                                                 **PAGE:- {pageNo}** |
|                                                                                                                                      |
| **RECORD OF PILE LOAD TEST NO.: {testNo}**                                                                                           |
|                                                                                                                                      |
| **PROJECT :- {projectLine1}**                                                                                                        |
| {projectLine2}                                                                                                                       |
|                                                                                                                                      |
| **LOCATION :- {locationLine1}**                                                                                                      |
|                                                                                                                                      |
| **CLIENTS NAME :- {clientName}**                                                                                                     |
| **CONSULTANT :- {consultant}**                                                                                                       |
| **CONTRACTOR :- {contractor}**                                                                                                       |
|                                                                                                                                      |
|                                         **L.C OF DIAL GAUGE:- {lcDialGauge}**                                                        |
|                                         **TYPE OF TEST:- {testType}**                                                                |
|                                         **DESIGN LOAD:- {designLoad}**                                                               |
|                                         **TEST LOAD:- {testLoad}**                                                                   |
|                                         **MIXED DESIGN:- {mixedDesign}**                                                             |
|                                         **PILE DIAMETER:- {pileDiameter}**                                                           |
|                                                                                                                                      |
|                                                                                 **RAM AREA:- {ramArea}**                             |
|                                                                                 **DATE OF CASTING:- {castingDate}**                  |
|                                                                                 **PILE DEPTH:- {pileDepth}**                         |
+--------------------------------------------------------------------------------------------------------------------------------------+
