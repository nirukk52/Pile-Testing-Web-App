import { PrismaClient } from '@prisma/client';
import { IvpltEngine } from '../src/engines/ivplt-engine';
import { generatePDFWithPageNumbers } from '../src/lib/pdf/generator';
import { generateIvpltReportHtml } from '../src/lib/pdf/templates/ivplt-template';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const ingest = JSON.parse(await fs.readFile('/tmp/fwing03-ingest.json', 'utf-8'));
  const rows = ingest.readings as any[];

  let project = await prisma.project.findFirst({ where: { name: 'Redevelopment Project Worli BDD' } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Redevelopment Project Worli BDD',
        client: 'TATA Project',
        contractor: 'NA',
        pmc: 'NA',
        location: 'BDD Chawl, F-Wing, Building No. 8',
      },
    });
  }

  let test = await prisma.test.findFirst({ where: { projectId: project.id, pileId: 'F-Wing-03', reportNo: '301' } });
  if (test) {
    await prisma.reading.deleteMany({ where: { testId: test.id } });
    test = await prisma.test.update({
      where: { id: test.id },
      data: {
        reportNo: '301',
        testType: 'IVPLT',
        testDate: new Date('2026-03-02T00:00:00+05:30'),
        pileId: 'F-Wing-03',
        pileDiameterMm: 1000,
        pileDepthM: 22.01,
        concreteGrade: 'M80',
        designLoadT: 1160,
        testLoadT: 2900,
        ramAreaCm2: 5102,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  } else {
    test = await prisma.test.create({
      data: {
        projectId: project.id,
        reportNo: '301',
        testType: 'IVPLT',
        testDate: new Date('2026-03-02T00:00:00+05:30'),
        pileId: 'F-Wing-03',
        pileDiameterMm: 1000,
        pileDepthM: 22.01,
        concreteGrade: 'M80',
        designLoadT: 1160,
        testLoadT: 2900,
        ramAreaCm2: 5102,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  }

  const phaseMap: Record<string, 'LOADING'|'HOLD'|'UNLOADING'> = { loading:'LOADING', holding:'HOLD', unloading:'UNLOADING' };
  for (const r of rows) {
    const dateParts = (r.date || '2026-03-02').split('-').map(Number);
    const [y, m, d] = dateParts[0] > 31 ? dateParts : [dateParts[2], dateParts[1], dateParts[0]];
    const [hh,mm] = (r.time || '00:00').split(':').map(Number);
    const recordedAt = new Date(Date.UTC(y, m-1, d, hh-5, mm-30));

    await prisma.reading.create({
      data: {
        testId: test.id,
        sequence: r.sequence,
        phase: (phaseMap[r.phase] || 'LOADING') as any,
        recordedAt,
        pressureKgCm2: r.pressure,
        loadT: (r.pressure * 5102)/1000,
        dg1: r.dg1,
        dg2: r.dg2,
        dg3: r.dg3,
        dg4: r.dg4,
        avgSettlementMm: r.calculatedAvg,
        remark: r.remark || null,
      }
    })
  }

  const dbReadings = await prisma.reading.findMany({ where: { testId: test.id }, orderBy: { sequence: 'asc' } });
  const readingInputs = dbReadings.map(r => ({ sequence:r.sequence, phase:r.phase as any, loadT:r.loadT, avgSettlementMm:r.avgSettlementMm }));
  const engine = new IvpltEngine();
  const result = engine.calculate(readingInputs, { pileDiameterMm:1000, pileDepthM:22.01, designLoadT:1160, testLoadT:2900, ramAreaCm2:5102 });

  await prisma.test.update({ where: { id: test.id }, data: {
    maxSettlementMm: result.maxSettlementMm,
    elasticReboundMm: result.elasticReboundMm,
    netSettlementMm: result.netSettlementMm,
    safeLoadAdoptedT: result.safeLoadAdoptedT,
    isPassed: result.isPassed,
    status: 'COMPLETED',
  }});

  const reportData = {
    projectName: 'Redevelopment Project Worli BDD',
    client: 'TATA Project',
    contractor: 'NA',
    pmc: undefined,
    location: 'BDD Chawl, F-Wing, Building No. 8',
    pileId: 'F-Wing-03',
    reportNo: '301',
    testDate: new Date('2026-03-02T00:00:00+05:30').toISOString(),
    pileDiameterMm: 1000,
    pileDepthM: 22.01,
    concreteGrade: 'M80',
    designLoadT: 1160,
    testLoadT: 2900,
    ramAreaCm2: 5102,
    gaugeLeastCountMm: 0.01,
    jackName: undefined,
    result,
    readings: dbReadings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase as any,
      loadT: r.loadT,
      avgSettlementMm: r.avgSettlementMm,
      dialGauge1: String(r.dg1),
      dialGauge2: String(r.dg2),
      dialGauge3: String(r.dg3),
      dialGauge4: String(r.dg4),
      timestamp: r.recordedAt?.toISOString(),
      pressureGauge: String(r.pressureKgCm2),
      remark: r.remark || undefined,
    })),
    siteImages: [],
    fieldReadings: [],
    calibrationCertificates: [],
  };

  const html = generateIvpltReportHtml(reportData as any);
  const pdfBuffer = await generatePDFWithPageNumbers(html);
  const outDir = '/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports';
  await fs.mkdir(outDir, { recursive: true });
  const outPdf = path.join(outDir, 'f-wing-03-ivplt-agent-generated-report-v1.pdf');
  await fs.writeFile(outPdf, pdfBuffer);

  console.log(JSON.stringify({ outPdf, result }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
