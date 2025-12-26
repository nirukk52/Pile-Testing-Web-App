'use client';

import { useState, Fragment, useEffect, useMemo } from 'react';
import { Plus, Trash2, Pencil, Loader2, Cloud, CloudOff, ChevronDown, ChevronRight, ChevronLeft, FilePlus, Check, X } from 'lucide-react';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import type { LoadEntry, LegacyReading, LegacyProjectInfo, LegacyTestPhase } from '@/types';
import { calculateLoad, calculateAverageSettlement } from '@/types';
import { useApiSync } from '@/store/test-store';
import { formatDateDDMMYYYY, convertISOToDDMMYYYY, convertDDMMYYYYToISO } from '@/lib/utils';

/**
 * Maximum rows per page - matches physical field sheet format.
 * Why: Field sheets typically have 25 rows per page for readability.
 */
const ROWS_PER_PAGE = 25;

/**
 * Props for the DataEntry component.
 * Why: Defines data and callbacks for managing readings.
 */
interface DataEntryProps {
  loadEntries: LoadEntry[];
  onAddEntry: (entry: LoadEntry, insertAtIndex?: number) => void;
  onDeleteEntry: (entryId: string) => void;
  onUpdateEntry: (entryId: string, reading: LegacyReading) => void;
  projectInfo: LegacyProjectInfo;
}

/**
 * Phase configuration for visual styling.
 * Why: Consistent colors for loading/holding/unloading phases.
 */
const phases: Array<{ key: LegacyTestPhase; label: string; color: string; bgLight: string }> = [
  { key: 'loading', label: 'Loading', color: 'bg-blue-600', bgLight: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'holding', label: 'Holding', color: 'bg-amber-600', bgLight: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'unloading', label: 'Unloading', color: 'bg-green-600', bgLight: 'bg-green-50 border-green-200 text-green-700' },
];

/**
 * Get default values for quick form from the last reading.
 * Why: Auto-fill saves time for site engineers entering sequential readings.
 */
function getDefaultsFromLastReading(loadEntries: LoadEntry[]) {
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const defaultTime = now.toTimeString().slice(0, 5);

  if (loadEntries.length === 0) {
    return {
      date: defaultDate,
      time: defaultTime,
      phase: 'loading' as LegacyTestPhase,
      pressure: '',
    };
  }

  const lastEntry = loadEntries[loadEntries.length - 1];
  const lastReading = lastEntry.readings[0];
  
  // Safely parse the timestamp - it might be invalid from extraction
  let lastDate: Date;
  try {
    lastDate = new Date(lastReading.timestamp);
    // Check if the date is valid
    if (isNaN(lastDate.getTime())) {
      lastDate = now;
    }
  } catch {
    lastDate = now;
  }

  return {
    date: lastDate.toISOString().split('T')[0],
    time: lastDate.toTimeString().slice(0, 5),
    phase: lastReading.phase || 'loading',
    pressure: lastEntry.pressureGauge,
  };
}

/**
 * Groups entries by pressure value for collapsible display.
 * Why: Allows site engineers to collapse readings at the same pressure level for better overview.
 */
interface PressureGroup {
  pressure: string;
  startIndex: number;
  entries: LoadEntry[];
}

/**
 * Groups consecutive entries by pressure value.
 * Why: Enables collapsible sections for each pressure level in the table.
 */
function groupEntriesByPressure(loadEntries: LoadEntry[]): PressureGroup[] {
  const groups: PressureGroup[] = [];
  let currentGroup: PressureGroup | null = null;

  loadEntries.forEach((entry, index) => {
    if (!currentGroup || currentGroup.pressure !== entry.pressureGauge) {
      // Start a new group
      currentGroup = {
        pressure: entry.pressureGauge,
        startIndex: index,
        entries: [entry],
      };
      groups.push(currentGroup);
    } else {
      // Add to existing group
      currentGroup.entries.push(entry);
    }
  });

  return groups;
}

/**
 * Timeline/table view for all readings with quick-add form.
 * Why: Main data entry screen for fast on-site measurement recording.
 */
export function DataEntry({
  loadEntries,
  onAddEntry,
  onDeleteEntry,
  onUpdateEntry,
  projectInfo,
}: DataEntryProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  
  /**
   * Current page number (1-indexed like field sheets).
   * Why: Field sheets are numbered starting from 1.
   */
  const [currentPage, setCurrentPage] = useState(1);
  
  /**
   * Tracks which pressure groups are collapsed.
   * Why: Allows toggling visibility of rows per pressure level.
   * Key is "pressure-startIndex" to handle same pressure appearing multiple times.
   */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  /**
   * Calculate total pages based on entries.
   * Why: Each page holds max 25 rows like physical field sheets.
   */
  const totalPages = Math.max(1, Math.ceil(loadEntries.length / ROWS_PER_PAGE));

  /**
   * Get entries for the current page.
   * Why: Paginate entries to show only 25 per page.
   */
  const pageEntries = useMemo(() => {
    const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
    const endIdx = startIdx + ROWS_PER_PAGE;
    return loadEntries.slice(startIdx, endIdx);
  }, [loadEntries, currentPage]);

  /**
   * Get the global start index for current page.
   * Why: Needed for calculating correct indices for editing/deleting.
   */
  const pageStartIndex = (currentPage - 1) * ROWS_PER_PAGE;

  /**
   * Groups entries by pressure for collapsible rendering.
   * Why: Memoized to avoid recalculating on every render.
   * Note: Uses pageEntries instead of all loadEntries for current page only.
   */
  const pressureGroups = useMemo(() => groupEntriesByPressure(pageEntries), [pageEntries]);

  /**
   * Auto-navigate to last page when new entries are added.
   * Why: User should see their newly added entries.
   */
  useEffect(() => {
    const newTotalPages = Math.max(1, Math.ceil(loadEntries.length / ROWS_PER_PAGE));
    // If we're on a page that no longer exists, go to last page
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    }
  }, [loadEntries.length, currentPage]);

  /**
   * Check if current page is full.
   * Why: Show "Add New Page" button when page is full.
   */
  const isCurrentPageFull = pageEntries.length >= ROWS_PER_PAGE;

  /**
   * Handle adding a new page.
   * Why: Navigate to a new empty page for more entries.
   */
  const handleAddNewPage = () => {
    // If current page is full, go to next page
    if (isCurrentPageFull) {
      setCurrentPage(totalPages + 1);
    }
  };

  /**
   * Toggle collapse state for a pressure group.
   * Why: Allows clicking on pressure cell to expand/collapse readings.
   */
  const togglePressureGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  /**
   * Inline editing state - tracks which row is being edited and its form values.
   * Why: Enables Excel-like inline editing without navigating to a new page.
   */
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    date: string;
    time: string;
    phase: LegacyTestPhase;
    pressure: string;
    dg1: string;
    dg2: string;
    dg3: string;
    dg4: string;
    remark: string;
  } | null>(null);

  /**
   * Tracks newly inserted empty rows that haven't been saved yet.
   * Why: Allows inserting blank rows like Excel for data entry.
   */
  const [newRowIndex, setNewRowIndex] = useState<number | null>(null);
  const [newRowData, setNewRowData] = useState<{
    date: string;
    time: string;
    phase: LegacyTestPhase;
    pressure: string;
    dg1: string;
    dg2: string;
    dg3: string;
    dg4: string;
    remark: string;
  } | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ entryId: string; readingId: string; time: string; load: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick form state
  const defaults = getDefaultsFromLastReading(loadEntries);
  const [qDate, setQDate] = useState(defaults.date);
  const [qTime, setQTime] = useState(defaults.time);
  const [qPhase, setQPhase] = useState<LegacyTestPhase>(defaults.phase);
  const [qPressure, setQPressure] = useState(defaults.pressure);
  const [qDg1, setQDg1] = useState('');
  const [qDg2, setQDg2] = useState('');
  const [qDg3, setQDg3] = useState('');
  const [qDg4, setQDg4] = useState('');
  const [qRemark, setQRemark] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset quick form when loadEntries change (after successful add)
  // Preserve date/time - user likely wants to continue with same date on site
  useEffect(() => {
    const newDefaults = getDefaultsFromLastReading(loadEntries);
    // Only update date/time on FIRST render (when no entries exist yet)
    // After that, preserve user's entered date/time
    if (loadEntries.length === 0) {
      setQDate(newDefaults.date);
      setQTime(newDefaults.time);
    }
    setQPhase(newDefaults.phase);
    setQPressure(newDefaults.pressure);
    // Keep dial gauges empty for new reading
    setQDg1('');
    setQDg2('');
    setQDg3('');
    setQDg4('');
    setQRemark('');
    setValidationError(null);
  }, [loadEntries.length]);

  const { addReadingToApi, updateReadingToApi, deleteReadingFromApi, saveTestToApi, updateLoadEntry } = useApiSync();

  /**
   * Validates the quick form.
   * Why: Same validation as full page - required fields must be filled.
   */
  const validateQuickForm = (): boolean => {
    // Check project details first
    if (!projectInfo.project || !projectInfo.pileId) {
      setValidationError('Please fill Project Name and Pile ID in the Details tab first');
      return false;
    }
    if (!qDate) {
      setValidationError('Date is required');
      return false;
    }
    if (!qTime) {
      setValidationError('Time is required');
      return false;
    }
    if (!qPressure) {
      setValidationError('Pressure is required');
      return false;
    }
    if (!qDg1 || !qDg2 || !qDg3 || !qDg4) {
      setValidationError('All dial gauge readings are required');
      return false;
    }
    setValidationError(null);
    return true;
  };

  /**
   * Handle quick form submission.
   * Why: One-tap add for fast data entry on site.
   */
  const handleQuickAdd = async () => {
    if (!validateQuickForm()) return;

    // Create timestamp with explicit IST offset (+05:30) for consistency
    // All times in this app are IST (Asia/Kolkata)
    const timestamp = new Date(`${qDate}T${qTime}:00+05:30`).toISOString();
    const load = calculateLoad(qPressure, projectInfo.ramArea);
    const tempId = Date.now().toString();

    const newReading: LegacyReading = {
      id: tempId,
      pressureGauge: qPressure,
      load,
      dialGauge1: qDg1,
      dialGauge2: qDg2,
      dialGauge3: qDg3,
      dialGauge4: qDg4,
      dg1Enabled: true,
      dg2Enabled: true,
      dg3Enabled: true,
      dg4Enabled: true,
      timestamp,
      signature: '', // No signature for quick entry
      remark: qRemark,
      phase: qPhase,
    };

    const newEntry: LoadEntry = {
      id: `entry-${tempId}`,
      pressureGauge: qPressure,
      load,
      readings: [newReading],
      timestamp,
    };

    // Add to local state immediately for optimistic update
    onAddEntry(newEntry);
    
    // Navigate to the page where the new entry will appear (last page)
    const newTotalEntries = loadEntries.length + 1;
    const targetPage = Math.ceil(newTotalEntries / ROWS_PER_PAGE);
    setCurrentPage(targetPage);

    // Sync to API in background
    setIsSaving(true);
    setSyncStatus('syncing');
    try {
      await saveTestToApi();
      await addReadingToApi(newReading);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to sync reading to API:', error);
      setSyncStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle delete confirmation.
   * Why: Shows modal with reading details before deletion.
   */
  const handleDeleteClick = (entryId: string, readingId: string, time: string, load: string) => {
    setDeleteTarget({ entryId, readingId, time, load });
  };

  /**
   * Confirm and execute delete.
   * Why: Actually performs the deletion after user confirmation.
   */
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    
    // Delete from local state first
    onDeleteEntry(deleteTarget.entryId);
    
    // Delete from API
    try {
      await deleteReadingFromApi(deleteTarget.readingId);
    } catch (error) {
      console.error('Failed to delete from API:', error);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  /**
   * Handle insert button click - adds empty row below for inline entry.
   * Why: Excel-like behavior - insert blank row at position for data entry.
   */
  const handleAddBetween = (index: number) => {
    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = now.toTimeString().slice(0, 5);
    
    // Get defaults from the row above if available
    const prevEntry = loadEntries[index - 1];
    const prevReading = prevEntry?.readings[0];
    
    setNewRowIndex(index);
    setNewRowData({
      date: prevReading ? new Date(prevReading.timestamp).toISOString().split('T')[0] : defaultDate,
      time: defaultTime,
      phase: prevReading?.phase || 'loading',
      pressure: prevEntry?.pressureGauge || '',
      dg1: '',
      dg2: '',
      dg3: '',
      dg4: '',
      remark: '',
    });
    // Clear any editing state
    setEditingRowId(null);
    setEditFormData(null);
  };

  /**
   * Handle edit button click - enables inline editing for the row.
   * Why: Excel-like behavior - edit in place without navigating away.
   */
  const handleEditReading = (entry: LoadEntry, globalIndex: number) => {
    const reading = entry.readings[0];
    const timestamp = new Date(reading.timestamp);
    
    setEditingRowId(entry.id);
    setEditFormData({
      date: timestamp.toISOString().split('T')[0],
      time: timestamp.toTimeString().slice(0, 5),
      phase: reading.phase || 'loading',
      pressure: entry.pressureGauge,
      dg1: reading.dialGauge1,
      dg2: reading.dialGauge2,
      dg3: reading.dialGauge3,
      dg4: reading.dialGauge4,
      remark: reading.remark || '',
    });
    // Clear any new row state
    setNewRowIndex(null);
    setNewRowData(null);
  };

  /**
   * Cancel inline editing.
   * Why: Allows user to discard changes and revert to original values.
   */
  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditFormData(null);
  };

  /**
   * Cancel new row insertion.
   * Why: Allows user to discard the empty row without saving.
   */
  const handleCancelNewRow = () => {
    setNewRowIndex(null);
    setNewRowData(null);
  };

  /**
   * Save inline edit changes.
   * Why: Persists the edited row data to state and API.
   */
  const handleSaveEdit = async (entry: LoadEntry) => {
    if (!editFormData) return;

    // Create timestamp with explicit IST offset (+05:30) for consistency
    // All times in this app are IST (Asia/Kolkata)
    const timestamp = new Date(`${editFormData.date}T${editFormData.time}:00+05:30`).toISOString();
    const load = calculateLoad(editFormData.pressure, projectInfo.ramArea);
    const originalReadingId = entry.readings[0].id;

    const updatedReading: LegacyReading = {
      id: originalReadingId,
      pressureGauge: editFormData.pressure,
      load,
      dialGauge1: editFormData.dg1,
      dialGauge2: editFormData.dg2,
      dialGauge3: editFormData.dg3,
      dialGauge4: editFormData.dg4,
      dg1Enabled: true,
      dg2Enabled: true,
      dg3Enabled: true,
      dg4Enabled: true,
      timestamp,
      signature: entry.readings[0].signature || '',
      remark: editFormData.remark,
      phase: editFormData.phase,
    };

    // Update local state
    onUpdateEntry(entry.id, updatedReading);
    setEditingRowId(null);
    setEditFormData(null);

    // Sync to API
    setIsSaving(true);
    setSyncStatus('syncing');
    try {
      await updateReadingToApi(originalReadingId, updatedReading);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to update reading in API:', error);
      setSyncStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Save new row data.
   * Why: Persists the newly inserted row to state and API.
   */
  const handleSaveNewRow = async () => {
    if (!newRowData || newRowIndex === null) return;

    // Validate required fields
    if (!newRowData.pressure || !newRowData.dg1 || !newRowData.dg2 || !newRowData.dg3 || !newRowData.dg4) {
      setValidationError('All fields except remark are required');
      return;
    }

    // Create timestamp with explicit IST offset (+05:30) for consistency
    // All times in this app are IST (Asia/Kolkata)
    const timestamp = new Date(`${newRowData.date}T${newRowData.time}:00+05:30`).toISOString();
    const load = calculateLoad(newRowData.pressure, projectInfo.ramArea);
    const tempId = Date.now().toString();

    const newReading: LegacyReading = {
      id: tempId,
      pressureGauge: newRowData.pressure,
      load,
      dialGauge1: newRowData.dg1,
      dialGauge2: newRowData.dg2,
      dialGauge3: newRowData.dg3,
      dialGauge4: newRowData.dg4,
      dg1Enabled: true,
      dg2Enabled: true,
      dg3Enabled: true,
      dg4Enabled: true,
      timestamp,
      signature: '',
      remark: newRowData.remark,
      phase: newRowData.phase,
    };

    const newEntry: LoadEntry = {
      id: `entry-${tempId}`,
      pressureGauge: newRowData.pressure,
      load,
      readings: [newReading],
      timestamp,
    };

    // Add to local state at the specified index
    onAddEntry(newEntry, newRowIndex);
    setNewRowIndex(null);
    setNewRowData(null);
    setValidationError(null);

    // Sync to API
    setIsSaving(true);
    setSyncStatus('syncing');
    try {
      await saveTestToApi();
      await addReadingToApi(newReading);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to sync reading to API:', error);
      setSyncStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-2 space-y-3">
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmationModal
          time={deleteTarget.time}
          load={`${deleteTarget.load} MT`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Sync Status */}
      {syncStatus !== 'idle' && (
        <div className={`rounded-lg px-3 py-2 flex items-center gap-2 text-sm ${
          syncStatus === 'syncing' ? 'bg-blue-50 text-blue-700' :
          syncStatus === 'synced' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        }`}>
          {syncStatus === 'syncing' && <Loader2 className="w-4 h-4 animate-spin" />}
          {syncStatus === 'synced' && <Cloud className="w-4 h-4" />}
          {syncStatus === 'error' && <CloudOff className="w-4 h-4" />}
          <span>
            {syncStatus === 'syncing' && 'Saving to cloud...'}
            {syncStatus === 'synced' && 'Saved to cloud ✓'}
            {syncStatus === 'error' && 'Failed to save. Please try again.'}
          </span>
        </div>
      )}

      {/* Page Header - Field Sheet Style */}
      {loadEntries.length > 0 && (
        <div className="flex items-center justify-between bg-slate-800 text-white rounded-t-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Page {currentPage}</span>
            <span className="text-slate-400 text-xs">of {totalPages}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-300">
            <span>{pageEntries.length}/{ROWS_PER_PAGE} rows</span>
            {isCurrentPageFull && (
              <span className="ml-2 px-2 py-0.5 bg-amber-500 text-white rounded text-xs">Full</span>
            )}
          </div>
        </div>
      )}

      {/* Readings Table */}
      {loadEntries.length > 0 ? (
        <div className="bg-white rounded-b-lg shadow-sm overflow-hidden border border-slate-300 border-t-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[70px]">DATE</th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[60px]">
                    TIME
                    <br />
                    (Hrs)
                  </th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[70px]">
                    PRESSURE
                    <br />
                    GAUGE
                    <br />
                    READING
                    <br />
                    kg/cm²
                  </th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[60px]">LOAD IN MT</th>
                  <th colSpan={4} className="px-2 py-2 border-r border-slate-300">
                    Dial Gauge
                  </th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[70px]">
                    AVERAGE
                    <br />
                    SETTLEMENT
                    <br />
                    IN MM
                  </th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[80px]">REMARK</th>
                  <th className="px-2 py-2 border-r border-slate-300 w-[100px]"></th>
                  <th className="px-2 py-2 w-[40px]"></th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <th colSpan={4} className="border-r border-slate-300"></th>
                  <th className="px-2 py-1 border-r border-slate-300">
                    Reading
                    <br />1
                  </th>
                  <th className="px-2 py-1 border-r border-slate-300">
                    Reading
                    <br />2
                  </th>
                  <th className="px-2 py-1 border-r border-slate-300">
                    Reading
                    <br />3
                  </th>
                  <th className="px-2 py-1 border-r border-slate-300">
                    Reading
                    <br />4
                  </th>
                  <th className="border-r border-slate-300"></th>
                  <th className="border-r border-slate-300"></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pressureGroups.map((group) => {
                  const groupKey = `${group.pressure}-${group.startIndex}`;
                  const isCollapsed = collapsedGroups.has(groupKey);
                  const hasMultipleEntries = group.entries.length > 1;

                  return (
                    <Fragment key={groupKey}>
                      {group.entries.map((entry, indexInGroup) => {
                        // Calculate page-local index and global index
                        const pageLocalIndex = group.startIndex + indexInGroup;
                        const globalIndex = pageStartIndex + pageLocalIndex;
                        const reading = entry.readings[0];
                        const phase = reading.phase || 'loading';
                        const phaseInfo = phases.find((p) => p.key === phase);

                        const loadDate = new Date(reading.timestamp);
                        const dateStr = formatDateDDMMYYYY(loadDate);
                        // Display in IST (Asia/Kolkata) - all field times are in Indian Standard Time
                        const timeStr = loadDate.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                          timeZone: 'Asia/Kolkata',
                        });
                        // Format time for delete modal (12h format)
                        const timeStr12h = loadDate.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'Asia/Kolkata',
                        });

                        const avg = calculateAverageSettlement(
                          reading.dialGauge1,
                          reading.dialGauge2,
                          reading.dialGauge3,
                          reading.dialGauge4
                        );

                        // Check if we need to show phase header (using global index for full entries)
                        const prevEntry = globalIndex > 0 ? loadEntries[globalIndex - 1] : null;
                        const prevPhase = prevEntry ? prevEntry.readings[0].phase || 'loading' : null;
                        const showPhaseHeader = phase !== prevPhase;

                        // Check for date changes
                        const prevDate = prevEntry
                          ? formatDateDDMMYYYY(new Date(prevEntry.readings[0].timestamp))
                          : null;
                        const dateChanged = prevDate && dateStr !== prevDate;

                        // First entry in group shows pressure
                        const isFirstInGroup = indexInGroup === 0;
                        const isLastInGroup = indexInGroup === group.entries.length - 1;

                        // Check for load changes
                        const prevLoad = prevEntry ? prevEntry.load : null;
                        const loadChanged = !prevLoad || entry.load !== prevLoad;

                        // If collapsed, only show first row with summary
                        if (isCollapsed && !isFirstInGroup) {
                          return null;
                        }

                        return (
                          <Fragment key={entry.id}>
                            {/* Phase Header Row */}
                            {showPhaseHeader && (
                              <tr>
                                <td
                                  colSpan={12}
                                  className={`${phaseInfo?.color} text-white text-center py-1 font-semibold border-y border-slate-300`}
                                >
                                  {phaseInfo?.label}
                                </td>
                              </tr>
                            )}

                            {/* Data Row - Inline Editable */}
                            {editingRowId === entry.id && editFormData ? (
                              // EDITING MODE
                              <tr className="border-b border-blue-300 bg-blue-50">
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={convertISOToDDMMYYYY(editFormData.date)}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || /^[\d/]*$/.test(value)) {
                                        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                                          setEditFormData({ ...editFormData, date: convertDDMMYYYYToISO(value) });
                                        }
                                      }
                                    }}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                    placeholder="dd/mm/yyyy"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={editFormData.time}
                                    onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                    placeholder="HH:MM"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.pressure}
                                    onChange={(e) => setEditFormData({ ...editFormData, pressure: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200 text-center text-blue-700 font-semibold text-xs">
                                  {calculateLoad(editFormData.pressure, projectInfo.ramArea)}
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.dg1}
                                    onChange={(e) => setEditFormData({ ...editFormData, dg1: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.dg2}
                                    onChange={(e) => setEditFormData({ ...editFormData, dg2: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.dg3}
                                    onChange={(e) => setEditFormData({ ...editFormData, dg3: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.dg4}
                                    onChange={(e) => setEditFormData({ ...editFormData, dg4: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200 text-center text-green-700 font-semibold text-xs">
                                  {calculateAverageSettlement(editFormData.dg1, editFormData.dg2, editFormData.dg3, editFormData.dg4)}
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={editFormData.remark}
                                    onChange={(e) => setEditFormData({ ...editFormData, remark: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-blue-300 focus:border-blue-500 outline-none"
                                    placeholder="Remark"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <div className="flex items-center gap-1 justify-center">
                                    <button
                                      onClick={() => handleSaveEdit(entry)}
                                      disabled={isSaving}
                                      className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors"
                                      title="Save"
                                    >
                                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-1 py-1"></td>
                              </tr>
                            ) : (
                              // DISPLAY MODE
                              <tr className={`${
                                isLastInGroup || isCollapsed ? 'border-b border-slate-200' : 'border-b border-slate-100'
                              } hover:bg-slate-50 ${
                                isFirstInGroup ? 'bg-blue-50/30' : ''
                              }`}>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center ${
                                  isFirstInGroup ? 'font-extrabold' : 'font-semibold'
                                }`}>
                                  {dateChanged || globalIndex === 0 ? dateStr : ''}
                                </td>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center ${
                                  isFirstInGroup ? 'font-extrabold' : ''
                                }`}>
                                  {isCollapsed ? `${timeStr} - ...` : timeStr}
                                </td>
                                {/* Pressure cell - clickable for groups with multiple entries */}
                                <td 
                                  className={`px-2 py-2 border-r border-slate-200 text-center font-semibold ${
                                    hasMultipleEntries && isFirstInGroup ? 'cursor-pointer hover:bg-blue-100 select-none' : ''
                                  } ${isFirstInGroup ? 'font-extrabold' : ''}`}
                                  onClick={() => {
                                    if (hasMultipleEntries && isFirstInGroup) {
                                      togglePressureGroup(groupKey);
                                    }
                                  }}
                                >
                                  {isFirstInGroup ? (
                                    <div className="flex items-center justify-center gap-1">
                                      {hasMultipleEntries && (
                                        isCollapsed ? (
                                          <ChevronRight className="w-3 h-3 text-slate-500" />
                                        ) : (
                                          <ChevronDown className="w-3 h-3 text-slate-500" />
                                        )
                                      )}
                                      <span>{entry.pressureGauge}</span>
                                      {isCollapsed && hasMultipleEntries && (
                                        <span className="text-xs text-slate-500 ml-1">
                                          ({group.entries.length})
                                        </span>
                                      )}
                                    </div>
                                  ) : ''}
                                </td>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center text-blue-700 ${
                                  isFirstInGroup ? 'font-extrabold' : 'font-semibold'
                                }`}>
                                  {loadChanged ? entry.load : ''}
                                </td>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center ${
                                  isFirstInGroup ? 'font-extrabold' : 'font-semibold'
                                }`}>
                                  {isCollapsed ? '...' : reading.dialGauge1}
                                </td>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center ${
                                  isFirstInGroup ? 'font-extrabold' : 'font-semibold'
                                }`}>
                                  {isCollapsed ? '...' : reading.dialGauge2}
                                </td>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center ${
                                  isFirstInGroup ? 'font-extrabold' : 'font-semibold'
                                }`}>
                                  {isCollapsed ? '...' : reading.dialGauge3}
                                </td>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center ${
                                  isFirstInGroup ? 'font-extrabold' : 'font-semibold'
                                }`}>
                                  {isCollapsed ? '...' : reading.dialGauge4}
                                </td>
                                <td className={`px-2 py-2 border-r border-slate-200 text-center text-green-700 ${
                                  isFirstInGroup ? 'font-extrabold' : 'font-semibold'
                                }`}>
                                  {isCollapsed ? '...' : avg}
                                </td>
                                <td className="px-2 py-2 border-r border-slate-200 text-xs text-gray-600 italic">
                                  {isCollapsed ? `${group.entries.length} readings` : (reading.remark || '-')}
                                </td>
                                <td className="px-2 py-2 border-r border-slate-200 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    <button
                                      onClick={() => handleAddBetween(globalIndex + 1)}
                                      className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1 text-xs whitespace-nowrap"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span className="hidden sm:inline">Insert</span>
                                    </button>
                                    {!isCollapsed && (
                                      <button
                                        onClick={() => handleEditReading(entry, globalIndex)}
                                        className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors flex items-center gap-1 text-xs whitespace-nowrap"
                                      >
                                        <Pencil className="w-3 h-3" />
                                        <span className="hidden sm:inline">Edit</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {!isCollapsed && (
                                    <button
                                      onClick={() => handleDeleteClick(entry.id, reading.id, timeStr12h, entry.load)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )}

                            {/* New Row Insertion - appears after this row if newRowIndex matches */}
                            {newRowIndex === globalIndex + 1 && newRowData && (
                              <tr className="border-b border-green-300 bg-green-50">
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={convertISOToDDMMYYYY(newRowData.date)}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || /^[\d/]*$/.test(value)) {
                                        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                                          setNewRowData({ ...newRowData, date: convertDDMMYYYYToISO(value) });
                                        }
                                      }
                                    }}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none text-center"
                                    placeholder="dd/mm/yyyy"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={newRowData.time}
                                    onChange={(e) => setNewRowData({ ...newRowData, time: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none text-center"
                                    placeholder="HH:MM"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={newRowData.pressure}
                                    onChange={(e) => setNewRowData({ ...newRowData, pressure: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none text-center"
                                    placeholder="Pressure"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200 text-center text-blue-700 font-semibold text-xs">
                                  {newRowData.pressure ? calculateLoad(newRowData.pressure, projectInfo.ramArea) : '-'}
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={newRowData.dg1}
                                    onChange={(e) => setNewRowData({ ...newRowData, dg1: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none text-center"
                                    placeholder="R1"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={newRowData.dg2}
                                    onChange={(e) => setNewRowData({ ...newRowData, dg2: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none text-center"
                                    placeholder="R2"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={newRowData.dg3}
                                    onChange={(e) => setNewRowData({ ...newRowData, dg3: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none text-center"
                                    placeholder="R3"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={newRowData.dg4}
                                    onChange={(e) => setNewRowData({ ...newRowData, dg4: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none text-center"
                                    placeholder="R4"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200 text-center text-green-700 font-semibold text-xs">
                                  {newRowData.dg1 && newRowData.dg2 && newRowData.dg3 && newRowData.dg4 
                                    ? calculateAverageSettlement(newRowData.dg1, newRowData.dg2, newRowData.dg3, newRowData.dg4) 
                                    : '-'}
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <input
                                    type="text"
                                    value={newRowData.remark}
                                    onChange={(e) => setNewRowData({ ...newRowData, remark: e.target.value })}
                                    className="w-full h-7 px-1 text-xs rounded border border-green-300 focus:border-green-500 outline-none"
                                    placeholder="Remark"
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-slate-200">
                                  <div className="flex items-center gap-1 justify-center">
                                    <button
                                      onClick={handleSaveNewRow}
                                      disabled={isSaving}
                                      className="text-green-600 hover:bg-green-100 p-1.5 rounded transition-colors"
                                      title="Save"
                                    >
                                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={handleCancelNewRow}
                                      className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-1 py-1"></td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Empty State
        <div className="bg-white rounded-xl shadow-sm p-8 text-center mt-4">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-gray-900 font-semibold mb-1">No Readings Yet</h3>
          <p className="text-gray-500 text-sm">
            Fill the form below to record your first measurement
          </p>
        </div>
      )}

      {/* Page Navigation */}
      {loadEntries.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-slate-200 px-3 py-2">
          {/* Previous Page */}
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              currentPage === 1
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-100 active:scale-95'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                  page === currentPage
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ))}
            
            {/* Add New Page Button - shows when current page is full */}
            {isCurrentPageFull && (
              <button
                onClick={handleAddNewPage}
                className="flex items-center gap-1 px-3 py-1.5 ml-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 active:scale-95 transition-all shadow-sm"
              >
                <FilePlus className="w-4 h-4" />
                <span>New Page</span>
              </button>
            )}
          </div>

          {/* Next Page */}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              currentPage === totalPages
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-100 active:scale-95'
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Add Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 space-y-3">
        {/* Validation Error */}
        {validationError && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 text-sm">
            {validationError}
          </div>
        )}

        {/* Row 1: Date & Time */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date</label>
            <input
              type="text"
              value={qDate ? convertISOToDDMMYYYY(qDate) : ''}
              onChange={(e) => {
                const value = e.target.value;
                // Allow user to type freely
                if (value === '' || /^[\d/]*$/.test(value)) {
                  // If complete format, convert to ISO
                  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                    setQDate(convertDDMMYYYYToISO(value));
                  } else {
                    // Store the partial input as-is
                    setQDate(value);
                  }
                }
              }}
              placeholder="dd/mm/yyyy"
              className="w-full h-10 px-2 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Time (24h)</label>
            <input
              type="text"
              pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
              placeholder="HH:MM"
              value={qTime}
              onChange={(e) => setQTime(e.target.value)}
              className="w-full h-10 px-2 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </div>
        </div>

        {/* Row 2: Phase Selector */}
        <div className="grid grid-cols-3 gap-1">
          {phases.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setQPhase(p.key)}
              className={`py-2 text-xs font-medium rounded transition-all ${
                qPhase === p.key
                  ? `${p.color} text-white`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Row 3: Pressure */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Pressure (kg/cm²)</label>
          <input
            type="number"
            step="0.01"
            value={qPressure}
            onChange={(e) => setQPressure(e.target.value)}
            placeholder="e.g., 50.00"
            className="w-full h-10 px-3 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
          />
        </div>

        {/* Row 4: Dial Gauge Readings */}
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">R1</label>
            <input
              type="number"
              step="0.01"
              value={qDg1}
              onChange={(e) => setQDg1(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-2 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-center"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">R2</label>
            <input
              type="number"
              step="0.01"
              value={qDg2}
              onChange={(e) => setQDg2(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-2 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-center"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">R3</label>
            <input
              type="number"
              step="0.01"
              value={qDg3}
              onChange={(e) => setQDg3(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-2 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-center"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">R4</label>
            <input
              type="number"
              step="0.01"
              value={qDg4}
              onChange={(e) => setQDg4(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-2 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-center"
            />
          </div>
        </div>

        {/* Row 5: Remark */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Remark (optional)</label>
          <input
            type="text"
            value={qRemark}
            onChange={(e) => setQRemark(e.target.value)}
            placeholder="Notes..."
            className="w-full h-10 px-3 text-sm rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
          />
        </div>

        {/* Add Quick Reading Button */}
        <button
          onClick={handleQuickAdd}
          disabled={isSaving}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              <span>+ Add Quick Reading</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
