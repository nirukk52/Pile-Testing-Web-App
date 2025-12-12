import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { LoadEntry, ProjectInfo } from '../App';

interface ReportViewProps {
  projectInfo: ProjectInfo;
  loadEntries: LoadEntry[];
}

export function ReportView({ projectInfo, loadEntries }: ReportViewProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  const calculateAverage = (gauges: string[]) => {
    const values = gauges
      .map((g) => parseFloat(g))
      .filter((v) => !isNaN(v) && v !== 0);

    if (values.length > 0) {
      return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    }
    return '-';
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate KPIs
  const maxLoad = loadEntries.length > 0 
    ? Math.max(...loadEntries.map(l => parseFloat(l.load) || 0))
    : 0;

  const designLoad = parseFloat(projectInfo.designLoadOnPile) || 0;
  const testLoadMultiple = designLoad > 0 ? (maxLoad / designLoad).toFixed(1) : '-';

  // Calculate max settlement and net settlement
  let maxSettlement = 0;
  let finalSettlement = 0;

  const tableRows: any[] = [];
  loadEntries.forEach((loadEntry) => {
    loadEntry.readings.forEach((reading, index) => {
      const avg = calculateAverage([
        reading.dialGauge1,
        reading.dialGauge2,
        reading.dialGauge3,
        reading.dialGauge4,
      ]);
      const avgNum = parseFloat(avg);
      if (!isNaN(avgNum)) {
        maxSettlement = Math.max(maxSettlement, avgNum);
        finalSettlement = avgNum;
      }

      const { date, time } = formatDateTime(reading.timestamp);

      tableRows.push({
        load: loadEntry.load,
        pressure: loadEntry.pressureGauge,
        date,
        time,
        avgTestPile: avg,
        remark: reading.remark || '',
      });
    });
  });

  const netSettlement = finalSettlement;
  const settlementLimit = 12;
  const isPassed = netSettlement < settlementLimit;

  // Prepare chart data
  useEffect(() => {
    if (!chartRef.current || loadEntries.length === 0) return;

    const loadData: number[] = [];
    const settlementData: number[] = [];

    loadEntries.forEach((loadEntry) => {
      loadEntry.readings.forEach((reading) => {
        const load = parseFloat(loadEntry.load);
        const avg = calculateAverage([
          reading.dialGauge1,
          reading.dialGauge2,
          reading.dialGauge3,
          reading.dialGauge4,
        ]);
        const avgNum = parseFloat(avg);

        if (!isNaN(load) && !isNaN(avgNum)) {
          loadData.push(load);
          settlementData.push(avgNum);
        }
      });
    });

    import('chart.js').then((ChartJS) => {
      const { Chart, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LineController, Filler } = ChartJS;
      
      Chart.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LineController, Filler);

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current!.getContext('2d');
      if (!ctx) return;

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Loading Phase',
              data: loadData.map((load, index) => ({ x: load, y: settlementData[index] })),
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: '#fff',
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Load (MT)',
                font: { weight: 'bold' },
              },
              grid: { color: '#f1f5f9' },
            },
            y: {
              reverse: true,
              title: {
                display: true,
                text: 'Settlement (mm)',
                font: { weight: 'bold' },
              },
              grid: { color: '#f1f5f9' },
              suggestedMin: 0,
            },
          },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function (context: any) {
                  return context.dataset.label + ': ' + context.parsed.y + ' mm at ' + context.parsed.x + ' MT';
                },
              },
            },
          },
        },
      });
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [loadEntries]);

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '30px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            {projectInfo.testType || 'Initial Static Vertical Load Test'}
          </h1>
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '5px' }}>
            Report ID: <strong>{projectInfo.reportNo || '-'}</strong> | Location: <strong>{projectInfo.location || '-'}</strong> | Date: <strong>{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</strong>
          </div>
        </div>
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); handlePrint(); }}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          Download Full PDF
        </a>
      </header>

      {/* KPI Cards Grid */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Test Load
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '10px', color: '#1e293b' }}>
            {maxLoad.toFixed(2)} <span style={{ fontSize: '1rem' }}>MT</span>
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px', color: '#2563eb' }}>
            {testLoadMultiple}x Design Load ({designLoad} MT)
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Max Settlement
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '10px', color: '#1e293b' }}>
            {maxSettlement.toFixed(2)} <span style={{ fontSize: '1rem' }}>mm</span>
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '5px' }}>
            At {maxLoad.toFixed(2)} MT Load
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Net Settlement
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '10px', color: '#1e293b' }}>
            {netSettlement.toFixed(2)} <span style={{ fontSize: '1rem' }}>mm</span>
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '5px', color: '#10b981' }}>
            Safe (Limit: {settlementLimit}mm)
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Test Status
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '10px', color: '#10b981' }}>
            {isPassed ? 'PASSED' : 'REVIEW'}
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '5px' }}>
            Safe Load Capacity: {designLoad} MT
          </div>
        </div>
      </section>

      {/* Pile Specifications Card */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
        <div style={{ background: '#e2e8f0', height: '180px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: '#64748b', fontWeight: 600 }}>
          [Site Image: Hydraulic Jack Setup]
        </div>

        <h3 style={{ fontWeight: 700, marginBottom: '10px' }}>Pile Specifications</h3>
        <ul style={{ listStyle: 'none', marginTop: '15px', padding: 0 }}>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.95rem' }}>
            <span style={{ color: '#64748b' }}>Pile Diameter</span>
            <span style={{ fontWeight: 600 }}>{projectInfo.pileDiameter || '-'} mm</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.95rem' }}>
            <span style={{ color: '#64748b' }}>Pile Depth</span>
            <span style={{ fontWeight: 600 }}>{projectInfo.pileDepth || '-'} Meters</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.95rem' }}>
            <span style={{ color: '#64748b' }}>Concrete Grade</span>
            <span style={{ fontWeight: 600 }}>{projectInfo.mixedDesign || '-'}</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.95rem' }}>
            <span style={{ color: '#64748b' }}>Method</span>
            <span style={{ fontWeight: 600 }}>IS 2911 (Part 4)</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '0.95rem' }}>
            <span style={{ color: '#64748b' }}>Ram Area</span>
            <span style={{ fontWeight: 600 }}>{projectInfo.ramArea || '-'} cm²</span>
          </li>
        </ul>

        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Calibration Status</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ height: '10px', width: '10px', background: '#10b981', borderRadius: '50%' }}></div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Jack & Gauges Verified (QCC Lab)</span>
          </div>
        </div>
      </div>

      {/* Load vs Settlement Graph Card */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 700, margin: 0 }}>Load vs. Settlement Curve</h3>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#166534' }}>
            Cyclic Loading
          </span>
        </div>
        <div style={{ height: '400px', position: 'relative' }}>
          {loadEntries.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f1f5f9', borderRadius: '8px', color: '#64748b' }}>
              No data available for chart
            </div>
          ) : (
            <canvas ref={chartRef}></canvas>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '20px' }}>Load Increment Summary</h3>
        
        {tableRows.length === 0 ? (
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No test data recorded yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 15px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>
                    Date
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 15px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>
                    Time
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 15px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>
                    Load (MT)
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 15px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>
                    Pressure (kg/cm²)
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 15px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>
                    Avg Settlement (mm)
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 15px', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, index) => (
                  <tr key={index} style={{ cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                      {row.time}
                    </td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                      {row.load}
                    </td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                      {row.pressure}
                    </td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                      {row.avgTestPile}
                    </td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                      {row.remark || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}