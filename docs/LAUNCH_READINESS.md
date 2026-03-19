# Launch Readiness Checklist

This checklist tracks go-live readiness for piletest report automation.

Status legend:
- ✅ Done
- 🟡 In progress
- ❌ Not started

---

## P0 — Must Have (launch blockers)

| Item | Status | Owner | Files / Scripts | Verification |
|---|---|---|---|---|
| Repo/workspace boundaries defined | ✅ | Agent | `docs/BOUNDARIES.md` | Policy exists and is followed in workflow |
| Repo-first skill sync (Option A) | ✅ | Agent | `scripts/sync-skills.sh` | `scripts/sync-skills.sh` syncs skills to `~/.agents/skills` |
| Metadata gate before generation | ✅ | Agent | Workspace `AGENTS.md` + pipeline flow | Report blocked until reportNo/date/depth/grade are present |
| Date parsing day-first (DD/MM) | ✅ | Agent | `src/lib/ai/agent-swarm.ts`, `docs/pipeline-parity-spec.md` | No DD/MM → MM/DD drift on benchmark cases |
| Phase normalization (loading/hold/unloading) | ✅ | Agent | `src/lib/ai/agent-swarm.ts`, `src/lib/pdf/templates/ivplt-template.tsx` | Loading/unloading summaries not cross-contaminated |
| Final settlement rule fixed (last min-load row) | ✅ | Agent | `src/lib/calculations.ts`, `docs/pipeline-parity-spec.md` | Rebound/net align with stabilized final unload value |
| Verifier gate (3-file contract) | ✅ | Agent | `scripts/verifier-agent.ts`, `scripts/run-verifier-default.sh` | Verifier JSON produced per run; publish policy applied |
| Calibration benchmark registry | ✅ | Agent | `benchmarks/ivplt-batch.json` | Cases are versioned and runnable |
| End-to-end calibration runner | ✅ | Agent | `scripts/run-calibration-sprint.ts` | Produces run folder + summary with avg score |
| Unified production runner (all test types) | ✅ | Agent | `scripts/run-report.ts` | Single command executes extract->calculate->render->verify flow |
| Diff analytics (where/why mismatch) | ✅ | Agent | `scripts/generate-calibration-diff-report.ts` | Produces `diff-report.json/md` |

**P0 launch gate target:**
- Calibration avg score > 95
- Total critical failures = 0

---

## P1 — Next Sprint (stability + scale)

| Item | Status | Owner | Files / Scripts | Verification |
|---|---|---|---|---|
| CI/command release gate | ❌ | Dev | (to add) `scripts/check-release-gate.ts` / CI workflow | Release blocked when thresholds fail |
| Case onboarding helper (batch import) | ❌ | Dev | (to add) `scripts/add-benchmark-case.ts` | New pairs added consistently with metadata |
| Model/version observability in run outputs | 🟡 | Agent | verifier outputs + calibration summary | Run metadata includes model/prompt/skill version |
| Standardized cover-date display field | 🟡 | Dev | template + report data contract | No timezone/date drift in cover page |
| Skill evals expansion (more prompts/cases) | 🟡 | Agent | `.claude/skills/piletest-parity/evals/evals.json` | Better trigger confidence + wider coverage |

---

## P2 — Future (beautification + compound engineering)

| Item | Status | Owner | Files / Scripts | Verification |
|---|---|---|---|---|
| Separate content-truth from presentation-theme | ❌ | Dev | template architecture refactor | Styling changes never alter engineering values |
| Theme profiles (client-ready report skins) | ❌ | Dev | template/theme assets | Multiple visual themes, identical calculations |
| Multi-agent orchestration (extract/validate/render/verify) | ❌ | Dev | orchestration layer | Clear role boundaries + reduced coupling |
| Fix library + retrieval for recurring mismatch patterns | ❌ | Agent/Dev | knowledge store + retriever | Patch suggestions improve over time |

---

## Current Snapshot (latest run)
- Calibration run: `generated-reports/calibration/2026-03-16T18-37-30-157Z`
- Avg score: `96`
- Total critical failures: `0`
- Stop condition met: `true`

---

## Operating Rule
Always execute in this order:
1) Update docs/spec
2) Patch pipeline code
3) Run calibration sprint
4) Generate diff report
5) Only then promote changes for release
