# Checklist de validation — Harnais de test Bolamu

Dernière mise à jour : 2026-07-01

## A. Sécurité
- [x] temp_test_ro_password.txt (mot de passe en clair) supprimé
- [x] Confirmé qu'aucun fichier contenant un mot de passe n'est trackable par git

## B. Rôle Postgres lecture seule
- [x] Rôle bolamu_test_ro créé (mot de passe alphanumérique, sans caractères spéciaux)
- [x] Écriture refusée avec message réel "permission denied for table subscriptions"
- [x] Lecture confirmée avec résultat réel de requête (count: '40')
- [x] BOLAMU_TEST_RO_DATABASE_URL stocké dans .env, jamais commité

## C. Installation du harnais
- [x] Dépendance pg installée (package.json, package-lock.json)
- [x] Dossiers contracts/ et artifacts/ créés
- [x] verify_scenario.js, run_harness_loop.ps1, scripts/check-json-valid.js,
      scripts/read-verdict-status.js, scripts/check-playwright-errors.js en place

## D. Règles Windsurf
- [x] Section "HARNESS — RÈGLES NON NÉGOCIABLES" ajoutée à .windsurfrules
- [x] Contenu vérifié ligne par ligne (tail -30) contre TEST_HARNESS_PROTOCOL.md section 5
- [x] Commit isolé (df3171f)

## E. Test à blanc de bout en bout
- [x] run_harness_loop.ps1 exécuté sur S04 sans erreur de script
- [x] JSON Playwright produit et validé (pas de corruption d'encodage bloquante côté parsing)
- [x] Connexion DB réelle confirmée (layers.db.status = PASS avec vraie requête)
- [x] Verdict FAIL produit correctement quand le test échoue réellement (pas de faux PASS)
- [x] Bug "chemin absolu → 0 tests trouvés" identifié et corrigé
- [x] Bug "échappement \S dans node -e" identifié et corrigé (déplacé dans script dédié)

## F. Bugs de fond hérités de B1
- [x] S21 : cleanup ajouté (adminToken + suppression employés test) — commit c299de9
- [x] Config soins dupliquée : unifiée dans playwright.config.js — commit 1b1a682
- [x] S27 : BUG-011 documenté (format incompatible avec /zora/earn), correction différée à B2
- [ ] Connu et accepté comme limite actuelle : le contrat S04 (et probablement
      d'autres) peut valider une ligne DB périmée d'un run antérieur faute de
      contrainte temporelle ou de cleanup complet. Documenté, pas bloquant
      pour ouvrir B2, mais à corriger avant de faire confiance aux verdicts
      PASS sur ces scénarios précis.

## Statut global
Système harnais validé pour usage en B2, avec une limite connue (contrainte
temporelle des contrats à renforcer au fil de l'eau, scénario par scénario).
