#!/usr/bin/env node
/**
 * BOLAMU — Vérificateur déterministe (harnais de test)
 *
 * Rôle : lire les artefacts BRUTS (JSON Playwright + résultats SQL réels),
 * les comparer au contrat du scénario, et produire un verdict structuré.
 *
 * Ce script ne doit JAMAIS être remplacé par un agent LLM qui "résume" le
 * résultat. C'est tout le principe du harnais : le vérificateur est
 * mécanique, pas conversationnel.
 *
 * Usage :
 *   node verify_scenario.js S26
 *
 * Attend :
 *   contracts/S26_contract.json
 *   artifacts/S26_run.json   (sortie de: npx playwright test S26.spec.js --reporter=json)
 *
 * Variables d'env requises (rôle DB lecture seule uniquement) :
 *   BOLAMU_TEST_RO_DATABASE_URL
 *
 * Produit :
 *   artifacts/S26_verdict.json
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config(); // charge .env explicitement -- ce script tourne seul, rien ne garantit que process.env est déjà rempli par un appelant
const { Client } = require("pg"); // npm install pg --save-dev

const SCENARIO_ID = process.argv[2];
if (!SCENARIO_ID) {
  console.error("Usage: node verify_scenario.js <SCENARIO_ID>  (ex: S26)");
  process.exit(2);
}

const CONTRACTS_DIR = path.join(process.cwd(), "contracts");
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts");

function loadJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} introuvable : ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function checkPlaywrightRun(runReport) {
  // Format standard du reporter JSON de Playwright : suites[].specs[].tests[].results[]
  const failures = [];
  let totalTests = 0;

  function walk(suite) {
    (suite.specs || []).forEach((spec) => {
      (spec.tests || []).forEach((test) => {
        totalTests++;
        const lastResult = (test.results || [])[test.results.length - 1];
        if (!lastResult || lastResult.status !== "passed") {
          failures.push({
            title: spec.title,
            status: lastResult ? lastResult.status : "no_result",
            error: lastResult && lastResult.error ? lastResult.error.message : null,
          });
        }
      });
    });
    (suite.suites || []).forEach(walk);
  }
  (runReport.suites || []).forEach(walk);

  return { totalTests, failures };
}

async function runDbChecks(dbChecks, client) {
  const results = [];
  for (const check of dbChecks) {
    try {
      const res = await client.query(check.query);
      const row = res.rows[0] || {};
      let pass = true;
      let detail = "";

      if (check.expected) {
        for (const [key, expectedVal] of Object.entries(check.expected)) {
          const actual = row[key];
          // comparaison souple string/number
          if (String(actual) !== String(expectedVal)) {
            pass = false;
            detail += `champ '${key}': attendu=${expectedVal}, obtenu=${actual}. `;
          }
        }
      }
      if (check.expected_max !== undefined) {
        const countVal = Object.values(row)[0];
        if (Number(countVal) > check.expected_max) {
          pass = false;
          detail += `count obtenu=${countVal} > max attendu=${check.expected_max}. `;
        }
      }

      results.push({
        query: check.query,
        row_raw: row,
        pass,
        detail: detail || "OK",
        note: check.note || null,
      });
    } catch (err) {
      results.push({
        query: check.query,
        pass: false,
        detail: `Erreur SQL : ${err.message}`,
      });
    }
  }
  return results;
}

async function main() {
  const contractPath = path.join(CONTRACTS_DIR, `${SCENARIO_ID}_contract.json`);
  const runPath = path.join(ARTIFACTS_DIR, `${SCENARIO_ID}_run.json`);
  const verdictPath = path.join(ARTIFACTS_DIR, `${SCENARIO_ID}_verdict.json`);

  const contract = loadJSON(contractPath, "Contrat");
  const runReport = loadJSON(runPath, "Rapport Playwright");

  const frontendBackend = checkPlaywrightRun(runReport);

  let dbResults = [];
  let dbLayerStatus = "SKIPPED";
  const dbChecks = (contract.db_layer && contract.db_layer.checks) || [];

  if (dbChecks.length > 0) {
    const connString = process.env.BOLAMU_TEST_RO_DATABASE_URL;
    if (!connString) {
      dbLayerStatus = "ERROR_NO_DB_URL";
    } else {
      const client = new Client({ connectionString: connString });
      await client.connect();
      try {
        dbResults = await runDbChecks(dbChecks, client);
        dbLayerStatus = dbResults.every((r) => r.pass) ? "PASS" : "FAIL";
      } finally {
        await client.end();
      }
    }
  }

  const frontendBackendStatus =
    frontendBackend.failures.length === 0 ? "PASS" : "FAIL";

  let overallStatus;
  if (frontendBackendStatus === "PASS" && dbLayerStatus === "PASS") {
    overallStatus = "PASS";
  } else if (dbLayerStatus === "ERROR_NO_DB_URL") {
    overallStatus = "AMBIGUOUS";
  } else {
    overallStatus = "FAIL";
  }

  const verdict = {
    scenario_id: SCENARIO_ID,
    generated_at: new Date().toISOString(),
    status: overallStatus,
    layers: {
      frontend_backend: {
        status: frontendBackendStatus,
        total_tests: frontendBackend.totalTests,
        failures: frontendBackend.failures,
      },
      db: {
        status: dbLayerStatus,
        checks: dbResults,
      },
    },
    requires_human_review: overallStatus === "AMBIGUOUS",
  };

  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.writeFileSync(verdictPath, JSON.stringify(verdict, null, 2));

  // Sortie brute sur stdout — c'est CE texte-là qui doit être collé à Claude,
  // jamais un résumé fait par Cascade.
  console.log(JSON.stringify(verdict, null, 2));

  process.exit(overallStatus === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ scenario_id: SCENARIO_ID, status: "ERROR", error: err.message }, null, 2));
  process.exit(2);
});
