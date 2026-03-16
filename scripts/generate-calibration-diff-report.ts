import fs from 'fs/promises';
import path from 'path';

interface VerifierResult {
  overall_score_percent?: number;
  pass_threshold_90?: boolean;
  section_scores?: Record<string, number>;
  critical_failures?: Array<{ field?: string; reason?: string; expected_value?: string; generated_value?: string }>;
  major_differences?: Array<{ section?: string; issue?: string; impact?: string }>;
  minor_differences?: Array<{ section?: string; issue?: string }>;
  final_verdict?: string;
}

function norm(s?: string) {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function main() {
  const runDir = process.argv[2];
  if (!runDir) {
    console.error('Usage: npx tsx scripts/generate-calibration-diff-report.ts <calibration-run-dir>');
    process.exit(1);
  }

  const summaryPath = path.join(runDir, 'summary.json');
  const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));

  const cases = summary.cases || [];
  const sectionIssues = new Map<string, { count: number; samples: string[] }>();
  const criticalByField = new Map<string, { count: number; samples: string[] }>();

  const caseReports: any[] = [];

  for (const c of cases) {
    const caseDir = path.join(runDir, c.slug);
    let verifierJsonPath: string | null = null;

    if (c.verifierOutputPath) {
      const bn = path.basename(c.verifierOutputPath);
      const localPath = path.join(caseDir, bn);
      try {
        await fs.access(localPath);
        verifierJsonPath = localPath;
      } catch {
        // fallback: search any verifier json in case dir
      }
    }

    if (!verifierJsonPath) {
      const files = await fs.readdir(caseDir);
      const found = files.find((f) => f.startsWith('tp-01-verifier-output-') && f.endsWith('.json'));
      if (found) verifierJsonPath = path.join(caseDir, found);
    }

    if (!verifierJsonPath) {
      caseReports.push({ slug: c.slug, score: c.score, pass90: c.pass90, note: 'Verifier JSON not found in case dir' });
      continue;
    }

    const wrapped = JSON.parse(await fs.readFile(verifierJsonPath, 'utf-8'));
    const r: VerifierResult = wrapped.result || wrapped;

    const critical = r.critical_failures || [];
    const major = r.major_differences || [];
    const minor = r.minor_differences || [];

    for (const cf of critical) {
      const key = norm(cf.field) || 'unknown-field';
      const cur = criticalByField.get(key) || { count: 0, samples: [] };
      cur.count += 1;
      const sample = `${cf.field || 'unknown'} :: ${cf.reason || ''}`.trim();
      if (sample && cur.samples.length < 3) cur.samples.push(sample);
      criticalByField.set(key, cur);
    }

    const allDiffs = [
      ...major.map((d) => ({ section: d.section || 'unknown', issue: d.issue || '' })),
      ...minor.map((d) => ({ section: d.section || 'unknown', issue: d.issue || '' })),
    ];

    for (const d of allDiffs) {
      const key = `${norm(d.section)}|${norm(d.issue).slice(0, 140)}`;
      const cur = sectionIssues.get(key) || { count: 0, samples: [] };
      cur.count += 1;
      const sample = `${d.section}: ${d.issue}`.trim();
      if (sample && cur.samples.length < 3) cur.samples.push(sample);
      sectionIssues.set(key, cur);
    }

    caseReports.push({
      slug: c.slug,
      score: r.overall_score_percent ?? c.score,
      pass90: r.pass_threshold_90 ?? c.pass90,
      verdict: r.final_verdict ?? c.verdict,
      criticalCount: critical.length,
      majorCount: major.length,
      minorCount: minor.length,
      sectionScores: r.section_scores || {},
    });
  }

  const recurringSectionIssues = [...sectionIssues.entries()]
    .map(([k, v]) => ({ key: k, count: v.count, samples: v.samples }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const recurringCriticalFields = [...criticalByField.entries()]
    .map(([field, v]) => ({ field, count: v.count, samples: v.samples }))
    .sort((a, b) => b.count - a.count);

  const out = {
    runId: summary.runId,
    avgScore: summary.avgScore,
    totalCriticalFailures: summary.totalCriticalFailures,
    stopConditionMet: summary.stopConditionMet,
    caseReports,
    recurringCriticalFields,
    recurringSectionIssues,
  };

  await fs.writeFile(path.join(runDir, 'diff-report.json'), JSON.stringify(out, null, 2));

  const md: string[] = [];
  md.push('# Calibration Diff Report');
  md.push('');
  md.push(`- Run ID: ${summary.runId}`);
  md.push(`- Avg Score: ${summary.avgScore}`);
  md.push(`- Total Critical Failures: ${summary.totalCriticalFailures}`);
  md.push(`- Stop Condition Met: ${summary.stopConditionMet ? '✅' : '❌'}`);
  md.push('');
  md.push('## Case Leaderboard');
  md.push('');
  md.push('| Case | Score | Pass90 | Critical | Major | Minor | Verdict |');
  md.push('|---|---:|:---:|---:|---:|---:|---|');
  for (const c of caseReports) {
    md.push(`| ${c.slug} | ${c.score ?? 'NA'} | ${c.pass90 ?? 'NA'} | ${c.criticalCount ?? 'NA'} | ${c.majorCount ?? 'NA'} | ${c.minorCount ?? 'NA'} | ${c.verdict ?? 'NA'} |`);
  }

  md.push('');
  md.push('## Recurring Critical Fields');
  if (recurringCriticalFields.length === 0) {
    md.push('- None ✅');
  } else {
    for (const r of recurringCriticalFields) {
      md.push(`- **${r.field}**: ${r.count}`);
      for (const s of r.samples) md.push(`  - ${s}`);
    }
  }

  md.push('');
  md.push('## Top Recurring Mismatch Patterns');
  if (recurringSectionIssues.length === 0) {
    md.push('- None ✅');
  } else {
    for (const r of recurringSectionIssues.slice(0, 10)) {
      md.push(`- **Count ${r.count}**`);
      for (const s of r.samples) md.push(`  - ${s}`);
    }
  }

  await fs.writeFile(path.join(runDir, 'diff-report.md'), md.join('\n'));
  console.log(JSON.stringify({ runDir, reportJson: path.join(runDir, 'diff-report.json'), reportMd: path.join(runDir, 'diff-report.md') }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
