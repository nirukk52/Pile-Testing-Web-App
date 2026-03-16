# Boundaries: Repo vs Workspace

This project follows a strict separation of concerns to avoid drift and preserve reproducibility.

## 1) Repo is Source of Truth (SoT)
Path:
- `/Users/priyankalalge/PileTesting/Pile-testing-web-app/Pile-Testing-Web-App`

All persistent/product behavior MUST live in repo:
- Application code (engines, parsers, templates, APIs)
- Prompt/spec docs that define runtime behavior
- Skills that influence production behavior (`.claude/skills/*`)
- Benchmark manifests and calibration harness scripts
- Verifier logic and report-generation pipelines

If it should be reproducible by another machine/team member, it belongs in repo.

## 2) Workspace is Runtime Scratch + Memory
Path:
- `~/.openclaw/workspace-piletest`

Workspace should contain only:
- Agent memory files (`MEMORY.md`, `memory/*`)
- Temporary run artifacts and local staging outputs
- Transient debug files and ad-hoc notes

Workspace is NOT the long-term source for production logic.

## 3) Policy File Mirroring Rule
If a policy/process document is changed in workspace, mirror equivalent guidance into repo docs in the same working session, or explicitly document why not.

## 4) Skills Canonicalization (Option A)
Canonical skills location:
- `repo/.claude/skills`

Runtime skills location:
- `~/.agents/skills`

Use sync workflow:
1. Edit in repo
2. Validate/eval in repo
3. Sync selected skills to runtime path

Sync command:
```bash
scripts/sync-skills.sh            # default set
scripts/sync-skills.sh --all      # all repo skills
scripts/sync-skills.sh <names...> # selected skills
```

Do not treat `external-skills/` as authoritative runtime policy.

## 5) Generated Reports Organization
Canonical layout:
- `~/.openclaw/workspace-piletest/generated-reports/batches/<slug>/`

Per-batch expected artifacts:
- `<slug>-field-sheet-input.pdf`
- `<slug>-reference-report.pdf`
- `<slug>-agent-generated-report-vN.pdf`
- `<slug>-verifier-output-<timestamp>.json`

Root `generated-reports/` may keep only convenience aliases/latest pointers.
Batch folders are canonical history.

## 6) Release Gate Ownership
Release readiness is determined from repo-tracked harness outputs:
- Calibration average score target
- Critical mismatch count
- Verifier threshold compliance

No go-live decision should depend solely on untracked workspace artifacts.
