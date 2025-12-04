'use client';

import { create } from 'zustand';
import type {
  ReportState,
  UploadedFile,
  TestType,
  ProjectInfo,
  ExtractedReading,
  WorkflowStep,
  OCRValue,
} from '@/types';

/**
 * Actions available on the report store.
 * Why: Separating actions from state makes the interface clearer
 * and enables type-safe action dispatching.
 */
interface ReportActions {
  /** Set uploaded files from dropzone */
  setFiles: (files: UploadedFile[]) => void;
  /** Set selected test type */
  setTestType: (type: TestType | null) => void;
  /** Set extracted project info from OCR */
  setProjectInfo: (info: ProjectInfo) => void;
  /** Update a single field in project info */
  updateProjectField: <K extends keyof ProjectInfo>(
    field: K,
    value: ProjectInfo[K]['value']
  ) => void;
  /** Set all readings from OCR extraction */
  setReadings: (readings: ExtractedReading[]) => void;
  /** Update a single reading by ID */
  updateReading: (id: string, updates: Partial<ExtractedReading>) => void;
  /** Update a specific field in a reading */
  updateReadingField: <K extends keyof ExtractedReading>(
    id: string,
    field: K,
    value: ExtractedReading[K] extends OCRValue<infer T> ? T : never
  ) => void;
  /** Toggle auto-detect cycles setting */
  setAutoDetectCycles: (enabled: boolean) => void;
  /** Navigate to a workflow step */
  setStep: (step: WorkflowStep) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Reset store to initial state */
  reset: () => void;
  /** Detect and mark cycle phases in readings */
  detectCycles: () => void;
}

/**
 * Initial state for the report store.
 * Why: Provides clean starting point for new reports.
 */
const initialState: ReportState = {
  uploadedFiles: [],
  testType: null,
  projectInfo: null,
  readings: [],
  autoDetectCycles: true,
  currentStep: 'upload',
  isLoading: false,
  error: null,
};

/**
 * Zustand store for managing pile test report state.
 * Why: Centralized state management that persists across pages
 * during the upload → verify → report workflow.
 */
export const useReportStore = create<ReportState & ReportActions>((set, get) => ({
  ...initialState,

  setFiles: (files) => set({ uploadedFiles: files }),

  setTestType: (type) => set({ testType: type }),

  setProjectInfo: (info) => set({ projectInfo: info }),

  updateProjectField: (field, value) =>
    set((state) => {
      if (!state.projectInfo) return state;
      return {
        projectInfo: {
          ...state.projectInfo,
          [field]: {
            ...state.projectInfo[field],
            value,
            // When user edits, set confidence to 1.0 (user-verified)
            confidence: 1.0,
          },
        },
      };
    }),

  setReadings: (readings) => {
    set({ readings });
    // Auto-detect cycles if enabled
    if (get().autoDetectCycles) {
      get().detectCycles();
    }
  },

  updateReading: (id, updates) =>
    set((state) => ({
      readings: state.readings.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),

  updateReadingField: (id, field, value) =>
    set((state) => ({
      readings: state.readings.map((r) => {
        if (r.id !== id) return r;
        const currentField = r[field];
        // Only update OCRValue fields
        if (
          currentField &&
          typeof currentField === 'object' &&
          'confidence' in currentField
        ) {
          return {
            ...r,
            [field]: {
              value,
              // User-edited values get full confidence
              confidence: 1.0,
            },
          };
        }
        return { ...r, [field]: value };
      }),
    })),

  setAutoDetectCycles: (enabled) => {
    set({ autoDetectCycles: enabled });
    if (enabled) {
      get().detectCycles();
    } else {
      // Clear cycle markers when disabled
      set((state) => ({
        readings: state.readings.map((r) => ({ ...r, cycle: undefined })),
      }));
    }
  },

  setStep: (step) => set({ currentStep: step }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  detectCycles: () =>
    set((state) => {
      if (state.readings.length === 0) return state;

      const readings = [...state.readings];
      let prevPressure: number | null = null;
      let currentCycle: 'loading' | 'unloading' | 'holding' = 'loading';

      const updatedReadings = readings.map((reading, index) => {
        const pressure = reading.pressure.value;

        if (pressure === null) {
          return { ...reading, cycle: currentCycle };
        }

        if (prevPressure !== null) {
          if (pressure > prevPressure) {
            currentCycle = 'loading';
          } else if (pressure < prevPressure) {
            currentCycle = 'unloading';
          } else {
            // Same pressure = holding
            currentCycle = 'holding';
          }
        }

        // Check for extended holding period (same pressure for multiple readings)
        if (index > 0) {
          const prevReading = readings[index - 1];
          if (
            prevReading.pressure.value === pressure &&
            reading.remark.value?.toLowerCase().includes('hold')
          ) {
            currentCycle = 'holding';
          }
        }

        prevPressure = pressure;
        return { ...reading, cycle: currentCycle };
      });

      return { readings: updatedReadings };
    }),
}));

/**
 * Hook to get just the workflow navigation actions.
 * Why: Components that only need navigation don't need the full store.
 */
export const useWorkflow = () => {
  const currentStep = useReportStore((s) => s.currentStep);
  const setStep = useReportStore((s) => s.setStep);
  const canProceed = useReportStore((s) => {
    if (s.currentStep === 'upload') {
      return s.uploadedFiles.length > 0 && s.testType !== null;
    }
    if (s.currentStep === 'verify') {
      return s.readings.length > 0;
    }
    return false;
  });

  return { currentStep, setStep, canProceed };
};

