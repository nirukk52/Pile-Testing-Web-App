import { PrismaClient } from '@prisma/client';
import { IvpltEngine } from '../src/engines/ivplt-engine';
import { generatePDFWithPageNumbers } from '../src/lib/pdf/generator';
import { generateIvpltReportHtml } from '../src/lib/pdf/templates/ivplt-template';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const ingest = JSON.parse(await fs.readFile('/tmp/bdd-tp01-ingest.json', 'utf-8'));
  const rawReadings = ingest.readings as any[];

  let project = await prisma.project.findFirst({ where: { name: 'BDD CHAWLS Redevelopment Project, Worli Mumbai' } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'BDD CHAWLS Redevelopment Project, Worli Mumbai',
        client: 'TATA Project',
        contractor: 'NA',
        pmc: 'NA',
        location: 'Building-3 Wing B',
      },
    });
  }

  let test = await prisma.test.findFirst({ where: { projectId: project.id, pileId: 'TP-01', reportNo: 'IVPLT-001' } });
  if (test) {
    await prisma.reading.deleteMany({ where: { testId: test.id } });
    test = await prisma.test.update({
      where: { id: test.id },
      data: {
        testType: 'IVPLT',
        reportNo: 'IVPLT-001',
        testDate: new Date('2025-12-09T00:00:00+05:30'),
        pileDiameterMm: 900,
        pileDepthM: 11.51,
        concreteGrade: 'M40',
        designLoadT: 420,
        testLoadT: 1050,
        ramAreaCm2: 2551,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  } else {
    test = await prisma.test.create({
      data: {
        projectId: project.id,
        testType: 'IVPLT',
        reportNo: 'IVPLT-001',
        pileId: 'TP-01',
        testDate: new Date('2025-12-09T00:00:00+05:30'),
        pileDiameterMm: 900,
        pileDepthM: 11.51,
        concreteGrade: 'M40',
        designLoadT: 420,
        testLoadT: 1050,
        ramAreaCm2: 2551,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  }

  const phaseMap: Record<string, 'LOADING' | 'HOLD' | 'UNLOADING'> = {
    loading: 'LOADING',
    holding: 'HOLD',
    unloading: 'UNLOADING',
  };

  for (const r of rawReadings) {
    const [y, m, d] = (r.date || '2025-12-09').split('-').map(Number);
    const [hh, mm] = (r.time || '00:00').split(':').map(Number);
    const recordedAt = new Date(Date.UTC(y, m - 1, d, hh - 5, mm - 30));

    await prisma.reading.create({
      data: {
        testId: test.id,
        sequence: r.sequence,
        phase: (phaseMap[r.phase] || 'LOADING') as any,
        recordedAt,
        pressureKgCm2: r.pressure,
        loadT: (r.pressure * 2551) / 1000,
        dg1: r.dg1,
        dg2: r.dg2,
        dg3: r.dg3,
        dg4: r.dg4,
        avgSettlementMm: r.calculatedAvg,
        remark: r.remark || null,
      },
    });
  }

  const dbReadings = await prisma.reading.findMany({ where: { testId: test.id }, orderBy: { sequence: 'asc' } });
  const readingInputs = dbReadings.map((r) => ({
    sequence: r.sequence,
    phase: r.phase as 'LOADING' | 'HOLD' | 'UNLOADING',
    loadT: r.loadT,
    avgSettlementMm: r.avgSettlementMm,
  }));

  const engine = new IvpltEngine();
  const meta = { pileDiameterMm: 900, pileDepthM: 11.51, designLoadT: 420, testLoadT: 1050, ramAreaCm2: 2551 };
  const result = engine.calculate(readingInputs, meta);

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
    projectName: 'BDD Chawls Redevelopment Project, Worli, Mumbai',
    client: 'Tata Project',
    contractor: 'NA',
    pmc: undefined,
    location: 'Building-3 Wing B',
    pileId: 'TP-01',
    reportNo: 'IVPLT-001',
    testDate: new Date('2025-12-09T00:00:00+05:30').toISOString(),
    pileDiameterMm: 900,
    pileDepthM: 11.51,
    concreteGrade: 'M40',
    designLoadT: 420,
    testLoadT: 1050,
    jackName: undefined,
    ramAreaCm2: 2551,
    gaugeLeastCountMm: 0.01,
    result,
    readings: extendedReadings,
    siteImages: [],
    fieldReadings: [],
    calibrationCertificates: [],
  };

  const html = generateIvpltReportHtml(reportData);
  const pdfBuffer = await generatePDFWithPageNumbers(html);

  const outDir = '/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports';
  await fs.mkdir(outDir, { recursive: true });
  const outPdf = path.join(outDir, 'tp-01-bdd-ivplt-agent-generated-report-v1.pdf');
  await fs.writeFile(outPdf, pdfBuffer);

  // also copy 3-file contract names
  await fs.copyFile('/Users/priyankalalge/.openclaw/media/inbound/TP-01_BDD-No-3_IVPLT-input---d66bca06-4b4f-460c-9344-cc0792f74eff.pdf', path.join(outDir, 'tp-01-bdd-ivplt-field-sheet-input.pdf'));
  await fs.copyFile('/Users/priyankalalge/.openclaw/media/inbound/TP-01_IVPLT_2025-12-09_Report-expected---f1c0f13e-c058-40d3-8f7f-44681cd45c1e.pdf', path.join(outDir, 'tp-01-bdd-ivplt-reference-report.pdf'));

  console.log(JSON.stringify({ outPdf, result }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
