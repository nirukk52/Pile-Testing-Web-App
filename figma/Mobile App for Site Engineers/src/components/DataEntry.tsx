import { useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { LoadEntry, Reading, ProjectInfo } from '../App';
import { AddReadingPage } from './AddReadingPage';
import React from 'react';

interface DataEntryProps {
  loadEntries: LoadEntry[];
  setLoadEntries: (entries: LoadEntry[]) => void;
  projectInfo: ProjectInfo;
}

export function DataEntry({
  loadEntries,
  setLoadEntries,
  projectInfo,
}: DataEntryProps) {
  const [showAddReading, setShowAddReading] = useState(false);
  const [insertAtIndex, setInsertAtIndex] = useState<number | undefined>(undefined);

  // Calculate load from pressure
  const calculateLoad = (pressure: string) => {
    const ramArea = parseFloat(projectInfo.ramArea);
    const pressureValue = parseFloat(pressure);
    if (ramArea && pressureValue) {
      return ((pressureValue * ramArea) / 1000).toFixed(2);
    }
    return '-';
  };

  // Calculate average of dial gauges
  const calculateAverage = (gauges: string[]) => {
    const values = gauges
      .map((g) => parseFloat(g))
      .filter((v) => !isNaN(v) && v !== 0);

    if (values.length > 0) {
      return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    }
    return '-';
  };

  const handleSaveReading = (data: {
    date: string;
    time: string;
    pressure: string;
    dialGauge1: string;
    dialGauge2: string;
    dialGauge3: string;
    dialGauge4: string;
    remark: string;
    signature: string;
    phase: 'loading' | 'holding' | 'unloading';
  }) => {
    // Combine date and time into ISO timestamp
    const timestamp = new Date(`${data.date}T${data.time}`).toISOString();
    
    const newReading: Reading = {
      id: Date.now().toString(),
      pressureGauge: data.pressure,
      load: calculateLoad(data.pressure),
      dialGauge1: data.dialGauge1,
      dialGauge2: data.dialGauge2,
      dialGauge3: data.dialGauge3,
      dialGauge4: data.dialGauge4,
      timestamp,
      signature: data.signature,
      remark: data.remark,
      phase: data.phase,
    };

    // Create a new load entry for each reading
    const newEntry: LoadEntry = {
      id: Date.now().toString(),
      pressureGauge: data.pressure,
      load: calculateLoad(data.pressure),
      readings: [newReading],
      timestamp,
    };
    
    if (insertAtIndex !== undefined) {
      // Insert at specific position
      const updatedEntries = [...loadEntries];
      updatedEntries.splice(insertAtIndex, 0, newEntry);
      setLoadEntries(updatedEntries);
    } else {
      // Add to end
      setLoadEntries([...loadEntries, newEntry]);
    }
    
    setShowAddReading(false);
    setInsertAtIndex(undefined);
  };

  const deleteReading = (loadId: string) => {
    if (confirm('Delete this reading?')) {
      const updatedEntries = loadEntries.filter((entry) => entry.id !== loadId);
      setLoadEntries(updatedEntries);
    }
  };

  const handleAddBetween = (index: number) => {
    setInsertAtIndex(index);
    setShowAddReading(true);
  };

  const handleAddNew = () => {
    setInsertAtIndex(undefined);
    setShowAddReading(true);
  };

  const handleEditReading = (entryId: string) => {
    // For now, just show an alert - we'll implement full edit functionality next
    alert('Edit functionality coming soon!');
  };

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

  const phases: Array<{ key: 'loading' | 'holding' | 'unloading'; label: string; color: string }> = [
    { key: 'loading', label: 'LOADING', color: 'bg-blue-600' },
    { key: 'holding', label: 'HOLDING', color: 'bg-amber-600' },
    { key: 'unloading', label: 'UNLOADING', color: 'bg-green-600' },
  ];

  return (
    <div className="p-2 space-y-3">
      {/* Readings Table */}
      {loadEntries.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-300">
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[70px]">DATE</th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[60px]">TIME<br/>(Hrs)</th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[70px]">PRESSURE<br/>GAUGE<br/>READING<br/>kg/cm2</th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[60px]">LOAD IN MT</th>
                  <th colSpan={4} className="px-2 py-2 border-r border-slate-300">Dial Gauge</th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[70px]">AVERAGE<br/>SETTLEMENT<br/>IN MM</th>
                  <th className="px-2 py-2 border-r border-slate-300 min-w-[80px]">REMARK</th>
                  <th className="px-2 py-2 border-r border-slate-300 w-[100px]"></th>
                  <th className="px-2 py-2 w-[40px]"></th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <th colSpan={4} className="border-r border-slate-300"></th>
                  <th className="px-2 py-1 border-r border-slate-300">Reading<br/>1</th>
                  <th className="px-2 py-1 border-r border-slate-300">Reading<br/>2</th>
                  <th className="px-2 py-1 border-r border-slate-300">Reading<br/>3</th>
                  <th className="px-2 py-1 border-r border-slate-300">Reading<br/>4</th>
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
                  const phaseInfo = phases.find(p => p.key === phase);
                  
                  const loadDate = new Date(reading.timestamp);
                  const dateStr = loadDate.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const timeStr = loadDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });

                  const avg = calculateAverage([
                    reading.dialGauge1,
                    reading.dialGauge2,
                    reading.dialGauge3,
                    reading.dialGauge4,
                  ]);

                  // Check if we need to show phase header
                  const prevEntry = globalIndex > 0 ? loadEntries[globalIndex - 1] : null;
                  const prevPhase = prevEntry ? prevEntry.readings[0].phase || 'loading' : null;
                  const showPhaseHeader = phase !== prevPhase;

                  // Check for date and pressure changes
                  const prevDate = prevEntry ? new Date(prevEntry.readings[0].timestamp).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }) : null;
                  const prevPressure = prevEntry ? prevEntry.pressureGauge : null;
                  
                  const dateChanged = prevDate && dateStr !== prevDate;
                  const pressureChanged = prevPressure && entry.pressureGauge !== prevPressure;

                  // Check if next entry has different pressure (to add separator row)
                  const nextEntry = globalIndex < loadEntries.length - 1 ? loadEntries[globalIndex + 1] : null;
                  const nextPressure = nextEntry ? nextEntry.pressureGauge : null;
                  const pressureWillChange = nextPressure && entry.pressureGauge !== nextPressure;

                  return (
                    <React.Fragment key={entry.id}>
                      {/* Phase Header Row */}
                      {showPhaseHeader && (
                        <tr>
                          <td colSpan={12} className={`${phaseInfo?.color} text-white text-center py-1 font-semibold border-y border-slate-300`}>
                            {phaseInfo?.label}
                          </td>
                        </tr>
                      )}
                      
                      {/* Data Row */}
                      <tr className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">
                          {dateChanged || globalIndex === 0 ? dateStr : ''}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center">{timeStr}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">{entry.pressureGauge}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold text-blue-700">{entry.load}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">{reading.dialGauge1}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">{reading.dialGauge2}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">{reading.dialGauge3}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold">{reading.dialGauge4}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold text-green-700">{avg}</td>
                        <td className="px-2 py-2 border-r border-slate-200 text-xs text-gray-600 italic">{reading.remark || '-'}</td>
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
                              onClick={() => handleEditReading(entry.id)}
                              className="text-slate-600 hover:bg-slate-50 px-2 py-1 rounded transition-colors flex items-center gap-1 text-xs whitespace-nowrap"
                            >
                              <Pencil className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => deleteReading(entry.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>

                      {/* Empty separator row after pressure change */}
                      {pressureWillChange && (
                        <tr className="bg-slate-50">
                          <td colSpan={12} className="py-2 border-b-2 border-slate-300"></td>
                        </tr>
                      )}
                    </React.Fragment>
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
          <h3 className="text-gray-900 mb-1">No Readings Yet</h3>
          <p className="text-gray-500 text-sm">
            Click "Add Reading" below to record your first measurement
          </p>
        </div>
      )}

      {/* Main Add Reading Button - Now at bottom */}
      <button
        onClick={handleAddNew}
        className="w-full py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
      >
        <Plus className="w-5 h-5" />
        <span>Add Reading</span>
      </button>
    </div>
  );
}