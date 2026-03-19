import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { pdf as pdfToImg } from 'pdf-to-img';
import { runAgentSwarm } from '../src/lib/ai/agent-swarm';
import { getTestEngine } from '../src/engines/factory';
import type { TestType } from '../src/engines/types';
import { generatePDFWithPageNumbers } from '../src/lib/pdf/generator';
import { generateIvpltReportHtml } from '../src/lib/pdf/templates/ivplt-template';
import { generateRvpltReportHtml } from '../src/lib/pdf/templates/rvplt-template';
import { generateLateralReportHtml } from '../src/lib/pdf/templates/lateral-template';
import { generateUpliftReportHtml } from '../src/lib/pdf/templates/uplift-template';

type Args = Record<string, string | boolean | string[]>;
const prisma = new PrismaClient();

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function req(args: Args, key: string): string {
  const v = args[key];
  if (!v || typeof v !== 'string') throw new Error(`Missing required --${key}`);
  return v;
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseDdMmYyyy(s: string): Date {
  const parts = s.replace(/-/g, '/').split('/').map((x) => x.trim());
  if (parts.length !== 3) throw new Error(`Invalid date format for official date: ${s}`);
  let [dd, mm, yy] = parts;
  if (yy.length === 2) yy = `20${yy}`;
  return new Date(`${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00+05:30`);
}

function renderHtmlByType(type: TestType, data: any): string {
  switch (type) {
    case 'IVPLT':
      return generateIvpltReportHtml(data);
    case 'RVPLT':
      return generateRvpltReportHtml(data);
    case 'LATERAL':
      return generateLateralReportHtml(data);
    case 'UPLIFT':
      return generateUpliftReportHtml(data);
    default:
      throw new Error(`Unsupported test type: ${type}`);
  }
}

async function runVerifier(input: string, generated: string, expected: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const p = spawn(
      'npx',
      ['tsx', 'scripts/verifier-agent.ts', input, generated, expected],
      {
        cwd: '/Users/priyankalalge/PileTesting/Pile-testing-web-app/Pile-Testing-Web-App',
        env: {
          ...process.env,
          VERIFIER_MODEL: process.env.VERIFIER_MODEL || 'gemini-2.5-pro',
          GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
        },
      }
    );
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function main() {
  const args = parseArgs(process.argv);

  const input = req(args, 'input');
  const reportNo = req(args, 'report-no');
  const officialDate = req(args, 'official-date');
  const depth = Number(req(args, 'depth'));
  const grade = req(args, 'grade');
  const contractor = req(args, 'contractor');

  const testType = (args['type'] as TestType) || 'IVPLT';
  const slug = slugify((args['slug'] as string) || reportNo);
  const expected = typeof args['expected'] === 'string' ? args['expected'] : undefined;
  const verifyFlag = !!args['verify'];
  const noVerify = !!args['no-verify'];
  const theme = typeof args['theme'] === 'string' ? args['theme'] : undefined;
  const rerunSection = typeof args['rerun-section'] === 'string' ? args['rerun-section'] : undefined;
  const appendPage = typeof args['append-page'] === 'string' ? args['append-page'] : undefined;

  const batchDir = `/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports/batches/${slug}`;
  await fs.mkdir(batchDir, { recursive: true });

  // compute next version
  const files = await fs.readdir(batchDir).catch(() => [] as string[]);
  const versions = files
    .map((f) => {
      const m = f.match(new RegExp(`^${slug}-agent-generated-report-v(\\d+)\\.pdf$`));
      return m ? Number(m[1]) : null;
    })
    .filter((n): n is number => n !== null);
  const version = (versions.length ? Math.max(...versions) : 0) + 1;

  // 1) ingest/extract
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY/GOOGLE_API_KEY');

  const inputBuffer = await fs.readFile(input);
  const doc = await pdfToImg(inputBuffer, { scale: 2.0 });
  const images: string[] = [];
  for await (const page of doc) images.push(Buffer.from(page).toString('base64'));

  const extraction = await runAgentSwarm(images, apiKey);
  const extractedJsonPath = path.join(batchDir, `${slug}-extracted.json`);
  await fs.writeFile(extractedJsonPath, JSON.stringify(extraction, null, 2));

  // 2) normalize + metadata gate
  const normalized = {
    ...extraction,
    projectInfo: {
      ...extraction.projectInfo,
      value: {
        ...extraction.projectInfo.value,
        reportNo,
        testType,
        pileDepth: depth,
        concreteGrade: grade,
        contractor,
      },
    },
  };
  const normalizedJsonPath = path.join(batchDir, `${slug}-normalized.json`);
  await fs.writeFile(normalizedJsonPath, JSON.stringify(normalized, null, 2));

  // 3) persist and calculate
  const pi: any = normalized.projectInfo.value;
  const projectName = pi.project || slug;
  const location = pi.location || 'NA';
  const client = pi.client || 'NA';
  const pileId = pi.pileId || reportNo;
  const pileDiameterMm = Number(pi.pileDiameter || 0);
  const designLoadT = Number(pi.designLoad || 0);
  const testLoadT = Number(pi.testLoad || 0);
  const ramAreaCm2 = Number(pi.ramArea || 0);
  const gaugeLeastCountMm = Number(pi.lcDialGauge || 0.01);

  let project = await prisma.project.findFirst({ where: { name: projectName } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: projectName,
        client,
        contractor,
        pmc: pi.consultant || 'NA',
        location,
      },
    });
  }

  const existing = await prisma.test.findFirst({ where: { projectId: project.id, pileId, reportNo } });
  let test = existing;
  if (test) {
    await prisma.reading.deleteMany({ where: { testId: test.id } });
    test = await prisma.test.update({
      where: { id: test.id },
      data: {
        testType,
        testDate: parseDdMmYyyy(officialDate),
        pileDiameterMm,
        pileDepthM: depth,
        concreteGrade: grade,
        designLoadT,
        testLoadT,
        ramAreaCm2,
        gaugeLeastCountMm,
        status: 'IN_PROGRESS',
      },
    });
  } else {
    test = await prisma.test.create({
      data: {
        projectId: project.id,
        testType,
        reportNo,
        pileId,
        testDate: parseDdMmYyyy(officialDate),
        pileDiameterMm,
        pileDepthM: depth,
        concreteGrade: grade,
        designLoadT,
        testLoadT,
        ramAreaCm2,
        gaugeLeastCountMm,
        status: 'IN_PROGRESS',
      },
    });
  }

  const phaseMap: Record<string, 'LOADING' | 'HOLD' | 'UNLOADING'> = {
    loading: 'LOADING',
    holding: 'HOLD',
    unloading: 'UNLOADING',
  };

  for (const r of normalized.readings as any[]) {
    const [y, m, d] = (r.date || '2026-01-01').split('-').map(Number);
    const [hh, mm] = (r.time || '00:00').split(':').map(Number);
    const recordedAt = new Date(Date.UTC(y, m - 1, d, hh - 5, mm - 30));
    await prisma.reading.create({
      data: {
        testId: test.id,
        sequence: r.sequence,
        phase: (phaseMap[r.phase] || 'LOADING') as any,
        recordedAt,
        pressureKgCm2: Number(r.pressure || 0),
        loadT: (Number(r.pressure || 0) * ramAreaCm2) / 1000,
        dg1: Number(r.dg1 || 0),
        dg2: Number(r.dg2 || 0),
        dg3: Number(r.dg3 || 0),
        dg4: Number(r.dg4 || 0),
        avgSettlementMm: Number(r.calculatedAvg || 0),
        remark: r.remark || null,
      },
    });
  }

  const dbReadings = await prisma.reading.findMany({ where: { testId: test.id }, orderBy: { sequence: 'asc' } });
  const engine = getTestEngine(testType);
  const calc = engine.calculate(
    dbReadings.map((r) => ({ sequence: r.sequence, phase: r.phase as any, loadT: r.loadT, avgSettlementMm: r.avgSettlementMm })),
    { pileDiameterMm, pileDepthM: depth, designLoadT, testLoadT, ramAreaCm2 }
  );

  await prisma.test.update({
    where: { id: test.id },
    data: {
      maxSettlementMm: calc.maxSettlementMm,
      elasticReboundMm: calc.elasticReboundMm,
      netSettlementMm: calc.netSettlementMm,
      safeLoadAdoptedT: calc.safeLoadAdoptedT,
      isPassed: calc.isPassed,
      status: 'COMPLETED',
    },
  });

  // 4) render pdf
  const reportData: any = {
    projectName,
    client,
    contractor,
    pmc: pi.consultant || 'NA',
    location,
    pileId,
    reportNo,
    testDate: parseDdMmYyyy(officialDate).toISOString(),
    pileDiameterMm,
    pileDepthM: depth,
    concreteGrade: grade,
    designLoadT,
    testLoadT,
    ramAreaCm2,
    gaugeLeastCountMm,
    jackName: undefined,
    result: calc,
    readings: dbReadings.map((r) => ({
      sequence: r.sequence,
      phase: r.phase,
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
    _theme: theme,
    _rerunSection: rerunSection,
    _appendPage: appendPage,
  };

  const html = renderHtmlByType(testType, reportData);
  const pdfBuffer = await generatePDFWithPageNumbers(html);

  const generatedName = `${slug}-agent-generated-report-v${version}.pdf`;
  const generatedPath = path.join(batchDir, generatedName);
  await fs.writeFile(generatedPath, pdfBuffer);

  // copy aliases
  const inputAlias = path.join(batchDir, `${slug}-field-sheet-input.pdf`);
  await fs.copyFile(input, inputAlias);
  if (expected) {
    await fs.copyFile(expected, path.join(batchDir, `${slug}-reference-report.pdf`));
  }

  // 5) verify gate (always in prod)
  let verifier: any = null;
  const mode = (args['mode'] as string) || 'prod';
  const shouldVerify = !noVerify && (mode === 'prod' || verifyFlag || !!expected);

  if (shouldVerify && !expected) {
    throw new Error('Verification is required but --expected was not provided. Pass --expected <reference.pdf> or use --mode dev --no-verify for development only.');
  }

  if (shouldVerify && expected) {
    const vr = await runVerifier(inputAlias, generatedPath, expected);
    let parsed: any = null;
    try {
      parsed = JSON.parse(vr.stdout);
    } catch {
      parsed = { code: vr.code, stdout: vr.stdout.slice(-3000), stderr: vr.stderr.slice(-3000) };
    }
    verifier = parsed;

    if (parsed?.outputPath) {
      const bn = path.basename(parsed.outputPath);
      const target = path.join(batchDir, `${slug}-${bn}`);
      try {
        await fs.copyFile(parsed.outputPath, target);
      } catch {}
    }

    const score = parsed?.result?.overall_score_percent;
    const pass90 = parsed?.result?.pass_threshold_90;
    if (mode === 'prod' && pass90 === false) {
      throw new Error(`Publish blocked: verifier score=${score}, pass90=false`);
    }
  }

  const runMeta = {
    slug,
    version,
    mode: (args['mode'] as string) || 'prod',
    testType,
    input,
    expected: expected || null,
    generatedPath,
    reportNo,
    officialDate,
    metadata: { depth, grade, contractor },
    calc,
    verifier,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(batchDir, 'run-metadata.json'), JSON.stringify(runMeta, null, 2));

  console.log(JSON.stringify({ ok: true, slug, version, generatedPath, calc, verified: !!verifier }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
