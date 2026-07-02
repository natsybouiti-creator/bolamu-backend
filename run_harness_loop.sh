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

  # Les fichiers réels sont nommés sXX-nom-du-scenario.spec.js (minuscule,
  # suffixe descriptif) et non SXX.spec.js -- on résout par motif plutôt
  # que par nom exact, pour ne pas dépendre d'une convention non respectée.
  SC_LOWER=$(echo "$SC" | tr '[:upper:]' '[:lower:]')
  SPEC_FILE=$(ls tests/e2e/${SC_LOWER}-*.spec.js 2>/dev/null | head -n1)

  if [[ -z "$SPEC_FILE" ]]; then
    echo "❌ $SC : aucun fichier tests/e2e/${SC_LOWER}-*.spec.js trouvé -> FAIL (fichier manquant)"
    FAIL_LIST+=("$SC (spec introuvable)")
    continue
  fi
  echo "Fichier résolu : $SPEC_FILE"

  # Les scénarios soins (s04/s05/s06/s07/s20) utilisent le project "soins" avec reset audit
  SOINS_SCENARIOS=(S04 S05 S06 S07 S20)
  IS_SOINS=false
  for so in "${SOINS_SCENARIOS[@]}"; do
    if [[ "$SC" == "$so" ]]; then
      IS_SOINS=true
      break
    fi
  done

  if [[ "$IS_SOINS" == true ]]; then
    PLAYWRIGHT_ARGS="--config=playwright.config.js --project=soins --grep=${SC_LOWER}"
  else
    PLAYWRIGHT_ARGS="$SPEC_FILE --config=playwright.config.js"
  fi

  if DOTENV_CONFIG_QUIET=true npx playwright test $PLAYWRIGHT_ARGS --reporter=json > "$ARTIFACTS_DIR/${SC}_run.json" 2>"$ARTIFACTS_DIR/${SC}_stderr.log"; then
    echo "Playwright terminé sans erreur process pour $SC (le verdict fonctionnel reste à vérifier)."
  else
    echo "Playwright a retourné un code d'échec pour $SC — poursuite vers vérification (le run JSON contient le détail)."
  fi

  # Nettoyer le JSON Playwright : supprimer les lignes dotenv qui polluent le fichier
  # (DOTENV_CONFIG_QUIET=true ne suffit pas sur certains systèmes)
  node -e "
    const fs = require('fs');
    const content = fs.readFileSync('$ARTIFACTS_DIR/${SC}_run.json', 'utf-8');
    const lines = content.split('\n');
    const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
    if (jsonStart >= 0) {
      const cleanJson = lines.slice(jsonStart).join('\n');
      fs.writeFileSync('$ARTIFACTS_DIR/${SC}_run.json', cleanJson, 'utf-8');
    }
  " 2>/dev/null

  # Vérification explicite que le fichier produit est bien du JSON valide --
  # sans ça, une pollution stdout (dotenv, warnings) casse silencieusement
  # verify_scenario.js sur un JSON.parse() qui échoue plus loin, sans dire
  # clairement d'où vient le problème.
  if ! node -e "JSON.parse(require('fs').readFileSync('$ARTIFACTS_DIR/${SC}_run.json', 'utf-8'))" 2>/dev/null; then
    echo "❌ $SC : le fichier ${SC}_run.json n'est PAS du JSON valide (probable pollution stdout) -> FAIL"
    FAIL_LIST+=("$SC (JSON Playwright invalide)")
    continue
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
