#!/usr/bin/env bash
set -euo pipefail

BASE="/Users/priyankalalge/.openclaw/workspace-piletest/generated-reports"
INPUT="$BASE/tp-01-ivplt-field-sheet-input.pdf"
GENERATED="$BASE/tp-01-ivplt-agent-generated-report-v4.pdf"
REFERENCE="$BASE/tp-01-ivplt-reference-report.pdf"

cd /Users/priyankalalge/PileTesting/Pile-testing-web-app/Pile-Testing-Web-App
npx tsx scripts/verifier-agent.ts "$INPUT" "$GENERATED" "$REFERENCE"
