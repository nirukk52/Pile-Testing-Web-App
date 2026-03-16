/**
 * Generate report for TP-01 IVPLT - Prestige Nautilus Worli
 * Inserts project + test + readings into DB, then generates PDF.
 */
import { PrismaClient } from '@prisma/client';
import { IvpltEngine } from '../src/engines/ivplt-engine';
import { generatePDFWithPageNumbers } from '../src/lib/pdf/generator';
import { generateIvpltReportHtml } from '../src/lib/pdf/templates/ivplt-template';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

interface ReadingRow {
  sequence: number;
  phase: 'LOADING' | 'HOLD' | 'UNLOADING';
  pressureKgCm2: number;
  loadT: number;
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;
  avgSettlementMm: number;
  recordedAt: Date;
  remark?: string;
}

async function main() {
  // 1. Create or find project
  let project = await prisma.project.findFirst({
    where: { name: 'Prestige Nautilus Worli' },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Prestige Nautilus Worli',
        client: 'Prestige',
        contractor: 'L&T',
        pmc: 'ZedGeo Systems Pvt Ltd',
        location: 'Rehab SRA Plot B, Worli',
      },
    });
    console.log('Created project:', project.id);
  } else {
    console.log('Found existing project:', project.id);
  }

  // 2. Check if test already exists
  let test = await prisma.test.findFirst({
    where: { projectId: project.id, pileId: 'TP-01' },
  });

  if (test) {
    // Delete existing readings to re-insert
    await prisma.reading.deleteMany({ where: { testId: test.id } });
    console.log('Cleared existing readings for test:', test.id);
  } else {
    test = await prisma.test.create({
      data: {
        projectId: project.id,
        testType: 'IVPLT',
        pileId: 'TP-01',
        testDate: new Date('2026-01-06T15:14:00+05:30'),
        pileDiameterMm: 1000,
        pileDepthM: 0, // Not specified in field sheet
        concreteGrade: 'Not specified',
        designLoadT: 1250,
        testLoadT: 2500,
        ramAreaCm2: 5102,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
    console.log('Created test:', test.id);
  }

  // 3. Build readings array
  // Loading phase - last reading at each load stage (stabilized)
  const readings: ReadingRow[] = [
    // LOADING
    { sequence: 1, phase: 'LOADING', pressureKgCm2: 0, loadT: 0, dg1: 0, dg2: 0, dg3: 0, dg4: 0, avgSettlementMm: 0, recordedAt: new Date('2026-01-06T15:14:00+05:30') },
    { sequence: 2, phase: 'LOADING', pressureKgCm2: 40, loadT: 204.08, dg1: 0.42, dg2: 0.48, dg3: 0.30, dg4: 0.32, avgSettlementMm: 0.38, recordedAt: new Date('2026-01-06T16:15:00+05:30') },
    { sequence: 3, phase: 'LOADING', pressureKgCm2: 80, loadT: 408.16, dg1: 1.07, dg2: 1.02, dg3: 0.67, dg4: 0.67, avgSettlementMm: 0.86, recordedAt: new Date('2026-01-06T17:15:00+05:30') },
    { sequence: 4, phase: 'LOADING', pressureKgCm2: 120, loadT: 612.24, dg1: 1.67, dg2: 1.54, dg3: 1.12, dg4: 1.05, avgSettlementMm: 1.35, recordedAt: new Date('2026-01-06T18:15:00+05:30') },
    { sequence: 5, phase: 'LOADING', pressureKgCm2: 160, loadT: 816.32, dg1: 2.32, dg2: 2.12, dg3: 1.65, dg4: 1.52, avgSettlementMm: 1.90, recordedAt: new Date('2026-01-06T19:15:00+05:30') },
    { sequence: 6, phase: 'LOADING', pressureKgCm2: 200, loadT: 1020.40, dg1: 3.02, dg2: 2.78, dg3: 2.26, dg4: 2.10, avgSettlementMm: 2.54, recordedAt: new Date('2026-01-06T20:15:00+05:30') },
    { sequence: 7, phase: 'LOADING', pressureKgCm2: 240, loadT: 1224.48, dg1: 3.48, dg2: 3.21, dg3: 2.70, dg4: 2.51, avgSettlementMm: 2.98, recordedAt: new Date('2026-01-06T21:15:00+05:30') },
    { sequence: 8, phase: 'LOADING', pressureKgCm2: 280, loadT: 1428.56, dg1: 4.01, dg2: 3.66, dg3: 3.14, dg4: 2.92, avgSettlementMm: 3.43, recordedAt: new Date('2026-01-06T22:15:00+05:30') },
    { sequence: 9, phase: 'LOADING', pressureKgCm2: 320, loadT: 1632.64, dg1: 4.50, dg2: 4.13, dg3: 3.59, dg4: 3.34, avgSettlementMm: 3.89, recordedAt: new Date('2026-01-06T23:15:00+05:30') },
    { sequence: 10, phase: 'LOADING', pressureKgCm2: 360, loadT: 1836.72, dg1: 5.13, dg2: 4.67, dg3: 4.13, dg4: 3.86, avgSettlementMm: 4.45, recordedAt: new Date('2026-01-07T00:15:00+05:30') },
    { sequence: 11, phase: 'LOADING', pressureKgCm2: 400, loadT: 2040.80, dg1: 5.70, dg2: 5.31, dg3: 4.67, dg4: 4.28, avgSettlementMm: 4.99, recordedAt: new Date('2026-01-07T01:15:00+05:30') },
    { sequence: 12, phase: 'LOADING', pressureKgCm2: 450, loadT: 2295.90, dg1: 6.24, dg2: 5.93, dg3: 5.21, dg4: 4.92, avgSettlementMm: 5.58, recordedAt: new Date('2026-01-07T02:15:00+05:30') },
    { sequence: 13, phase: 'LOADING', pressureKgCm2: 500, loadT: 2551.00, dg1: 6.85, dg2: 6.37, dg3: 5.61, dg4: 5.34, avgSettlementMm: 6.04, recordedAt: new Date('2026-01-07T02:16:00+05:30'), remark: 'Holding for 24 hours' },

    // HOLD (24hr at max load - hourly readings, using last stabilized value)
    { sequence: 14, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 6.87, dg2: 6.39, dg3: 6.52, dg4: 5.37, avgSettlementMm: 6.29, recordedAt: new Date('2026-01-07T03:16:00+05:30') },
    { sequence: 15, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 6.88, dg2: 6.41, dg3: 6.54, dg4: 5.39, avgSettlementMm: 6.31, recordedAt: new Date('2026-01-07T04:16:00+05:30') },
    { sequence: 16, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 6.90, dg2: 6.43, dg3: 6.56, dg4: 5.40, avgSettlementMm: 6.32, recordedAt: new Date('2026-01-07T05:16:00+05:30') },
    { sequence: 17, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 6.93, dg2: 6.44, dg3: 6.57, dg4: 5.42, avgSettlementMm: 6.34, recordedAt: new Date('2026-01-07T06:16:00+05:30') },
    { sequence: 18, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 6.94, dg2: 6.45, dg3: 6.58, dg4: 5.43, avgSettlementMm: 6.35, recordedAt: new Date('2026-01-07T07:16:00+05:30') },
    { sequence: 19, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 6.97, dg2: 6.48, dg3: 6.59, dg4: 5.48, avgSettlementMm: 6.38, recordedAt: new Date('2026-01-07T08:16:00+05:30') },
    { sequence: 20, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.06, dg2: 6.62, dg3: 6.67, dg4: 5.56, avgSettlementMm: 6.48, recordedAt: new Date('2026-01-07T09:16:00+05:30') },
    { sequence: 21, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.14, dg2: 6.71, dg3: 6.80, dg4: 5.67, avgSettlementMm: 6.58, recordedAt: new Date('2026-01-07T10:16:00+05:30') },
    { sequence: 22, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.25, dg2: 6.83, dg3: 7.00, dg4: 5.78, avgSettlementMm: 6.72, recordedAt: new Date('2026-01-07T11:16:00+05:30') },
    { sequence: 23, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.28, dg2: 6.88, dg3: 7.10, dg4: 5.85, avgSettlementMm: 6.78, recordedAt: new Date('2026-01-07T12:16:00+05:30') },
    { sequence: 24, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.33, dg2: 6.93, dg3: 7.16, dg4: 5.91, avgSettlementMm: 6.83, recordedAt: new Date('2026-01-07T13:16:00+05:30') },
    { sequence: 25, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.35, dg2: 6.96, dg3: 7.25, dg4: 6.05, avgSettlementMm: 6.90, recordedAt: new Date('2026-01-07T14:16:00+05:30') },
    { sequence: 26, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.42, dg2: 7.02, dg3: 7.30, dg4: 6.17, avgSettlementMm: 6.98, recordedAt: new Date('2026-01-07T15:16:00+05:30') },
    { sequence: 27, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.43, dg2: 7.05, dg3: 7.36, dg4: 6.21, avgSettlementMm: 7.01, recordedAt: new Date('2026-01-07T16:16:00+05:30') },
    { sequence: 28, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.45, dg2: 7.06, dg3: 7.37, dg4: 6.23, avgSettlementMm: 7.03, recordedAt: new Date('2026-01-07T17:16:00+05:30') },
    { sequence: 29, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.46, dg2: 7.07, dg3: 7.38, dg4: 6.24, avgSettlementMm: 7.04, recordedAt: new Date('2026-01-07T18:16:00+05:30') },
    { sequence: 30, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.46, dg2: 7.08, dg3: 7.39, dg4: 6.25, avgSettlementMm: 7.05, recordedAt: new Date('2026-01-07T19:16:00+05:30') },
    { sequence: 31, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.46, dg2: 7.08, dg3: 7.40, dg4: 6.25, avgSettlementMm: 7.05, recordedAt: new Date('2026-01-07T20:16:00+05:30') },
    { sequence: 32, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.45, dg2: 7.07, dg3: 7.39, dg4: 6.24, avgSettlementMm: 7.04, recordedAt: new Date('2026-01-07T21:16:00+05:30') },
    { sequence: 33, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.45, dg2: 7.07, dg3: 7.39, dg4: 6.24, avgSettlementMm: 7.04, recordedAt: new Date('2026-01-07T22:16:00+05:30') },
    { sequence: 34, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.44, dg2: 7.05, dg3: 7.38, dg4: 6.23, avgSettlementMm: 7.03, recordedAt: new Date('2026-01-07T23:16:00+05:30') },
    { sequence: 35, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.42, dg2: 7.03, dg3: 7.35, dg4: 6.20, avgSettlementMm: 7.00, recordedAt: new Date('2026-01-08T00:16:00+05:30') },
    { sequence: 36, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.40, dg2: 7.01, dg3: 7.33, dg4: 6.18, avgSettlementMm: 6.98, recordedAt: new Date('2026-01-08T01:16:00+05:30') },
    { sequence: 37, phase: 'HOLD', pressureKgCm2: 500, loadT: 2551.00, dg1: 7.38, dg2: 7.00, dg3: 7.30, dg4: 6.15, avgSettlementMm: 6.96, recordedAt: new Date('2026-01-08T02:16:00+05:30'), remark: 'End of 24hr hold' },

    // UNLOADING
    { sequence: 38, phase: 'UNLOADING', pressureKgCm2: 450, loadT: 2295.90, dg1: 7.34, dg2: 6.97, dg3: 7.27, dg4: 6.12, avgSettlementMm: 6.93, recordedAt: new Date('2026-01-08T02:45:00+05:30') },
    { sequence: 39, phase: 'UNLOADING', pressureKgCm2: 400, loadT: 2040.80, dg1: 7.27, dg2: 6.93, dg3: 7.22, dg4: 6.07, avgSettlementMm: 6.87, recordedAt: new Date('2026-01-08T03:15:00+05:30') },
    { sequence: 40, phase: 'UNLOADING', pressureKgCm2: 360, loadT: 1836.72, dg1: 7.24, dg2: 6.90, dg3: 7.19, dg4: 6.00, avgSettlementMm: 6.83, recordedAt: new Date('2026-01-08T03:45:00+05:30') },
    { sequence: 41, phase: 'UNLOADING', pressureKgCm2: 320, loadT: 1632.64, dg1: 7.15, dg2: 6.86, dg3: 7.13, dg4: 5.87, avgSettlementMm: 6.75, recordedAt: new Date('2026-01-08T04:15:00+05:30') },
    { sequence: 42, phase: 'UNLOADING', pressureKgCm2: 280, loadT: 1428.56, dg1: 6.99, dg2: 6.73, dg3: 7.03, dg4: 5.78, avgSettlementMm: 6.63, recordedAt: new Date('2026-01-08T04:45:00+05:30') },
    { sequence: 43, phase: 'UNLOADING', pressureKgCm2: 240, loadT: 1224.48, dg1: 6.76, dg2: 6.67, dg3: 6.87, dg4: 5.69, avgSettlementMm: 6.50, recordedAt: new Date('2026-01-08T05:15:00+05:30') },
    { sequence: 44, phase: 'UNLOADING', pressureKgCm2: 200, loadT: 1020.40, dg1: 6.40, dg2: 6.50, dg3: 6.73, dg4: 5.58, avgSettlementMm: 6.30, recordedAt: new Date('2026-01-08T05:45:00+05:30') },
    { sequence: 45, phase: 'UNLOADING', pressureKgCm2: 160, loadT: 816.32, dg1: 6.09, dg2: 6.20, dg3: 6.39, dg4: 5.21, avgSettlementMm: 5.97, recordedAt: new Date('2026-01-08T06:15:00+05:30') },
    { sequence: 46, phase: 'UNLOADING', pressureKgCm2: 120, loadT: 612.24, dg1: 5.50, dg2: 5.55, dg3: 5.68, dg4: 5.00, avgSettlementMm: 5.43, recordedAt: new Date('2026-01-08T06:45:00+05:30') },
    { sequence: 47, phase: 'UNLOADING', pressureKgCm2: 80, loadT: 408.16, dg1: 5.24, dg2: 5.34, dg3: 5.37, dg4: 4.83, avgSettlementMm: 5.20, recordedAt: new Date('2026-01-08T07:15:00+05:30') },
    { sequence: 48, phase: 'UNLOADING', pressureKgCm2: 40, loadT: 204.08, dg1: 4.82, dg2: 4.96, dg3: 5.03, dg4: 4.54, avgSettlementMm: 4.84, recordedAt: new Date('2026-01-08T07:45:00+05:30') },
    { sequence: 49, phase: 'UNLOADING', pressureKgCm2: 0, loadT: 0, dg1: 3.50, dg2: 3.41, dg3: 3.46, dg4: 3.43, avgSettlementMm: 3.45, recordedAt: new Date('2026-01-08T08:15:00+05:30'), remark: 'Net settlement = 3.45 mm' },
  ];

  // 4. Insert readings
  for (const r of readings) {
    await prisma.reading.create({
      data: {
        testId: test.id,
        sequence: r.sequence,
        phase: r.phase,
        pressureKgCm2: r.pressureKgCm2,
        loadT: r.loadT,
        dg1: r.dg1,
        dg2: r.dg2,
        dg3: r.dg3,
        dg4: r.dg4,
        avgSettlementMm: r.avgSettlementMm,
        recordedAt: r.recordedAt,
        remark: r.remark || null,
      },
    });
  }
  console.log(`Inserted ${readings.length} readings`);

  // 5. Run engine calculations
  const engine = new IvpltEngine();
  const readingInputs = readings.map((r) => ({
    sequence: r.sequence,
    phase: r.phase,
    loadT: r.loadT,
    avgSettlementMm: r.avgSettlementMm,
  }));
  const meta = {
    pileDiameterMm: 1000,
    pileDepthM: 0,
    designLoadT: 1250,
    testLoadT: 2500,
    ramAreaCm2: 5102,
  };
  const result = engine.calculate(readingInputs, meta);
  console.log('Calculation result:', JSON.stringify(result, null, 2));

  // 6. Update test with results
  await prisma.test.update({
    where: { id: test.id },
    data: {
      maxSettlementMm: result.maxSettlementMm,
      elasticReboundMm: result.elasticReboundMm,
      netSettlementMm: result.netSettlementMm,
      safeLoadAdoptedT: result.safeLoadAdoptedT,
      isPassed: result.isPassed,
      status: 'COMPLETED',
    },
  });
  console.log('Updated test with results');

  // 7. Generate report HTML and PDF
  const extendedReadings = readings.map((r) => ({
    sequence: r.sequence,
    phase: r.phase,
    loadT: r.loadT,
    avgSettlementMm: r.avgSettlementMm,
    dialGauge1: r.dg1.toString(),
    dialGauge2: r.dg2.toString(),
    dialGauge3: r.dg3.toString(),
    dialGauge4: r.dg4.toString(),
    timestamp: r.recordedAt.toISOString(),
    pressureGauge: r.pressureKgCm2.toString(),
    remark: r.remark || undefined,
  }));

  const reportData = {
    projectName: 'Prestige Nautilus Worli',
    client: 'Prestige',
    contractor: 'L&T',
    pmc: 'ZedGeo Systems Pvt Ltd',
    location: 'Rehab SRA Plot B, Worli',
    pileId: 'TP-01',
    testDate: new Date('2026-01-06T15:14:00+05:30').toISOString(),
    pileDiameterMm: 1000,
    pileDepthM: 0,
    concreteGrade: 'Not specified',
    designLoadT: 1250,
    testLoadT: 2500,
    jackName: undefined,
    ramAreaCm2: 5102,
    gaugeLeastCountMm: 0.01,
    result,
    readings: extendedReadings,
    siteImages: [],
    fieldReadings: [],
    calibrationCertificates: [],
  };

  const html = generateIvpltReportHtml(reportData);

  // Write HTML for debugging
  const htmlPath = path.join('/tmp', 'tp01-report.html');
  await fs.writeFile(htmlPath, html);
  console.log('HTML written to:', htmlPath);

  // Generate PDF
  try {
    const pdfBuffer = await generatePDFWithPageNumbers(html);
    const outputDir = '/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports';
    await fs.mkdir(outputDir, { recursive: true });
    const pdfPath = path.join(outputDir, 'TP-01_IVPLT_2026-01-06_Report.pdf');
    await fs.writeFile(pdfPath, pdfBuffer);
    console.log('PDF generated:', pdfPath);
    console.log('Size:', pdfBuffer.length, 'bytes');
  } catch (err) {
    console.error('PDF generation failed:', err);
    console.log('HTML report is available at:', htmlPath);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
