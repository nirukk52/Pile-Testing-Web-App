'use client';

import { useState, Fragment, useEffect } from 'react';
import { Plus, Trash2, Pencil, Loader2, Cloud, CloudOff } from 'lucide-react';
import { AddReadingPage, type NewReadingData } from './add-reading-page';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import type { LoadEntry, LegacyReading, LegacyProjectInfo, LegacyTestPhase } from '@/types';
import { calculateLoad, calculateAverageSettlement } from '@/types';
import { useApiSync } from '@/store/test-store';
import { formatDateDDMMYYYY, convertISOToDDMMYYYY, convertDDMMYYYYToISO } from '@/lib/utils';

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
  const lastDate = new Date(lastReading.timestamp);

  return {
    date: lastDate.toISOString().split('T')[0],
    time: lastDate.toTimeString().slice(0, 5),
    phase: lastReading.phase || 'loading',
    pressure: lastEntry.pressureGauge,
  };
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
  const [showAddReading, setShowAddReading] = useState(false);
  const [insertAtIndex, setInsertAtIndex] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Edit mode state
  const [editingEntry, setEditingEntry] = useState<{ entry: LoadEntry; index: number } | null>(null);

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
  useEffect(() => {
    const newDefaults = getDefaultsFromLastReading(loadEntries);
    setQDate(newDefaults.date);
    setQTime(newDefaults.time);
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

    const timestamp = new Date(`${qDate}T${qTime}`).toISOString();
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

  const handleSaveReading = async (data: NewReadingData) => {
    const timestamp = new Date(`${data.date}T${data.time}`).toISOString();
    const load = data.loadOverride?.toString() || calculateLoad(data.pressure, projectInfo.ramArea);
    const tempId = Date.now().toString();

    const newReading: LegacyReading = {
      id: tempId,
      pressureGauge: data.pressure,
      load,
      dialGauge1: data.dialGauge1,
      dialGauge2: data.dialGauge2,
      dialGauge3: data.dialGauge3,
      dialGauge4: data.dialGauge4,
      dg1Enabled: data.dg1Enabled,
      dg2Enabled: data.dg2Enabled,
      dg3Enabled: data.dg3Enabled,
      dg4Enabled: data.dg4Enabled,
      timestamp,
      signature: data.signature,
      remark: data.remark,
      phase: data.phase,
    };

    const newEntry: LoadEntry = {
      id: `entry-${tempId}`,
      pressureGauge: data.pressure,
      load,
      readings: [newReading],
      timestamp,
    };

    // Add to local state immediately for optimistic update
    onAddEntry(newEntry, insertAtIndex);
    setShowAddReading(false);
    setInsertAtIndex(undefined);

    // Sync to API in background
    setIsSaving(true);
    setSyncStatus('syncing');
    try {
      // Ensure test is saved first
      await saveTestToApi();
      // Then save the reading
      await addReadingToApi(newReading);
      setSyncStatus('synced');
      // Auto-hide sync status after 2 seconds
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to sync reading to API:', error);
      setSyncStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle saving edited reading.
   * Why: Updates existing reading with potential load/avg overrides.
   */
  const handleSaveEditedReading = async (data: NewReadingData) => {
    if (!editingEntry) return;

    const timestamp = new Date(`${data.date}T${data.time}`).toISOString();
    // Use override only if it's a valid number, otherwise calculate
    const load = (data.loadOverride !== undefined && !isNaN(data.loadOverride) && isFinite(data.loadOverride))
      ? data.loadOverride.toString()
      : calculateLoad(data.pressure, projectInfo.ramArea);
    const originalReadingId = editingEntry.entry.readings[0].id;

    const updatedReading: LegacyReading = {
      id: originalReadingId,
      pressureGauge: data.pressure,
      load,
      dialGauge1: data.dialGauge1,
      dialGauge2: data.dialGauge2,
      dialGauge3: data.dialGauge3,
      dialGauge4: data.dialGauge4,
      dg1Enabled: data.dg1Enabled,
      dg2Enabled: data.dg2Enabled,
      dg3Enabled: data.dg3Enabled,
      dg4Enabled: data.dg4Enabled,
      timestamp,
      signature: data.signature,
      remark: data.remark,
      phase: data.phase,
    };

    // Update local state immediately for optimistic update
    onUpdateEntry(editingEntry.entry.id, updatedReading);
    setEditingEntry(null);

    // Sync to API in background
    setIsSaving(true);
    setSyncStatus('syncing');
    try {
      await updateReadingToApi(originalReadingId, updatedReading, data.loadOverride, data.avgOverride);
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

  const handleAddBetween = (index: number) => {
    setInsertAtIndex(index);
    setShowAddReading(true);
  };

  /**
   * Handle edit button click.
   * Why: Opens edit page with existing reading data pre-filled.
   */
  const handleEditReading = (entry: LoadEntry, index: number) => {
    setEditingEntry({ entry, index });
  };

  // Show Add Reading Page (new)
  if (showAddReading) {
    return (
      <AddReadingPage
        onSave={handleSaveReading}
        onCancel={() => {
          setShowAddReading(false);
          setInsertAtIndex(undefined);
        }}
        projectInfo={projectInfo}
      />
    );
  }

  // Show Edit Reading Page
  if (editingEntry) {
    return (
      <AddReadingPage
        onSave={handleSaveEditedReading}
        onCancel={() => setEditingEntry(null)}
        projectInfo={projectInfo}
        editData={editingEntry.entry.readings[0]}
      />
    );
  }

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

      {/* Readings Table */}
      {loadEntries.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-300">
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
                {loadEntries.map((entry, globalIndex) => {
                  const reading = entry.readings[0];
                  const phase = reading.phase || 'loading';
                  const phaseInfo = phases.find((p) => p.key === phase);

                  const loadDate = new Date(reading.timestamp);
                  const dateStr = formatDateDDMMYYYY(loadDate);
                  const timeStr = loadDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                  // Format time for delete modal (12h format)
                  const timeStr12h = loadDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  const avg = calculateAverageSettlement(
                    reading.dialGauge1,
                    reading.dialGauge2,
                    reading.dialGauge3,
                    reading.dialGauge4
                  );

                  // Check if we need to show phase header
                  const prevEntry = globalIndex > 0 ? loadEntries[globalIndex - 1] : null;
                  const prevPhase = prevEntry ? prevEntry.readings[0].phase || 'loading' : null;
                  const showPhaseHeader = phase !== prevPhase;

                  // Check for date changes
                  const prevDate = prevEntry
                    ? formatDateDDMMYYYY(new Date(prevEntry.readings[0].timestamp))
                    : null;
                  const dateChanged = prevDate && dateStr !== prevDate;

                  // Check for pressure changes
                  const prevPressure = prevEntry ? prevEntry.pressureGauge : null;
                  const pressureChanged = !prevPressure || entry.pressureGauge !== prevPressure;

                  // Check for load changes
                  const prevLoad = prevEntry ? prevEntry.load : null;
                  const loadChanged = !prevLoad || entry.load !== prevLoad;

                  // Check if next entry has same pressure/load (to hide border)
                  const nextEntry =
                    globalIndex < loadEntries.length - 1 ? loadEntries[globalIndex + 1] : null;
                  const nextPressure = nextEntry ? nextEntry.pressureGauge : null;
                  const nextLoad = nextEntry ? nextEntry.load : null;
                  const sameAsNext = nextPressure === entry.pressureGauge && nextLoad === entry.load;

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

                      {/* Data Row */}
                      <tr className={`${
                        sameAsNext ? 'border-b border-slate-100' : 'border-b border-slate-200'
                      } hover:bg-slate-50 ${
                        dateChanged || pressureChanged || loadChanged ? 'bg-blue-50/30' : ''
                      }`}>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">
                          {dateChanged || globalIndex === 0 ? dateStr : ''}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center">{timeStr}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">
                          {pressureChanged ? entry.pressureGauge : ''}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold text-blue-700">
                          {loadChanged ? entry.load : ''}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">
                          {reading.dialGauge1}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">
                          {reading.dialGauge2}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">
                          {reading.dialGauge3}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">
                          {reading.dialGauge4}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold text-green-700">
                          {avg}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-xs text-gray-600 italic">
                          {reading.remark || '-'}
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
                            <button
                              onClick={() => handleEditReading(entry, globalIndex)}
                              className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors flex items-center gap-1 text-xs whitespace-nowrap"
                            >
                              <Pencil className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleDeleteClick(entry.id, reading.id, timeStr12h, entry.load)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
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
