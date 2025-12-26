# Data Model: IVPLT Report Automation

**Branch**: `001-ivplt-report-automation` | **Date**: 2025-12-12

## Overview

This document defines the Prisma schema for Supabase PostgreSQL and the corresponding TypeScript types for the IVPLT Report Automation feature.

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Types of pile load tests supported by the system.
 * Why: Enables Test Type Engine pattern for polymorphic behavior.
 */
enum TestType {
  IVPLT   // Initial Vertical Pile Load Test (2.5x design load, 12mm limit)
  RVPLT   // Routine Vertical Pile Load Test (1.5x design load, 18mm limit)
  LATERAL // Lateral Load Test (2.5x design load, 5mm deflection limit)
  UPLIFT  // Uplift/Pullout Test (2.5x design load, 12mm uplift limit)
}

/**
 * Phases during a pile load test.
 * Why: Readings are grouped by phase for display and graph rendering.
 */
enum TestPhase {
  LOADING   // Incremental loading phase
  HOLD      // 24-hour hold at maximum load
  UNLOADING // Decremental unloading phase
}

/**
 * Status of a test throughout its lifecycle.
 * Why: Controls UI flow and report generation eligibility.
 */
enum TestStatus {
  DRAFT       // Initial state, incomplete data
  IN_PROGRESS // Data entry in progress
  COMPLETED   // All readings entered, ready for report
  REPORTED    // PDF generated and exported
}

/**
 * Types of calibration certificates.
 * Why: Certificates are categorized for proper ordering in final report.
 */
enum CertificateType {
  HYDRAULIC_JACK
  PRESSURE_GAUGE
  DIAL_GAUGE
  PROVING_RING
  OTHER
}

// =============================================================================
// MODELS
// =============================================================================

/**
 * Project-level container for multiple tests.
 * Why: Groups tests by construction project, stores common client/contractor info.
 */
model Project {
  id          String   @id @default(uuid())
  name        String   // Project name
  client      String   // Client organization (e.g., "NMC")
  contractor  String   // Contractor company
  pmc         String?  // Project Management Consultant (optional)
  location    String   // Site location
  
  tests       Test[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

/**
 * A single pile load test instance.
 * Why: Core entity containing pile specs, equipment info, and test state.
 */
model Test {
  id              String     @id @default(uuid())
  projectId       String
  project         Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Test identification
  testType        TestType   @default(IVPLT)
  reportNo        String?    // User-defined report number
  testDate        DateTime   @default(now())
  
  // Pile specifications
  pileId          String     // e.g., "TP-02"
  pileDiameterMm  Float      // Pile diameter in millimeters
  pileDepthM      Float      // Pile depth in meters
  concreteGrade   String     // e.g., "M25", "M35"
  
  // Load specifications
  designLoadT     Float      // Design safe load in metric tons
  testLoadT       Float      // Calculated test load (auto: multiplier × designLoad)
  
  // Equipment specifications
  jackName        String?    // Hydraulic jack identifier
  ramAreaCm2      Float      // Ram area in cm² for load calculation
  gaugeLeastCountMm Float    @default(0.01) // Dial gauge sensitivity
  
  // Test state
  status          TestStatus @default(DRAFT)
  
  // Computed results (cached on report generation)
  maxSettlementMm   Float?
  elasticReboundMm  Float?
  netSettlementMm   Float?
  safeLoadAdoptedT  Float?
  isPassed          Boolean?
  conclusion        String?  @db.Text // AI-generated or user-edited
  
  // Relations
  readings        Reading[]
  siteImages      SiteImage[]
  certificates    CalibrationCertificate[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([projectId])
  @@index([testType])
}

/**
 * A single measurement during the test.
 * Why: Captures time-stamped pressure/settlement data with gauge status.
 */
model Reading {
  id              String    @id @default(uuid())
  testId          String
  test            Test      @relation(fields: [testId], references: [id], onDelete: Cascade)
  
  // Sequence and phase
  sequence        Int       // Reading number (1, 2, 3...)
  phase           TestPhase // LOADING, HOLD, or UNLOADING
  
  // Timestamp
  recordedAt      DateTime  @default(now())
  
  // Pressure and calculated load
  pressureKgCm2   Float     // Raw pressure gauge reading
  loadT           Float     // Calculated: (pressure × ramArea) / 1000
  
  // Dial gauge readings (mm)
  dg1             Float
  dg2             Float
  dg3             Float
  dg4             Float
  
  // Gauge status (true = working, false = faulty)
  dg1Enabled      Boolean   @default(true)
  dg2Enabled      Boolean   @default(true)
  dg3Enabled      Boolean   @default(true)
  dg4Enabled      Boolean   @default(true)
  
  // Computed average (only from enabled gauges)
  avgSettlementMm Float
  
  // Optional remarks
  remark          String?
  
  createdAt       DateTime  @default(now())
  
  @@unique([testId, sequence])
  @@index([testId])
}

/**
 * Site photo attached to a test.
 * Why: Visual documentation of test setup for report inclusion.
 */
model SiteImage {
  id          String   @id @default(uuid())
  testId      String
  test        Test     @relation(fields: [testId], references: [id], onDelete: Cascade)
  
  // Storage reference
  storagePath String   // Supabase Storage path
  fileName    String   // Original filename
  
  // Display
  caption     String?  // Optional caption (max 200 chars)
  displayOrder Int     // For ordering in report (1, 2, 3...)
  
  createdAt   DateTime @default(now())
  
  @@index([testId])
}

/**
 * Calibration certificate PDF attached to a test.
 * Why: Appended to final report for IS 2911 compliance documentation.
 */
model CalibrationCertificate {
  id              String          @id @default(uuid())
  testId          String
  test            Test            @relation(fields: [testId], references: [id], onDelete: Cascade)
  
  // Certificate metadata
  certificateType CertificateType
  storagePath     String          // Supabase Storage path
  fileName        String          // Original filename
  
  createdAt       DateTime        @default(now())
  
  // One certificate per type per test
  @@unique([testId, certificateType])
  @@index([testId])
}

/**
 * User profile for signatures and identification.
 * Why: Stores engineer name for report attribution.
 */
model UserProfile {
  id          String   @id @default(uuid())
  name        String
  email       String?  @unique
  company     String?
  designation String?  // e.g., "Site Engineer"
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## TypeScript Types

```typescript
// src/types/index.ts

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Types of pile load tests supported by the system.
 * Why: Determines which TestEngine to use for calculations and report generation.
 */
export type TestType = 'IVPLT' | 'RVPLT' | 'LATERAL' | 'UPLIFT';

/**
 * Phases during a pile load test.
 * Why: Readings are visually grouped and graphed by phase.
 */
export type TestPhase = 'LOADING' | 'HOLD' | 'UNLOADING';

/**
 * Status of a test throughout its lifecycle.
 * Why: Controls which UI actions are available.
 */
export type TestStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REPORTED';

/**
 * Types of calibration certificates.
 * Why: Certificates are categorized for proper ordering in final report.
 */
export type CertificateType = 
  | 'HYDRAULIC_JACK' 
  | 'PRESSURE_GAUGE' 
  | 'DIAL_GAUGE' 
  | 'PROVING_RING' 
  | 'OTHER';

// =============================================================================
// CORE DOMAIN TYPES
// =============================================================================

/**
 * Project-level info shared across tests.
 * Why: Provides context for report header and title page.
 */
export interface ProjectInfo {
  id: string;
  name: string;
  client: string;
  contractor: string;
  pmc?: string;
  location: string;
}

/**
 * Pile specifications for a test.
 * Why: Essential parameters for IS 2911 calculations.
 */
export interface PileSpecs {
  pileId: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;
}

/**
 * Equipment specifications for a test.
 * Why: Required for load calculation and report methodology section.
 */
export interface EquipmentSpecs {
  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;
}

/**
 * A single test instance combining all data.
 * Why: Main working object for UI and calculations.
 */
export interface Test {
  id: string;
  projectId: string;
  testType: TestType;
  reportNo?: string;
  testDate: Date;
  
  // Pile specs
  pileId: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;
  
  // Equipment
  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;
  
  // State
  status: TestStatus;
  
  // Computed results (nullable until calculated)
  maxSettlementMm?: number;
  elasticReboundMm?: number;
  netSettlementMm?: number;
  safeLoadAdoptedT?: number;
  isPassed?: boolean;
  conclusion?: string;
  
  // Relations (loaded separately)
  readings?: Reading[];
  siteImages?: SiteImage[];
  certificates?: CalibrationCertificate[];
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single reading during the test.
 * Why: Core data point for calculations and display.
 */
export interface Reading {
  id: string;
  testId: string;
  sequence: number;
  phase: TestPhase;
  recordedAt: Date;
  
  // Raw values
  pressureKgCm2: number;
  loadT: number;
  
  // Dial gauges
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;
  
  // Gauge status
  dg1Enabled: boolean;
  dg2Enabled: boolean;
  dg3Enabled: boolean;
  dg4Enabled: boolean;
  
  // Computed
  avgSettlementMm: number;
  
  remark?: string;
  createdAt: Date;
}

/**
 * Site image attachment.
 * Why: Visual documentation for report.
 */
export interface SiteImage {
  id: string;
  testId: string;
  storagePath: string;
  fileName: string;
  caption?: string;
  displayOrder: number;
  createdAt: Date;
}

/**
 * Calibration certificate attachment.
 * Why: PDF to append to final report.
 */
export interface CalibrationCertificate {
  id: string;
  testId: string;
  certificateType: CertificateType;
  storagePath: string;
  fileName: string;
  createdAt: Date;
}

/**
 * User profile for signatures.
 * Why: Attribution on reports.
 */
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  company?: string;
  designation?: string;
}

// =============================================================================
// TEST ENGINE TYPES
// =============================================================================

/**
 * Metadata passed to engine calculations.
 * Why: Engine needs pile/equipment specs to compute results.
 */
export interface TestMeta {
  pileDiameterMm: number;
  pileDepthM: number;
  designLoadT: number;
  testLoadT: number;
  ramAreaCm2: number;
}

/**
 * Result of engine.calculate() method.
 * Why: Contains all computed values for KPIs and report.
 */
export interface CalculationResult {
  maxSettlementMm: number;
  elasticReboundMm: number;
  netSettlementMm: number;
  
  // Safe load calculation
  loadAt12mmT: number | null;      // Interpolated load at 12mm settlement
  safeLoadFromSettlementT: number | null; // (2/3) × loadAt12mm
  loadAt10PercentDiaT: number | null;     // Load at 10% of pile diameter
  safeLoadFromUltimateT: number | null;   // 0.5 × loadAt10PercentDia
  
  // Final result
  governingCriterion: 'SETTLEMENT' | 'ULTIMATE' | 'NONE';
  safeLoadAdoptedT: number;
  isPassed: boolean;
  
  // For AI conclusion
  settlementLimitMm: number;       // 12mm for IVPLT
}

/**
 * Acceptance criteria from engine.
 * Why: Displayed in report results section.
 */
export interface AcceptanceCriteria {
  description: string;
  criteria: string[];
  settlementLimitMm: number;
  ultimateLimitMm: number; // 10% of pile diameter
}

/**
 * Graph configuration from engine.
 * Why: Determines how chart is rendered.
 */
export interface GraphConfig {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  xAxisInverted: boolean;
  loadingCurveColor: string;
  unloadingCurveColor: string;
  annotations: {
    safeLoadLine: boolean;
    settlementLimitLine: boolean;
    settlementLimitValue: number;
  };
}

/**
 * Report section content.
 * Why: Engine provides IS 2911-compliant wording.
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;      // HTML or markdown
  pageBreakBefore?: boolean;
}

/**
 * KPI configuration for dashboard.
 * Why: Different test types show different KPIs.
 */
export interface KPIConfig {
  id: string;
  label: string;
  unit: string;
  getValue: (result: CalculationResult) => number | string;
  color: 'default' | 'success' | 'warning' | 'destructive';
}

/**
 * Validation result for readings.
 * Why: Engine validates test-type-specific constraints.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Data bundle for report generation.
 * Why: All data needed to render full report.
 */
export interface ReportData {
  test: Test;
  project: ProjectInfo;
  readings: Reading[];
  siteImages: SiteImage[];
  certificates: CalibrationCertificate[];
  result: CalculationResult;
  userProfile: UserProfile;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate load from pressure and ram area.
 * Why: Converts field measurement to engineering units.
 */
export function calculateLoad(pressureKgCm2: number, ramAreaCm2: number): number {
  return (pressureKgCm2 * ramAreaCm2) / 1000;
}

/**
 * Calculate average settlement from enabled gauges only.
 * Why: Faulty gauges must be excluded per FR-004.
 */
export function calculateAverageSettlement(
  dg1: number, dg2: number, dg3: number, dg4: number,
  dg1Enabled: boolean, dg2Enabled: boolean, dg3Enabled: boolean, dg4Enabled: boolean
): number {
  const gauges = [
    { value: dg1, enabled: dg1Enabled },
    { value: dg2, enabled: dg2Enabled },
    { value: dg3, enabled: dg3Enabled },
    { value: dg4, enabled: dg4Enabled },
  ];
  
  const enabled = gauges.filter(g => g.enabled);
  if (enabled.length === 0) {
    throw new Error('At least one dial gauge must be enabled');
  }
  
  return enabled.reduce((sum, g) => sum + g.value, 0) / enabled.length;
}

/**
 * Get test load multiplier for a test type.
 * Why: Different test types have different load factors per IS 2911.
 */
export function getTestLoadMultiplier(testType: TestType): number {
  const multipliers: Record<TestType, number> = {
    IVPLT: 2.5,
    RVPLT: 1.5,
    LATERAL: 2.5,
    UPLIFT: 2.5,
  };
  return multipliers[testType];
}

/**
 * Get settlement limit for a test type.
 * Why: Different test types have different acceptance limits.
 */
export function getSettlementLimit(testType: TestType): number {
  const limits: Record<TestType, number> = {
    IVPLT: 12,    // mm
    RVPLT: 18,    // mm
    LATERAL: 5,   // mm deflection
    UPLIFT: 12,   // mm uplift
  };
  return limits[testType];
}
```

---

## Entity Relationships

```
┌─────────────┐
│   Project   │
├─────────────┤
│ id          │
│ name        │
│ client      │
│ contractor  │
│ pmc         │
│ location    │
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────────────────────────────────────────────────────┐
│                          Test                                │
├─────────────────────────────────────────────────────────────┤
│ id, projectId, testType, reportNo, testDate                 │
│ pileId, pileDiameterMm, pileDepthM, concreteGrade           │
│ designLoadT, testLoadT, jackName, ramAreaCm2, gaugeLeastCount│
│ status, maxSettlement, netSettlement, isPassed, conclusion  │
└───────────┬─────────────────┬─────────────────┬─────────────┘
            │ 1:N             │ 1:N             │ 1:N
            ▼                 ▼                 ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
     │   Reading    │  │  SiteImage   │  │ CalibrationCertificate│
     ├──────────────┤  ├──────────────┤  ├──────────────────────┤
     │ sequence     │  │ storagePath  │  │ certificateType      │
     │ phase        │  │ caption      │  │ storagePath          │
     │ pressure     │  │ displayOrder │  │ fileName             │
     │ load         │  └──────────────┘  └──────────────────────┘
     │ dg1-4        │
     │ dg1-4Enabled │
     │ avgSettlement│
     │ remark       │
     └──────────────┘
```

---

## State Transitions

```
TestStatus Flow:
================

  ┌──────────┐   Create Test    ┌─────────────┐   Add First Reading   ┌─────────────┐
  │          │ ───────────────► │             │ ────────────────────► │             │
  │  (none)  │                  │    DRAFT    │                       │ IN_PROGRESS │
  │          │                  │             │ ◄──────────────────── │             │
  └──────────┘                  └─────────────┘   Delete All Readings └──────┬──────┘
                                                                              │
                                                                              │ Complete
                                                                              │ All Phases
                                                                              ▼
                                ┌─────────────┐   Generate Report   ┌─────────────┐
                                │             │ ◄────────────────── │             │
                                │  REPORTED   │                     │  COMPLETED  │
                                │             │ ────────────────────│             │
                                └─────────────┘   Edit Readings     └─────────────┘
                                       │          (back to IN_PROGRESS)
                                       │
                                       ▼
                                   PDF Ready
```

---

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `pileDiameterMm` | > 0 | "Pile diameter must be positive" |
| `pileDepthM` | > 0 | "Pile depth must be positive" |
| `designLoadT` | > 0 | "Design load must be positive" |
| `ramAreaCm2` | > 0 | "Ram area must be positive" |
| `pressureKgCm2` | >= 0 | "Pressure cannot be negative" |
| `dg1-4` | >= 0 | "Dial gauge readings cannot be negative" |
| `dgXEnabled` | At least 1 true | "At least one dial gauge must be enabled" |
| `sequence` | Unique per test | "Reading sequence must be unique" |
| `certificateType` | Unique per test | "Only one certificate per type allowed" |
| `siteImages` | Max 5 per test | "Maximum 5 site images allowed" |


