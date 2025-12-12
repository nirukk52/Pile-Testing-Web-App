'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ProjectInfo,
  LoadEntry,
  SavedTest,
  UserProfile,
  WorkflowStep,
  AppView,
  TestType,
  PileTestSummary,
} from '@/types';
import { EMPTY_PROJECT_INFO } from '@/types';

/**
 * Main application state for pile testing.
 * Why: Centralized state management that persists tests to localStorage.
 */
interface TestState {
  // App navigation
  view: AppView;
  currentTestId: string | null;
  currentStep: WorkflowStep;

  // All saved tests
  allTests: SavedTest[];

  // Current test being edited
  projectInfo: ProjectInfo;
  loadEntries: LoadEntry[];

  // User profile
  userProfile: UserProfile;

  // UI state
  showProfileModal: boolean;
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
  deleteTest: (testId: string) => void;
  saveCurrentTest: () => void;
  backToHome: () => void;

  // Project info
  setProjectInfo: (info: ProjectInfo) => void;
  updateProjectField: <K extends keyof ProjectInfo>(
    field: K,
    value: ProjectInfo[K]
  ) => void;

  // Load entries
  setLoadEntries: (entries: LoadEntry[]) => void;
  addLoadEntry: (entry: LoadEntry, insertAtIndex?: number) => void;
  deleteLoadEntry: (entryId: string) => void;

  // User profile
  setUserProfile: (profile: UserProfile) => void;
  setShowProfileModal: (show: boolean) => void;

  // Helpers
  getTestSummaries: () => PileTestSummary[];
  reset: () => void;
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
  userProfile: {
    name: '',
    initials: '',
    signature: '',
  },
  showProfileModal: false,
};

/**
 * Zustand store for managing pile test state with localStorage persistence.
 * Why: Single source of truth for all app data that survives page refreshes.
 */
export const useTestStore = create<TestState & TestActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Navigation
      setView: (view) => set({ view }),
      setCurrentStep: (step) => set({ currentStep: step }),

      // Test management
      createNewTest: (testType) => {
        const newId = Date.now().toString();
        set({
          currentTestId: newId,
          projectInfo: {
            ...EMPTY_PROJECT_INFO,
            testType,
          },
          loadEntries: [],
          currentStep: 'details',
          view: 'test',
        });
      },

      openTest: (testId) => {
        const test = get().allTests.find((t) => t.id === testId);
        if (test) {
          set({
            currentTestId: testId,
            projectInfo: test.projectInfo,
            loadEntries: test.loadEntries,
            currentStep: 'details',
            view: 'test',
          });
        }
      },

      deleteTest: (testId) => {
        set((state) => ({
          allTests: state.allTests.filter((t) => t.id !== testId),
        }));
      },

      saveCurrentTest: () => {
        const { currentTestId, projectInfo, loadEntries, allTests } = get();
        if (!currentTestId) return;

        const existingTest = allTests.find((t) => t.id === currentTestId);
        const updatedTest: SavedTest = {
          id: currentTestId,
          projectInfo,
          loadEntries,
          createdAt: existingTest?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedTests = existingTest
          ? allTests.map((t) => (t.id === currentTestId ? updatedTest : t))
          : [...allTests, updatedTest];

        set({ allTests: updatedTests });
      },

      backToHome: () => {
        get().saveCurrentTest();
        set({
          view: 'home',
          currentTestId: null,
        });
      },

      // Project info
      setProjectInfo: (info) => {
        set({ projectInfo: info });
        get().saveCurrentTest();
      },

      updateProjectField: (field, value) => {
        set((state) => ({
          projectInfo: {
            ...state.projectInfo,
            [field]: value,
          },
        }));
        // Auto-save after a brief delay would be better, but for now save immediately
        get().saveCurrentTest();
      },

      // Load entries
      setLoadEntries: (entries) => {
        set({ loadEntries: entries });
        get().saveCurrentTest();
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
        get().saveCurrentTest();
      },

      deleteLoadEntry: (entryId) => {
        set((state) => ({
          loadEntries: state.loadEntries.filter((e) => e.id !== entryId),
        }));
        get().saveCurrentTest();
      },

      // User profile
      setUserProfile: (profile) => set({ userProfile: profile }),
      setShowProfileModal: (show) => set({ showProfileModal: show }),

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
    }),
    {
      name: 'pile-test-storage',
      // Only persist these fields
      partialize: (state) => ({
        allTests: state.allTests,
        userProfile: state.userProfile,
      }),
    }
  )
);

/**
 * Hook to get just the current test data.
 * Why: Components that only need current test don't need full store.
 */
export const useCurrentTest = () => {
  const projectInfo = useTestStore((s) => s.projectInfo);
  const loadEntries = useTestStore((s) => s.loadEntries);
  const currentStep = useTestStore((s) => s.currentStep);
  const setCurrentStep = useTestStore((s) => s.setCurrentStep);

  return { projectInfo, loadEntries, currentStep, setCurrentStep };
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
