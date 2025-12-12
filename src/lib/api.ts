/**
 * API Client for Supabase-backed data operations
 * Why: Centralizes all API calls to Supabase via Next.js API routes.
 */

import type { TestType, TestPhase } from '@/engines';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Project from Supabase database
 */
export interface ApiProject {
  id: string;
  name: string;
  client: string;
  contractor: string;
  pmc: string | null;
  location: string;
  createdAt: string;
  updatedAt: string;
  _count?: { tests: number };
}

/**
 * Test from Supabase database
 */
export interface ApiTest {
  id: string;
  projectId: string;
  testType: TestType;
  reportNo: string | null;
  testDate: string;
  pileId: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;
  jackName: string | null;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REPORTED';
  maxSettlementMm: number | null;
  elasticReboundMm: number | null;
  netSettlementMm: number | null;
  safeLoadAdoptedT: number | null;
  isPassed: boolean | null;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  project?: ApiProject;
  readings?: ApiReading[];
  _count?: { readings: number };
}

/**
 * Reading from Supabase database
 */
export interface ApiReading {
  id: string;
  testId: string;
  sequence: number;
  phase: TestPhase;
  recordedAt: string;
  pressureKgCm2: number;
  loadT: number;
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;
  dg1Enabled: boolean;
  dg2Enabled: boolean;
  dg3Enabled: boolean;
  dg4Enabled: boolean;
  avgSettlementMm: number;
  remark: string | null;
  createdAt: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch all projects
 */
export async function fetchProjects(): Promise<ApiProject[]> {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  return response.json();
}

/**
 * Create a new project
 */
export async function createProject(data: {
  name: string;
  client: string;
  contractor: string;
  pmc?: string;
  location: string;
}): Promise<ApiProject> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create project');
  }
  return response.json();
}

/**
 * Fetch all tests (optionally filtered by projectId)
 */
export async function fetchTests(projectId?: string): Promise<ApiTest[]> {
  const url = projectId ? `/api/tests?projectId=${projectId}` : '/api/tests';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch tests');
  }
  return response.json();
}

/**
 * Fetch a single test with all related data
 */
export async function fetchTest(testId: string): Promise<ApiTest> {
  const response = await fetch(`/api/tests/${testId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch test');
  }
  return response.json();
}

/**
 * Create a new test
 */
export async function createTest(data: {
  projectId: string;
  testType: TestType;
  reportNo?: string;
  testDate?: string;
  pileId: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm?: number;
}): Promise<ApiTest> {
  const response = await fetch('/api/tests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create test');
  }
  return response.json();
}

/**
 * Update a test
 */
export async function updateTest(
  testId: string,
  data: Partial<Omit<ApiTest, 'id' | 'createdAt' | 'updatedAt' | 'project' | 'readings' | '_count'>>
): Promise<ApiTest> {
  const response = await fetch(`/api/tests/${testId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update test');
  }
  return response.json();
}

/**
 * Delete a test
 */
export async function deleteTest(testId: string): Promise<void> {
  const response = await fetch(`/api/tests/${testId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete test');
  }
}

/**
 * Fetch all readings for a test
 */
export async function fetchReadings(testId: string): Promise<ApiReading[]> {
  const response = await fetch(`/api/tests/${testId}/readings`);
  if (!response.ok) {
    throw new Error('Failed to fetch readings');
  }
  return response.json();
}

/**
 * Create a new reading
 */
export async function createReading(
  testId: string,
  data: {
    phase: TestPhase;
    recordedAt?: string;
    pressureKgCm2: number;
    dg1: number;
    dg2: number;
    dg3: number;
    dg4: number;
    dg1Enabled?: boolean;
    dg2Enabled?: boolean;
    dg3Enabled?: boolean;
    dg4Enabled?: boolean;
    remark?: string;
    insertAtSequence?: number;
  }
): Promise<ApiReading> {
  const response = await fetch(`/api/tests/${testId}/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create reading');
  }
  return response.json();
}

/**
 * Delete a reading
 */
export async function deleteReading(testId: string, readingId: string): Promise<void> {
  const response = await fetch(`/api/tests/${testId}/readings?id=${readingId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete reading');
  }
}

/**
 * Get calculated results for a test
 */
export async function calculateTestResults(testId: string): Promise<{
  result: {
    maxSettlementMm: number;
    elasticReboundMm: number;
    netSettlementMm: number;
    safeLoadAdoptedT: number;
    isPassed: boolean;
    settlementLimitMm: number;
    governingCriterion: string;
    loadAtLimitT: number | null;
    safeLoadFromSettlementT: number | null;
    loadAt10PercentDiaT: number | null;
    safeLoadFromUltimateT: number | null;
  };
  testType: TestType;
  readingCount: number;
}> {
  const response = await fetch(`/api/tests/${testId}/calculate`);
  if (!response.ok) {
    throw new Error('Failed to calculate results');
  }
  return response.json();
}

