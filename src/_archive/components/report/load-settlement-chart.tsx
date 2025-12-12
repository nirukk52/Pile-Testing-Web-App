'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { CalculatedReading, ReportSummary } from '@/types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Props for the LoadSettlementChart component.
 */
interface LoadSettlementChartProps {
  /** Readings from loading phase */
  loadingReadings: CalculatedReading[];
  /** Readings from unloading phase */
  unloadingReadings: CalculatedReading[];
  /** Report summary for context */
  summary: ReportSummary;
}

/**
 * Interactive Load vs Settlement chart using Chart.js.
 * Why: Visualizes pile behavior under load with loading/unloading curves,
 * following IS 2911 reporting standards. Y-axis is inverted (settlement goes down).
 */
export function LoadSettlementChart({
  loadingReadings,
  unloadingReadings,
  summary,
}: LoadSettlementChartProps) {
  // Transform readings into chart data points
  const chartData = useMemo(() => {
    // Loading phase: solid blue line
    const loadingData = loadingReadings.map((r) => ({
      x: r.load,
      y: r.avgSettlement,
    }));

    // Unloading phase: dashed green line
    const unloadingData = unloadingReadings.map((r) => ({
      x: r.load,
      y: r.avgSettlement,
    }));

    return {
      datasets: [
        {
          label: 'Loading Phase',
          data: loadingData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#2563eb',
          pointBorderWidth: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Unloading Phase',
          data: unloadingData,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#10b981',
          pointBorderWidth: 2,
          tension: 0.3,
          fill: false,
        },
      ],
    };
  }, [loadingReadings, unloadingReadings]);

  // Chart configuration
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear' as const,
          title: {
            display: true,
            text: 'Load (MT)',
            font: { weight: 'bold' as const },
            color: '#64748b',
          },
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b' },
        },
        y: {
          reverse: true, // Settlement goes DOWN (geotech convention)
          title: {
            display: true,
            text: 'Settlement (mm)',
            font: { weight: 'bold' as const },
            color: '#64748b',
          },
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b' },
          suggestedMin: 0,
          suggestedMax: Math.max(summary.grossSettlement * 1.2, 12),
        },
      },
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            label: (context: TooltipItem<'line'>) => {
              const label = context.dataset.label || 'Data';
              const yVal = context.parsed.y ?? 0;
              const xVal = context.parsed.x ?? 0;
              return `${label}: ${yVal.toFixed(2)} mm at ${xVal.toFixed(2)} MT`;
            },
          },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [summary.grossSettlement]
  );

  // Determine badge text based on test type
  const badgeText = summary.testType === 'IVPLT' ? 'Initial Test' : 'Routine Test';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-700">
          Load vs. Settlement Curve
        </h3>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-700">
          {badgeText}
        </span>
      </div>
      <div className="h-[400px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

