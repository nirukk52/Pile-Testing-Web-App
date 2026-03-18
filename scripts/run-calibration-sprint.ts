import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { batchDir, inputFilename, referenceFilename } from '../src/lib/report-paths';

interface BenchmarkCase {
  id: string;
  slug: string;
  enabled: boolean;
  files: { input: string; expected: string };
  metadata: Record<string, any>;
}

interface BenchmarkFile {
  benchmark_name: string;
  version: string;
  defaults: { verifierThreshold: number; parityTarget: number };
  cases: BenchmarkCase[];
}

function runCmd(command: string, args: string[], cwd: string, env?: Record<string, string>) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const p = spawn(command, args, { cwd, env: { ...process.env, ...(env || {}) } });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const repoRoot = '/Users/priyankalalge/PileTesting/Pile-testing-web-app/Pile-Testing-Web-App';
  const benchmarkPath = path.join(repoRoot, 'benchmarks/ivplt-batch.json');
  const outRoot = '/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports/calibration';

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(outRoot, runId);
  await ensureDir(runDir);

  const benchmark = JSON.parse(await fs.readFile(benchmarkPath, 'utf-8')) as BenchmarkFile;
  const cases = benchmark.cases.filter((c) => c.enabled);

  const generatorBySlug: Record<string, string> = {
    'tp-01-prestige-nautilus': 'scripts/generate-tp01-v2.ts',
    'tp-01-bdd-no-3': 'scripts/generate-bdd-tp01.ts',
  };

  const reportSlugByBenchmark: Record<string, string> = {
    'tp-01-prestige-nautilus': 'tp-01-ivplt',
    'tp-01-bdd-no-3': 'tp-01-bdd-ivplt',
  };

  /** Find the latest versioned report PDF in a batch dir. */
  async function latestReport(reportSlug: string): Promise<string | null> {
    const dir = batchDir(reportSlug);
    try {
      const files = await fs.readdir(dir);
      const reports = files
        .filter((f) => f.includes('-agent-generated-report-v') && f.endsWith('.pdf'))
        .sort();
      if (reports.length === 0) return null;
      return path.join(dir, reports[reports.length - 1]);
    } catch {
      return null;
    }
  }

  const summary: any = {
    benchmark: benchmark.benchmark_name,
    version: benchmark.version,
    runId,
    startedAt: new Date().toISOString(),
    model: process.env.VERIFIER_MODEL || 'gemini-2.5-pro',
    threshold: benchmark.defaults.verifierThreshold,
    target: benchmark.defaults.parityTarget,
    cases: [],
  };

  for (const c of cases) {
    const caseDir = path.join(runDir, c.slug);
    await ensureDir(caseDir);

    const caseResult: any = {
      slug: c.slug,
      id: c.id,
      generation: { attempted: false, ok: false },
      verification: { attempted: false, ok: false },
    };

    // 1) generate
    const genScript = generatorBySlug[c.slug];
    if (genScript) {
      caseResult.generation.attempted = true;
      const gen = await runCmd('npx', ['tsx', genScript], repoRoot);
      caseResult.generation.ok = gen.code === 0;
      caseResult.generation.code = gen.code;
      caseResult.generation.stdoutTail = gen.stdout.slice(-2000);
      caseResult.generation.stderrTail = gen.stderr.slice(-2000);
      await fs.writeFile(path.join(caseDir, 'generation.log.txt'), `${gen.stdout}\n${gen.stderr}`);
    }

    // 2) verify
    const rSlug = reportSlugByBenchmark[c.slug] || c.slug;
    const generatedPath = await latestReport(rSlug);
    const inputPath = c.files.input;
    const expectedPath = c.files.expected;

    if (!generatedPath || !(await exists(generatedPath))) {
      caseResult.verification.error = `Generated file missing for slug ${rSlug}`;
      summary.cases.push(caseResult);
      continue;
    }

    caseResult.verification.attempted = true;
    const verify = await runCmd(
      'npx',
      ['tsx', 'scripts/verifier-agent.ts', inputPath, generatedPath, expectedPath, rSlug],
      repoRoot,
      {
        VERIFIER_MODEL: process.env.VERIFIER_MODEL || 'gemini-2.5-pro',
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
      }
    );

    caseResult.verification.ok = verify.code === 0;
    caseResult.verification.code = verify.code;
    await fs.writeFile(path.join(caseDir, 'verification.log.txt'), `${verify.stdout}\n${verify.stderr}`);

    // parse verifier output JSON from stdout
    let parsed: any = null;
    try {
      parsed = JSON.parse(verify.stdout);
    } catch {
      const start = verify.stdout.lastIndexOf('{');
      if (start >= 0) {
        try {
          parsed = JSON.parse(verify.stdout.slice(start));
        } catch {}
      }
    }

    if (parsed?.result) {
      caseResult.score = parsed.result.overall_score_percent;
      caseResult.pass90 = parsed.result.pass_threshold_90;
      caseResult.verdict = parsed.result.final_verdict;
      caseResult.criticalFailures = (parsed.result.critical_failures || []).length;
      caseResult.verifierOutputPath = parsed.outputPath;

      const targetInput = path.join(caseDir, inputFilename(c.slug));
      const targetGen = path.join(caseDir, path.basename(generatedPath));
      const targetRef = path.join(caseDir, referenceFilename(c.slug));
      await fs.copyFile(inputPath, targetInput);
      await fs.copyFile(generatedPath, targetGen);
      await fs.copyFile(expectedPath, targetRef);
      if (parsed.outputPath && (await exists(parsed.outputPath))) {
        await fs.copyFile(parsed.outputPath, path.join(caseDir, path.basename(parsed.outputPath)));
      }
    } else {
      caseResult.verification.parseError = true;
      caseResult.verification.stdoutTail = verify.stdout.slice(-2000);
      caseResult.verification.stderrTail = verify.stderr.slice(-2000);
    }

    summary.cases.push(caseResult);
  }

  // aggregate
  const scored = summary.cases.filter((c: any) => typeof c.score === 'number');
  const avg = scored.length ? scored.reduce((a: number, c: any) => a + c.score, 0) / scored.length : null;
  const critical = scored.reduce((a: number, c: any) => a + (c.criticalFailures || 0), 0);

  summary.completedAt = new Date().toISOString();
  summary.avgScore = avg;
  summary.totalCriticalFailures = critical;
  summary.stopConditionMet = avg !== null && avg > 95 && critical === 0;

  const outJson = path.join(runDir, 'summary.json');
  await fs.writeFile(outJson, JSON.stringify(summary, null, 2));

  // markdown leaderboard
  const lines = [
    `# Calibration Sprint Summary`,
    ``,
    `- Run ID: ${runId}`,
    `- Benchmark: ${summary.benchmark}`,
    `- Avg Score: ${avg === null ? 'N/A' : avg.toFixed(2)}`,
    `- Total Critical Failures: ${critical}`,
    `- Stop Condition (avg >95 && critical=0): ${summary.stopConditionMet ? '✅ MET' : '❌ NOT MET'}`,
    ``,
    `| Case | Score | Pass90 | Critical | Verdict |`,
    `|---|---:|:---:|---:|---|`,
    ...summary.cases.map((c: any) => `| ${c.slug} | ${c.score ?? 'NA'} | ${c.pass90 ?? 'NA'} | ${c.criticalFailures ?? 'NA'} | ${c.verdict ?? 'NA'} |`),
  ];

  await fs.writeFile(path.join(runDir, 'summary.md'), lines.join('\n'));

  console.log(JSON.stringify({ runId, runDir, avgScore: avg, totalCriticalFailures: critical, stopConditionMet: summary.stopConditionMet }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
