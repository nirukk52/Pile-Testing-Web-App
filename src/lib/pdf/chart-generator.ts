/**
 * Chart Generator for PDF Reports
 * Why: Generates Chart.js configuration and script for Load vs Settlement curves.
 * Extracted from ivplt-template.tsx for maintainability and testability.
 */

import type { ReadingInput } from '@/engines';

/**
 * Chart data point with optional connector flag.
 * Why: Connector points link loading to unloading curve without showing a label.
 */
interface ChartDataPoint {
  x: number;
  y: number;
  isConnector?: boolean;
}

/**
 * Processed chart data ready for rendering.
 * Why: Separates data processing from chart rendering logic.
 */
export interface ProcessedChartData {
  loadingData: ChartDataPoint[];
  unloadingData: ChartDataPoint[];
  xMax: number;
  yMax: number;
  xStep: number;
  yStep: number;
}

/**
 * Process raw readings into chart-ready data.
 * Why: Filters to one reading per unique load level (the stabilized/last value).
 * This is the key logic that makes charts readable - ~12 points instead of 100+.
 */
export function processReadingsForChart(readings: ReadingInput[]): ProcessedChartData {
  // Group by load and take LAST reading at each load level (stabilized value)
  function getLastReadingPerLoad(data: { x: number; y: number }[]): ChartDataPoint[] {
    const byLoad: Record<string, ChartDataPoint> = {};
    data.forEach(r => {
      const loadKey = r.x.toFixed(2);
      byLoad[loadKey] = { x: r.x, y: r.y }; // Last one wins
    });
    return Object.values(byLoad).sort((a, b) => a.x - b.x);
  }

  // Convert readings to x,y format and separate by phase
  const loadingRaw = readings
    .filter(r => r.phase === 'LOADING' || r.phase === 'HOLD')
    .map(r => ({ x: r.loadT, y: r.avgSettlementMm }));
  
  const unloadingRaw = readings
    .filter(r => r.phase === 'UNLOADING')
    .map(r => ({ x: r.loadT, y: r.avgSettlementMm }));

  const loadingData = getLastReadingPerLoad(loadingRaw);
  
  // Sort unloading DESCENDING (max → 0) so line draws from max load back to zero
  let unloadingData = getLastReadingPerLoad(unloadingRaw).sort((a, b) => b.x - a.x);

  // Connect the curves: add the last loading point as first unloading point
  if (loadingData.length > 0 && unloadingData.length > 0) {
    const lastLoadingPoint = loadingData[loadingData.length - 1];
    // Insert at beginning to connect the curves (max load point)
    unloadingData = [
      { x: lastLoadingPoint.x, y: lastLoadingPoint.y, isConnector: true },
      ...unloadingData
    ];
  }

  // Calculate nice max values for axes (aligned to grid increments)
  const allData = [...loadingData, ...unloadingData];
  const maxLoad = Math.max(...allData.map(d => d.x), 0);
  const maxSettlement = Math.max(...allData.map(d => d.y), 0);

  // Round up to nice values
  const xStep = 100; // 100T increments for cleaner axis
  const yStep = 0.5; // 0.5mm increments
  
  const xMax = Math.ceil(maxLoad / xStep) * xStep + xStep;
  const yMax = Math.ceil(maxSettlement / yStep) * yStep + yStep;

  return {
    loadingData,
    unloadingData,
    xMax,
    yMax,
    xStep,
    yStep,
  };
}

/**
 * Generate the Chart.js script for embedding in HTML.
 * Why: Creates the complete <script> block for Chart.js initialization.
 * 
 * Label Strategy:
 * - Loading curve: labels ABOVE the line (align: top/right)
 * - Unloading curve: labels BELOW the line (align: bottom/left)
 * - Smart spacing: if too many points, only show labels at intervals
 * 
 * @param readings - Raw reading inputs from the test
 * @returns HTML string containing the Chart.js initialization script
 */
export function generateChartScript(readings: ReadingInput[]): string {
  // Pre-process readings to JSON for embedding
  const readingsJson = JSON.stringify(
    readings.map(r => ({ x: r.loadT, y: r.avgSettlementMm, phase: r.phase }))
  );

  return `
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
      <script>
        (function() {
          Chart.register(ChartDataLabels);
          
          const readings = ${readingsJson};
          
          // Group by load and take LAST reading at each load level (stabilized value)
          function getLastReadingPerLoad(data) {
            const byLoad = {};
            data.forEach(r => {
              const loadKey = r.x.toFixed(2);
              byLoad[loadKey] = { x: r.x, y: r.y };
            });
            return Object.values(byLoad).sort((a, b) => a.x - b.x);
          }
          
          const loadingRaw = readings.filter(r => r.phase === 'LOADING' || r.phase === 'HOLD');
          const unloadingRaw = readings.filter(r => r.phase === 'UNLOADING');
          
          const loadingData = getLastReadingPerLoad(loadingRaw);
          let unloadingData = getLastReadingPerLoad(unloadingRaw).sort((a, b) => b.x - a.x);
          
          // Connect curves
          if (loadingData.length > 0 && unloadingData.length > 0) {
            const lastLoadingPoint = loadingData[loadingData.length - 1];
            unloadingData = [{ x: lastLoadingPoint.x, y: lastLoadingPoint.y, isConnector: true }, ...unloadingData];
          }
          
          // Calculate axis bounds
          const allData = [...loadingData, ...unloadingData];
          const maxLoad = Math.max(...allData.map(d => d.x));
          const maxSettlement = Math.max(...allData.map(d => d.y));
          
          // Dynamic step size based on data range
          const xStep = maxLoad > 1500 ? 200 : 100;
          const yStep = 0.5;
          const xMax = Math.ceil(maxLoad / xStep) * xStep + xStep;
          const yMax = Math.ceil(maxSettlement / yStep) * yStep + yStep;
          
          // Show labels on ALL points (data is pre-filtered to one per load level)
          const datasets = [];
          
          if (loadingData.length > 0) {
            datasets.push({
              label: 'Loading',
              data: loadingData,
              borderColor: '#000000',
              borderWidth: 2,
              pointRadius: 5,
              pointBackgroundColor: '#90EE90',
              pointBorderColor: '#000000',
              pointBorderWidth: 1.5,
              pointStyle: 'rectRot',
              tension: 0,
              fill: false,
              datalabels: {
                align: 'top',
                anchor: 'end',
                offset: 3,
                font: { size: 9, weight: 'bold' },
                color: '#000',
                backgroundColor: 'rgba(255,255,255,0.9)',
                borderRadius: 2,
                padding: 1,
                display: true,
                formatter: function(value) {
                  // Show only the load value (no settlement)
                  return value.x.toFixed(2);
                }
              }
            });
          }
          
          if (unloadingData.length > 0) {
            datasets.push({
              label: 'Unloading',
              data: unloadingData,
              borderColor: '#000000',
              borderWidth: 2,
              pointRadius: unloadingData.map(d => d.isConnector ? 0 : 5),
              pointBackgroundColor: '#000080',
              pointBorderColor: '#000000',
              pointBorderWidth: 1.5,
              pointStyle: 'rect',
              tension: 0,
              fill: false,
              datalabels: {
                align: 'bottom',
                anchor: 'start',
                offset: 3,
                font: { size: 9, weight: 'bold' },
                color: '#000',
                backgroundColor: 'rgba(255,255,255,0.9)',
                borderRadius: 2,
                padding: 1,
                display: function(context) {
                  const d = unloadingData[context.dataIndex];
                  return !d.isConnector;
                },
                formatter: function(value) {
                  // Show only the load value (no settlement)
                  return value.isConnector ? '' : value.x.toFixed(2);
                }
              }
            });
          }
          
          const ctx = document.getElementById('loadSettlementChart').getContext('2d');
          new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              layout: {
                padding: { top: 5, right: 5, bottom: 5, left: 5 }
              },
              plugins: {
                legend: { display: false },
                datalabels: { display: true },
                title: {
                  display: true,
                  text: 'LOAD VS SETTLEMENT',
                  position: 'bottom',
                  font: { size: 12, weight: 'bold' },
                  padding: { top: 10 }
                },
                subtitle: {
                  display: true,
                  text: 'PLT',
                  position: 'bottom',
                  font: { size: 11, weight: 'bold' },
                  padding: { top: 2 }
                }
              },
              scales: {
                x: {
                  type: 'linear',
                  position: 'top',
                  title: { 
                    display: true, 
                    text: 'LOAD ON PILE ( T )', 
                    font: { weight: 'bold', size: 12 },
                    color: '#000',
                    padding: { bottom: 5 }
                  },
                  min: 0,
                  max: xMax,
                  grid: { 
                    display: true, 
                    color: '#c0c0c0',
                    lineWidth: 1
                  },
                  border: { 
                    display: true, 
                    color: '#000',
                    width: 2
                  },
                  ticks: { 
                    font: { size: 10, weight: 'bold' },
                    color: '#000',
                    stepSize: xStep,
                    padding: 3,
                    maxRotation: 0,
                    minRotation: 0
                  }
                },
                y: {
                  reverse: true,
                  title: { 
                    display: true, 
                    text: 'SETTLEMENT (mm)', 
                    font: { weight: 'bold', size: 11 },
                    padding: { top: 5 }
                  },
                  min: 0,
                  max: yMax,
                  grid: { 
                    display: true, 
                    color: '#c0c0c0',
                    lineWidth: 1
                  },
                  border: { 
                    display: true, 
                    color: '#000',
                    width: 2
                  },
                  ticks: { 
                    font: { size: 9, weight: 'bold' },
                    stepSize: yStep,
                    padding: 5
                  }
                }
              }
            }
          });
        })();
      </script>
  `;
}
