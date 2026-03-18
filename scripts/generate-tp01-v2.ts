/**
 * Generate TP-01 report V2 - using extracted + corrected readings, all 116 rows
 * With correct project metadata from user confirmation
 */
import { PrismaClient } from '@prisma/client';
import { IvpltEngine } from '../src/engines/ivplt-engine';
import { generatePDFWithPageNumbers } from '../src/lib/pdf/generator';
import { generateIvpltReportHtml } from '../src/lib/pdf/templates/ivplt-template';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const readingsPath = '/tmp/tp01-v6-readings.json';
  try {
    await fs.access(readingsPath);
  } catch {
    console.error(`❌ Readings file not found at ${readingsPath}`);
    console.error('   Run the ingest script first (e.g. scripts/ingest-tp01-v2.ts)');
    process.exit(1);
  }

  const rawReadings = JSON.parse(
    await fs.readFile(readingsPath, 'utf-8')
  );
  console.log(`Loaded ${rawReadings.length} corrected readings`);

  // 1. Find or create project
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
  }
  console.log('Project:', project.id);

  // 2. Find existing test or create new
  let test = await prisma.test.findFirst({
    where: { projectId: project.id, pileId: 'TP-01' },
  });
  if (test) {
    await prisma.reading.deleteMany({ where: { testId: test.id } });
    // Update with correct metadata
    test = await prisma.test.update({
      where: { id: test.id },
      data: {
        reportNo: 'IVPLT-03',
        testDate: new Date('2026-01-06T00:00:00+05:30'),
        pileDiameterMm: 1000,
        pileDepthM: 10,
        concreteGrade: 'M25',
        designLoadT: 1250,
        testLoadT: 3125, // 2.5 × design load for IVPLT
        ramAreaCm2: 5102,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  } else {
    test = await prisma.test.create({
      data: {
        projectId: project.id,
        testType: 'IVPLT',
        reportNo: 'IVPLT-03',
        pileId: 'TP-01',
        testDate: new Date('2026-01-06T00:00:00+05:30'),
        pileDiameterMm: 1000,
        pileDepthM: 10,
        concreteGrade: 'M25',
        designLoadT: 1250,
        testLoadT: 3125,
        ramAreaCm2: 5102,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  }
  console.log('Test:', test.id);

  // 3. Map phases and insert all 116 readings
  const phaseMap: Record<string, string> = {
    loading: 'LOADING',
    holding: 'HOLD',
    unloading: 'UNLOADING',
  };

  for (const r of rawReadings) {
    // Determine phase from extraction (fixed phase labels)
    let phase = phaseMap[r.phase] || 'LOADING';
    // Handle the fixed phase names directly
    if (r.phase === 'loading') phase = 'LOADING';
    else if (r.phase === 'holding') phase = 'HOLD';
    else if (r.phase === 'unloading') phase = 'UNLOADING';
    
    // Build timestamp from date + time
    let recordedAt = new Date('2026-01-06T15:14:00+05:30');
    if (r.date && r.time) {
      try {
        const dateParts = r.date.split('-').map(Number);
        const [y, m, d] = dateParts[0] > 31 ? dateParts : [dateParts[2], dateParts[1], dateParts[0]];
        const [hh, mm] = r.time.split(':').map(Number);
        recordedAt = new Date(Date.UTC(y, m - 1, d, hh - 5, mm - 30)); // IST offset
      } catch {}
    }

    await prisma.reading.create({
      data: {
        testId: test.id,
        sequence: r.sequence,
        phase: phase as any,
        pressureKgCm2: r.pressure,
        loadT: (r.pressure * 5102) / 1000,
        dg1: r.dg1,
        dg2: r.dg2,
        dg3: r.dg3,
        dg4: r.dg4,
        avgSettlementMm: r.calculatedAvg,
        recordedAt,
        remark: r.remark || null,
      },
    });
  }
  console.log(`Inserted ${rawReadings.length} readings`);

  // 4. Run engine calculations
  const engine = new IvpltEngine();
  
  // Get readings back from DB (SSOT)
  const dbReadings = await prisma.reading.findMany({
    where: { testId: test.id },
    orderBy: { sequence: 'asc' },
  });

  const readingInputs = dbReadings.map((r) => ({
    sequence: r.sequence,
    phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
    loadT: r.loadT,
    avgSettlementMm: r.avgSettlementMm,
  }));

  const meta = {
    pileDiameterMm: 1000,
    pileDepthM: 10,
    designLoadT: 1250,
    testLoadT: 3125,
    ramAreaCm2: 5102,
  };

  const result = engine.calculate(readingInputs, meta);

  console.log('\nCalculation Results:');
  console.log(JSON.stringify(result, null, 2));

  // 5. Update test with results
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

  // 6. Generate report
  const extendedReadings = dbReadings.map((r) => ({
    sequence: r.sequence,
    phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
    loadT: r.loadT,
    avgSettlementMm: r.avgSettlementMm,
    dialGauge1: r.dg1.toString(),
    dialGauge2: r.dg2.toString(),
    dialGauge3: r.dg3.toString(),
    dialGauge4: r.dg4.toString(),
    timestamp: r.recordedAt?.toISOString(),
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
    reportNo: 'IVPLT-03',
    testDate: new Date('2026-01-06T00:00:00+05:30').toISOString(),
    pileDiameterMm: 1000,
    pileDepthM: 10,
    concreteGrade: 'M25',
    designLoadT: 1250,
    testLoadT: 3125,
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
  await fs.writeFile('/tmp/tp01-v2-report.html', html);

  try {
    const pdfBuffer = await generatePDFWithPageNumbers(html);
    const outputDir = '/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports';
    await fs.mkdir(outputDir, { recursive: true });
    const pdfPath = path.join(outputDir, 'tp-01-ivplt-agent-generated-report-v6.pdf');
    await fs.writeFile(pdfPath, pdfBuffer);
    console.log('\nPDF generated:', pdfPath);
    console.log('Size:', pdfBuffer.length, 'bytes');
  } catch (err) {
    console.error('PDF generation failed:', err);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
