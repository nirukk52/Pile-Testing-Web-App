'use client';

import { create } from 'zustand';
import type {
  LegacyProjectInfo,
  LoadEntry,
  SavedTest,
  UserProfile,
  WorkflowStep,
  AppView,
  TestType,
  PileTestSummary,
  LegacyReading,
  LegacyTestPhase,
} from '@/types';
import { EMPTY_PROJECT_INFO } from '@/types';
import * as api from '@/lib/api';

/**
 * Main application state for pile testing.
 * Why: Centralized state management that syncs with Supabase via API.
 * NO localStorage - Supabase is the only source of truth.
 */
interface TestState {
  // App navigation
  view: AppView;
  currentTestId: string | null;
  currentStep: WorkflowStep;

  // All saved tests (fetched from API)
  allTests: SavedTest[];

  // Current test being edited (using legacy type for UI compatibility)
  projectInfo: LegacyProjectInfo;
  loadEntries: LoadEntry[];

  // Supabase IDs for current test
  supabaseProjectId: string | null;
  supabaseTestId: string | null;

  // User profile (in-memory only for now)
  userProfile: UserProfile;

  // UI state
  showProfileModal: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Actions for manipulating test state.
 * Why: Type-safe mutations for all state changes.
 */
interface TestActions {
  // Navigation
  setView: (view: AppView) => void;
  setCurrentStep: (step: WorkflowStep) => void;

  // Test management
  createNewTest: (testType: TestType) => void;
  openTest: (testId: string) => void;
  deleteTest: (testId: string) => Promise<void>;
  backToHome: () => void;

  // Project info
  setProjectInfo: (info: LegacyProjectInfo) => void;
  updateProjectField: <K extends keyof LegacyProjectInfo>(
    field: K,
    value: LegacyProjectInfo[K]
  ) => void;

  // Load entries (local state for UI)
  setLoadEntries: (entries: LoadEntry[]) => void;
  addLoadEntry: (entry: LoadEntry, insertAtIndex?: number) => void;
  updateLoadEntry: (entryId: string, reading: LegacyReading) => void;
  deleteLoadEntry: (entryId: string) => Promise<void>;

  // User profile
  setUserProfile: (profile: UserProfile) => void;
  setShowProfileModal: (show: boolean) => void;

  // API operations - these are the real persistence
  loadTestsFromApi: () => Promise<void>;
  saveTestToApi: () => Promise<void>;
  addReadingToApi: (reading: LegacyReading) => Promise<api.ApiReading>;
  updateReadingToApi: (readingId: string, reading: LegacyReading, loadOverride?: number, avgOverride?: number) => Promise<api.ApiReading>;
  deleteReadingFromApi: (readingId: string) => Promise<void>;

  // Helpers
  getTestSummaries: () => PileTestSummary[];
  reset: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Initial state for the test store.
 * Why: Clean starting point for the app.
 */
const initialState: TestState = {
  view: 'home',
  currentTestId: null,
  currentStep: 'details',
  allTests: [],
  projectInfo: EMPTY_PROJECT_INFO,
  loadEntries: [],
  supabaseProjectId: null,
  supabaseTestId: null,
  userProfile: {
    name: '',
    initials: '',
    signature: '',
  },
  showProfileModal: false,
  isLoading: false,
  error: null,
};

/**
 * Convert API Test to SavedTest for UI compatibility
 */
function apiTestToSavedTest(test: api.ApiTest): SavedTest {
  const projectInfo: LegacyProjectInfo = {
    reportNo: test.reportNo || '',
    project: test.project?.name || '',
    location: test.project?.location || '',
    contractor: test.project?.contractor || '',
    client: test.project?.client || '',
    pmc: test.project?.pmc || '',
    pileId: test.pileId,
    testDate: test.testDate.split('T')[0],
    jackName: test.jackName || '',
    lcOfDialGauge: test.gaugeLeastCountMm.toString(),
    designLoadOnPile: test.designLoadT.toString(),
    testLoad: test.testLoadT.toString(),
    mixedDesign: test.concreteGrade,
    pileDiameter: test.pileDiameterMm.toString(),
    ramArea: test.ramAreaCm2.toString(),
    dateOfCasting: test.dateOfCasting ? test.dateOfCasting.split('T')[0] : '',
    pileDepth: test.pileDepthM.toString(),
    testType: test.testType,
  };

  // Convert API readings to legacy format
  const loadEntries: LoadEntry[] = [];
  if (test.readings && test.readings.length > 0) {
    test.readings.forEach((reading) => {
      const phaseMap: Record<string, LegacyTestPhase> = {
        LOADING: 'loading',
        HOLD: 'holding',
        UNLOADING: 'unloading',
      };

      const legacyReading: LegacyReading = {
        id: reading.id,
        pressureGauge: reading.pressureKgCm2.toString(),
        load: reading.loadT.toFixed(2),
        dialGauge1: reading.dg1.toString(),
        dialGauge2: reading.dg2.toString(),
        dialGauge3: reading.dg3.toString(),
        dialGauge4: reading.dg4.toString(),
        dg1Enabled: reading.dg1Enabled,
        dg2Enabled: reading.dg2Enabled,
        dg3Enabled: reading.dg3Enabled,
        dg4Enabled: reading.dg4Enabled,
        timestamp: reading.recordedAt,
        remark: reading.remark || '',
        phase: phaseMap[reading.phase] || 'loading',
      };

      loadEntries.push({
        id: `entry-${reading.id}`,
        pressureGauge: reading.pressureKgCm2.toString(),
        load: reading.loadT.toFixed(2),
        readings: [legacyReading],
        timestamp: reading.recordedAt,
      });
    });
  }

  return {
    id: test.id,
    projectInfo,
    loadEntries,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
  };
}

/**
 * Zustand store for managing pile test state.
 * Why: Single source of truth - ALL data comes from Supabase, no localStorage.
 */
export const useTestStore = create<TestState & TestActions>()((set, get) => ({
  ...initialState,

  // Navigation
  setView: (view) => set({ view }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ isLoading: loading }),

  // Test management
  createNewTest: (testType) => {
    const newId = `temp-${Date.now()}`;
    set({
      currentTestId: newId,
      projectInfo: {
        ...EMPTY_PROJECT_INFO,
        testType,
      },
      loadEntries: [],
      supabaseProjectId: null,
      supabaseTestId: null,
      currentStep: 'details',
      view: 'test',
    });
  },

  openTest: async (testId) => {
    set({ isLoading: true, error: null });
    try {
      // Fetch fresh data from API - this is the only source of truth
      const apiTest = await api.fetchTest(testId);
      const savedTest = apiTestToSavedTest(apiTest);
      
      set({
        currentTestId: testId,
        projectInfo: savedTest.projectInfo,
        loadEntries: savedTest.loadEntries,
        supabaseTestId: testId,
        supabaseProjectId: apiTest.projectId,
        currentStep: 'details',
        view: 'test',
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load test:', error);
      set({
        isLoading: false,
        error: 'Failed to load test from server. Please check your connection.',
      });
    }
  },

  deleteTest: async (testId) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteTest(testId);
      set((state) => ({
        allTests: state.allTests.filter((t) => t.id !== testId),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to delete test:', error);
      set({ 
        isLoading: false,
        error: 'Failed to delete test. Please try again.',
      });
    }
  },

  backToHome: () => {
    // Save any pending changes before going back
    get().saveTestToApi();
    set({
      view: 'home',
      currentTestId: null,
      supabaseTestId: null,
      supabaseProjectId: null,
      projectInfo: EMPTY_PROJECT_INFO,
      loadEntries: [],
    });
    // Refresh tests from API
    get().loadTestsFromApi();
  },

  // Project info (local state until saved to API)
  setProjectInfo: (info) => {
    set({ projectInfo: info });
  },

  updateProjectField: (field, value) => {
    set((state) => ({
      projectInfo: {
        ...state.projectInfo,
        [field]: value,
      },
    }));
  },

  // Load entries (local state until saved to API)
  setLoadEntries: (entries) => {
    set({ loadEntries: entries });
  },

  addLoadEntry: (entry, insertAtIndex) => {
    set((state) => {
      const entries = [...state.loadEntries];
      if (insertAtIndex !== undefined) {
        entries.splice(insertAtIndex, 0, entry);
      } else {
        entries.push(entry);
      }
      return { loadEntries: entries };
    });
  },

  updateLoadEntry: (entryId, reading) => {
    set((state) => ({
      loadEntries: state.loadEntries.map((entry) => {
        if (entry.id === entryId) {
          return {
            ...entry,
            pressureGauge: reading.pressureGauge,
            load: reading.load,
            timestamp: reading.timestamp,
            readings: [reading],
          };
        }
        return entry;
      }),
    }));
  },

  deleteLoadEntry: async (entryId) => {
    const { supabaseTestId, loadEntries } = get();
    const entry = loadEntries.find((e) => e.id === entryId);
    
    // Delete from API first
    if (entry && supabaseTestId) {
      set({ isLoading: true });
      try {
        for (const reading of entry.readings) {
          await api.deleteReading(supabaseTestId, reading.id);
        }
      } catch (error) {
        console.error('Failed to delete reading from server:', error);
        set({ 
          isLoading: false,
          error: 'Failed to delete reading. Please try again.',
        });
        return;
      }
    }

    // Then update local state
    set((state) => ({
      loadEntries: state.loadEntries.filter((e) => e.id !== entryId),
      isLoading: false,
    }));
  },

  // User profile
  setUserProfile: (profile) => set({ userProfile: profile }),
  setShowProfileModal: (show) => set({ showProfileModal: show }),

  // API Operations - THE REAL PERSISTENCE LAYER
  loadTestsFromApi: async () => {
    set({ isLoading: true, error: null });
    try {
      const tests = await api.fetchTests();
      const savedTests: SavedTest[] = tests.map((test) => apiTestToSavedTest(test));
      set({ allTests: savedTests, isLoading: false });
    } catch (error) {
      console.error('Failed to load tests from API:', error);
      set({ 
        isLoading: false, 
        allTests: [], // Clear any stale data
        error: 'Failed to load tests. Check your connection.' 
      });
    }
  },

  saveTestToApi: async () => {
    const { 
      projectInfo, 
      supabaseTestId, 
      supabaseProjectId,
    } = get();

    // Skip if no project info filled
    if (!projectInfo.project || !projectInfo.pileId) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      let projectId = supabaseProjectId;
      let testId = supabaseTestId;

      // Create project if needed
      if (!projectId) {
        const project = await api.createProject({
          name: projectInfo.project,
          client: projectInfo.client,
          contractor: projectInfo.contractor,
          pmc: projectInfo.pmc || undefined,
          location: projectInfo.location,
        });
        projectId = project.id;
        set({ supabaseProjectId: projectId });
      }

      // Create or update test
      if (!testId) {
        const test = await api.createTest({
          projectId: projectId!,
          testType: projectInfo.testType || 'IVPLT',
          reportNo: projectInfo.reportNo || undefined,
          testDate: projectInfo.testDate || undefined,
          dateOfCasting: projectInfo.dateOfCasting || undefined,
          pileId: projectInfo.pileId,
          pileDiameterMm: parseFloat(projectInfo.pileDiameter) || 600,
          pileDepthM: parseFloat(projectInfo.pileDepth) || 10,
          concreteGrade: projectInfo.mixedDesign || 'M25',
          designLoadT: parseFloat(projectInfo.designLoadOnPile) || 0,
          jackName: projectInfo.jackName || undefined,
          ramAreaCm2: parseFloat(projectInfo.ramArea) || 71.26,
          gaugeLeastCountMm: parseFloat(projectInfo.lcOfDialGauge) || 0.01,
        });
        testId = test.id;
        
        // Update local state with new Supabase ID
        set({
          supabaseTestId: testId,
          currentTestId: testId,
        });
      } else {
        // Update existing test
        await api.updateTest(testId, {
          reportNo: projectInfo.reportNo || null,
          testDate: projectInfo.testDate || undefined,
          dateOfCasting: projectInfo.dateOfCasting || null,
          pileId: projectInfo.pileId,
          pileDiameterMm: parseFloat(projectInfo.pileDiameter) || 600,
          pileDepthM: parseFloat(projectInfo.pileDepth) || 10,
          concreteGrade: projectInfo.mixedDesign || 'M25',
          designLoadT: parseFloat(projectInfo.designLoadOnPile) || 0,
          jackName: projectInfo.jackName || null,
          ramAreaCm2: parseFloat(projectInfo.ramArea) || 71.26,
          gaugeLeastCountMm: parseFloat(projectInfo.lcOfDialGauge) || 0.01,
        });
      }

      set({ isLoading: false });
    } catch (error) {
      console.error('Failed to save test to API:', error);
      set({ 
        isLoading: false, 
        error: 'Failed to save to server. Please try again.' 
      });
      throw error; // Re-throw so caller knows it failed
    }
  },

  addReadingToApi: async (reading: LegacyReading) => {
    const { supabaseTestId } = get();
    
    if (!supabaseTestId) {
      // Save test first
      await get().saveTestToApi();
    }

    const testId = get().supabaseTestId;
    if (!testId) {
      throw new Error('No test ID available. Please save project details first.');
    }

    const phaseMap: Record<LegacyTestPhase, string> = {
      loading: 'LOADING',
      holding: 'HOLD',
      unloading: 'UNLOADING',
    };

    const apiReading = await api.createReading(testId, {
      phase: phaseMap[reading.phase] as api.ApiReading['phase'],
      recordedAt: reading.timestamp,
      pressureKgCm2: parseFloat(reading.pressureGauge),
      dg1: parseFloat(reading.dialGauge1) || 0,
      dg2: parseFloat(reading.dialGauge2) || 0,
      dg3: parseFloat(reading.dialGauge3) || 0,
      dg4: parseFloat(reading.dialGauge4) || 0,
      dg1Enabled: reading.dg1Enabled ?? true,
      dg2Enabled: reading.dg2Enabled ?? true,
      dg3Enabled: reading.dg3Enabled ?? true,
      dg4Enabled: reading.dg4Enabled ?? true,
      remark: reading.remark || undefined,
    });

    // Update the reading ID in local state with API ID
    set((state) => ({
      loadEntries: state.loadEntries.map((entry) => ({
        ...entry,
        readings: entry.readings.map((r) =>
          r.id === reading.id ? { ...r, id: apiReading.id } : r
        ),
      })),
    }));

    return apiReading;
  },

  updateReadingToApi: async (readingId: string, reading: LegacyReading, loadOverride?: number, avgOverride?: number) => {
    const { supabaseTestId } = get();
    
    if (!supabaseTestId) {
      throw new Error('No test ID available. Cannot update reading.');
    }

    const phaseMap: Record<LegacyTestPhase, string> = {
      loading: 'LOADING',
      holding: 'HOLD',
      unloading: 'UNLOADING',
    };

    const apiReading = await api.updateReading(supabaseTestId, readingId, {
      phase: phaseMap[reading.phase] as api.ApiReading['phase'],
      recordedAt: reading.timestamp,
      pressureKgCm2: parseFloat(reading.pressureGauge),
      dg1: parseFloat(reading.dialGauge1) || 0,
      dg2: parseFloat(reading.dialGauge2) || 0,
      dg3: parseFloat(reading.dialGauge3) || 0,
      dg4: parseFloat(reading.dialGauge4) || 0,
      dg1Enabled: reading.dg1Enabled ?? true,
      dg2Enabled: reading.dg2Enabled ?? true,
      dg3Enabled: reading.dg3Enabled ?? true,
      dg4Enabled: reading.dg4Enabled ?? true,
      remark: reading.remark || undefined,
      loadOverride,
      avgOverride,
    });

    return apiReading;
  },

  deleteReadingFromApi: async (readingId: string) => {
    const { supabaseTestId } = get();
    if (!supabaseTestId) return;

    await api.deleteReading(supabaseTestId, readingId);
  },

  // Helpers
  getTestSummaries: (): PileTestSummary[] => {
    return get().allTests.map((test) => {
      const totalReadings = test.loadEntries.reduce(
        (sum, entry) => sum + entry.readings.length,
        0
      );
      return {
        id: test.id,
        reportNo: test.projectInfo.reportNo,
        project: test.projectInfo.project,
        location: test.projectInfo.location,
        dateOfCasting: test.projectInfo.dateOfCasting,
        createdAt: test.createdAt,
        readingsCount: totalReadings,
        testType: test.projectInfo.testType,
      };
    });
  },

  reset: () => set(initialState),
}));

/**
 * Hook to get just the current test data.
 * Why: Components that only need current test don't need full store.
 */
export const useCurrentTest = () => {
  const projectInfo = useTestStore((s) => s.projectInfo);
  const loadEntries = useTestStore((s) => s.loadEntries);
  const currentStep = useTestStore((s) => s.currentStep);
  const setCurrentStep = useTestStore((s) => s.setCurrentStep);
  const supabaseTestId = useTestStore((s) => s.supabaseTestId);

  return { projectInfo, loadEntries, currentStep, setCurrentStep, supabaseTestId };
};

/**
 * Hook to get navigation actions.
 * Why: Simplified interface for navigation components.
 */
export const useNavigation = () => {
  const view = useTestStore((s) => s.view);
  const backToHome = useTestStore((s) => s.backToHome);
  const createNewTest = useTestStore((s) => s.createNewTest);
  const openTest = useTestStore((s) => s.openTest);

  return { view, backToHome, createNewTest, openTest };
};

/**
 * Hook for API operations.
 * Why: Expose API sync methods for components.
 */
export const useApiSync = () => {
  const loadTestsFromApi = useTestStore((s) => s.loadTestsFromApi);
  const saveTestToApi = useTestStore((s) => s.saveTestToApi);
  const addReadingToApi = useTestStore((s) => s.addReadingToApi);
  const updateReadingToApi = useTestStore((s) => s.updateReadingToApi);
  const deleteReadingFromApi = useTestStore((s) => s.deleteReadingFromApi);
  const updateLoadEntry = useTestStore((s) => s.updateLoadEntry);
  const isLoading = useTestStore((s) => s.isLoading);
  const error = useTestStore((s) => s.error);
  const setError = useTestStore((s) => s.setError);

  return { 
    loadTestsFromApi, 
    saveTestToApi, 
    addReadingToApi, 
    updateReadingToApi,
    deleteReadingFromApi,
    updateLoadEntry,
    isLoading, 
    error,
    setError,
  };
};
