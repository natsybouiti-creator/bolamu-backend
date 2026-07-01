#!/usr/bin/env bash
# BOLAMU — Orchestrateur du harnais de test
# Usage : ./run_harness_loop.sh S26
#         ./run_harness_loop.sh S01 S02 S03
#         ./run_harness_loop.sh --all-b1   (rejoue tous les scénarios B1 déjà validés)

set -euo pipefail

ARTIFACTS_DIR="artifacts"
CONTRACTS_DIR="contracts"
mkdir -p "$ARTIFACTS_DIR"

B1_SCENARIOS=(S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S15 S16 S17 S18 S19 S20 S21 S22 S23 S24 S25 S26 S27)

if [[ "${1:-}" == "--all-b1" ]]; then
  SCENARIOS=("${B1_SCENARIOS[@]}")
else
  SCENARIOS=("$@")
fi

if [[ ${#SCENARIOS[@]} -eq 0 ]]; then
  echo "Aucun scénario fourni. Usage: ./run_harness_loop.sh S26 [S27 ...] | --all-b1"
  exit 2
fi

PASS_LIST=()
FAIL_LIST=()
AMBIGUOUS_LIST=()

for SC in "${SCENARIOS[@]}"; do
  echo "=== $SC : lancement Playwright (reporter JSON, pas de résumé) ==="

  if [[ ! -f "$CONTRACTS_DIR/${SC}_contract.json" ]]; then
    echo "⏳ $SC : pas de contrat écrit -> SAUTÉ (non contractualisé)"
    AMBIGUOUS_LIST+=("$SC (pas de contrat)")
    continue
  fi

  if npx playwright test "${SC}.spec.js" --reporter=json > "$ARTIFACTS_DIR/${SC}_run.json" 2>"$ARTIFACTS_DIR/${SC}_stderr.log"; then
    echo "Playwright terminé sans erreur process pour $SC (le verdict fonctionnel reste à vérifier)."
  else
    echo "Playwright a retourné un code d'échec pour $SC — poursuite vers vérification (le run JSON contient le détail)."
  fi

  echo "=== $SC : vérification déterministe (DB + contrat) ==="
  if node verify_scenario.js "$SC"; then
    echo "✅ $SC PASS"
    PASS_LIST+=("$SC")
  else
    STATUS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ARTIFACTS_DIR/${SC}_verdict.json')).status)" 2>/dev/null || echo "UNKNOWN")
    if [[ "$STATUS" == "AMBIGUOUS" ]]; then
      echo "🔶 $SC AMBIGUOUS — remonté pour arbitrage humain"
      AMBIGUOUS_LIST+=("$SC")
    else
      echo "❌ $SC FAIL — voir $ARTIFACTS_DIR/${SC}_verdict.json (verdict brut, pas un résumé)"
      FAIL_LIST+=("$SC")
    fi
  fi
  echo ""
done

echo "=================== BILAN DE BOUCLE ==================="
echo "PASS       : ${PASS_LIST[*]:-aucun}"
echo "FAIL       : ${FAIL_LIST[*]:-aucun}"
echo "AMBIGUOUS  : ${AMBIGUOUS_LIST[*]:-aucun}"
echo "========================================================"
echo ""
echo "Règle : seuls les scénarios PASS peuvent être committés."
echo "Pour les FAIL/AMBIGUOUS, coller le contenu de artifacts/<SC>_verdict.json"
echo "brut à Claude — jamais un résumé rédigé par Cascade."
