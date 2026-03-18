import { PrismaClient } from '@prisma/client';
import { RvpltEngine } from '../src/engines/rvplt-engine';
import { generatePDFWithPageNumbers } from '../src/lib/pdf/generator';
import { generateRvpltReportHtml } from '../src/lib/pdf/templates/rvplt-template';
import { resolveReportPath } from '../src/lib/report-paths';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const ingest = JSON.parse(await fs.readFile('/tmp/p395-ingest.json', 'utf-8'));
  const rows = ingest.readings as any[];

  let project = await prisma.project.findFirst({ where: { name: 'CP10-C5 - EV03' } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'CP10-C5 - EV03',
        client: 'CMRL',
        contractor: 'L&T',
        pmc: 'NA',
        location: 'Koyambedu',
      },
    });
  }

  let test = await prisma.test.findFirst({ where: { projectId: project.id, pileId: 'P395 8/01', reportNo: 'P395/8-01' } });
  if (test) {
    await prisma.reading.deleteMany({ where: { testId: test.id } });
    test = await prisma.test.update({
      where: { id: test.id },
      data: {
        reportNo: 'P395/8-01',
        testType: 'RVPLT',
        testDate: new Date('2024-09-23T00:00:00+05:30'),
        pileId: 'P395 8/01',
        pileDiameterMm: 1200,
        pileDepthM: 38.893,
        concreteGrade: 'M35',
        designLoadT: 550,
        testLoadT: 825,
        ramAreaCm2: 2551,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  } else {
    test = await prisma.test.create({
      data: {
        projectId: project.id,
        reportNo: 'P395/8-01',
        testType: 'RVPLT',
        testDate: new Date('2024-09-23T00:00:00+05:30'),
        pileId: 'P395 8/01',
        pileDiameterMm: 1200,
        pileDepthM: 38.893,
        concreteGrade: 'M35',
        designLoadT: 550,
        testLoadT: 825,
        ramAreaCm2: 2551,
        gaugeLeastCountMm: 0.01,
        status: 'IN_PROGRESS',
      },
    });
  }

  const phaseMap: Record<string, 'LOADING'|'HOLD'|'UNLOADING'> = { loading:'LOADING', holding:'HOLD', unloading:'UNLOADING' };
  for (const r of rows) {
    const [y,m,d] = (r.date || '2024-09-23').split('-').map(Number);
    const [hh,mm] = (r.time || '00:00').split(':').map(Number);
    const recordedAt = new Date(Date.UTC(y, m-1, d, hh-5, mm-30));

    await prisma.reading.create({
      data: {
        testId: test.id,
        sequence: r.sequence,
        phase: (phaseMap[r.phase] || 'LOADING') as any,
        recordedAt,
        pressureKgCm2: r.pressure,
        loadT: (r.pressure * 2551)/1000,
        dg1: r.dg1,
        dg2: r.dg2,
        dg3: r.dg3,
        dg4: r.dg4,
        avgSettlementMm: r.calculatedAvg,
        remark: r.remark || null,
      }
    });
  }

  const dbReadings = await prisma.reading.findMany({ where: { testId: test.id }, orderBy: { sequence: 'asc' } });
  const readingInputs = dbReadings.map(r => ({ sequence:r.sequence, phase:r.phase as any, loadT:r.loadT, avgSettlementMm:r.avgSettlementMm }));
  const engine = new RvpltEngine();
  const result = engine.calculate(readingInputs, { pileDiameterMm:1200, pileDepthM:38.893, designLoadT:550, testLoadT:825, ramAreaCm2:2551 });

  await prisma.test.update({ where: { id: test.id }, data: {
    maxSettlementMm: result.maxSettlementMm,
    elasticReboundMm: result.elasticReboundMm,
    netSettlementMm: result.netSettlementMm,
    safeLoadAdoptedT: result.safeLoadAdoptedT,
    isPassed: result.isPassed,
    status: 'COMPLETED',
  }});

  const reportData = {
    projectName: 'CP10-C5 - EV03',
    client: 'CMRL',
    contractor: 'L&T',
    pmc: 'NA',
    location: 'Koyambedu',
    pileId: 'P395 8/01',
    reportNo: 'P395/8-01',
    testDate: new Date('2024-09-23T00:00:00+05:30').toISOString(),
    pileDiameterMm: 1200,
    pileDepthM: 38.893,
    concreteGrade: 'M35',
    designLoadT: 550,
    testLoadT: 825,
    ramAreaCm2: 2551,
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

  const html = generateRvpltReportHtml(reportData as any);
  const pdfBuffer = await generatePDFWithPageNumbers(html);

  const slug = 'p395-koyambedu-rvplt';
  const resolved = await resolveReportPath(slug);
  await fs.writeFile(resolved.fullPath, pdfBuffer);

  console.log(JSON.stringify({ outPdf: resolved.fullPath, version: resolved.version, result }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
