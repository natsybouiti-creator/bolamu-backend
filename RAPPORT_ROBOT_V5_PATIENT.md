# RAPPORT ROBOT V5 — PATIENT DASHBOARD
Généré le 2026-06-28T11:36:45.375Z

---

## TABLEAU 1 — Tests UI

| Bouton | Comportement réel | Screenshot | VERDICT |
|--------|------------------|------------|---------|
| nav-accueil | Clic réussi | screenshot-nav-accueil.png | ✅ conforme |
| nav-gagner | Clic réussi | screenshot-nav-gagner.png | ✅ conforme |
| nav-suivre | Clic réussi | screenshot-nav-suivre.png | ✅ conforme |
| nav-recompenses | Clic réussi | screenshot-nav-recompenses.png | ✅ conforme |
| btn-profil | Clic réussi | screenshot-btn-profil.png | ✅ conforme |
| filterTout | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| filterClin | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| filterPharm | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| filterLabo | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| play-scratch | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| play-wheel | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| wheel-spin | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| play-chest | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| chest-0 | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| play-quiz | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| quiz-opt-0 | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| participate-1 | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| participate-2 | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| participate-3 | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| const-edit | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| const-taille | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| const-poids | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| const-save | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| btn-dmn-qr | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| close-dmn-qr-btn | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| btn-dossier-medical | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| close-dmn-docs-modal | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| btn-download-dmn | locator.waitFor: Timeout 5000ms exceeded.
Call log |  | ❌ crash |
| filterCatTout | Clic réussi | screenshot-filterCatTout.png | ✅ conforme |
| filterCatElec | Clic réussi | screenshot-filterCatElec.png | ✅ conforme |
| filterCatVoyage | Clic réussi | screenshot-filterCatVoyage.png | ✅ conforme |
| filterCatTelecom | Clic réussi | screenshot-filterCatTelecom.png | ✅ conforme |
| filterCatHotels | Clic réussi | screenshot-filterCatHotels.png | ✅ conforme |
| filterCatSport | Clic réussi | screenshot-filterCatSport.png | ✅ conforme |
| filterCatBeaute | Clic réussi | screenshot-filterCatBeaute.png | ✅ conforme |
| filterCatCarburant | Clic réussi | screenshot-filterCatCarburant.png | ✅ conforme |
| closeProfile | Clic réussi | screenshot-closeProfile.png | ✅ conforme |
| text:Mes informations | Clic réussi | screenshot-text-Mes-informations.png | ✅ conforme |
| text:Notifications | Clic réussi | screenshot-text-Notifications.png | ✅ conforme |

## TABLEAU 2 — Conformité contrat API

| Route appelée | success ✓ | data ✓ | error.code ✓ | VERDICT |
|---------------|-----------|--------|--------------|---------|
| https://api.bolamu.co/api/v1/auth/login | true | N/A | N/A | ❌ CONTRAT_FAIL |
| https://api.bolamu.co/api/v1/zora/games/config | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/zora/ledger?limit=10 | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/reports/access-log/%2B242069735 | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/events/my/registrations | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/qr/generate | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/zora/balance?phone=%2B242069735 | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/patients/constantes/%2B24206973 | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/reports/patient/%2B242069735418 | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/leaderboard/weekly | true | N/A | N/A | ❌ CONTRAT_FAIL |
| https://api.bolamu.co/api/v1/zora/rewards | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/vouchers/my | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/streaks/me | true | N/A | N/A | ❌ CONTRAT_FAIL |
| https://api.bolamu.co/api/v1/dmn/access-log | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/doctors | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/patients/profil?phone=%2B242069 | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/sport-groups | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/zora/balance | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/patients/subscription?phone=%2B | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/events | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/qr/generate | true | true | N/A | ✅ conforme |
| https://api.bolamu.co/api/v1/qr/generate | true | true | N/A | ✅ conforme |

---

## SECTION 1 — Violations contrat API

- CONTRAT_FAIL: data absent sur succès — https://api.bolamu.co/api/v1/auth/login
- CONTRAT_FAIL: data absent sur succès — https://api.bolamu.co/api/v1/leaderboard/weekly
- CONTRAT_FAIL: data absent sur succès — https://api.bolamu.co/api/v1/streaks/me

---

## SECTION 2 — Récapitulatif UI

- ✅ Conformes : 16
- ⚠️ Partiels : 0
- 🔴 Silencieux : 0
- ❌ Crash : 23
- **Total :** 39

---

## SECTION 3 — Récapitulatif API

- ✅ Conformes : 19
- ❌ CONTRAT_FAIL : 3
- **Total :** 22

---

## SECTION 4 — Liste des erreurs par criticité

### ❌ Crash (UI)
- filterTout: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="filterTout"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="398" data-testid="filterTout">Tout</button>[22m

- filterClin: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="filterClin"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="399" data-testid="filterClin">Cliniques</button>[22m

- filterPharm: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="filterPharm"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="400" data-testid="filterPharm">Pharmacies</button>[22m

- filterLabo: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="filterLabo"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="401" data-testid="filterLabo">Labos</button>[22m

- play-scratch: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="play-scratch"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="626" data-testid="play-scratch">…</button>[22m

- play-wheel: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="play-wheel"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="626" data-testid="play-wheel">…</button>[22m

- wheel-spin: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="wheel-spin"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="956" data-testid="wheel-spin">…</button>[22m

- play-chest: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="play-chest"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="626" data-testid="play-chest">…</button>[22m

- chest-0: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="chest-0"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <div id="chest-0" data-dc-tpl="966" data-testid="chest-0">…</div>[22m

- play-quiz: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="play-quiz"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="626" data-testid="play-quiz">…</button>[22m

- quiz-opt-0: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="quiz-opt-0"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="984" data-testid="quiz-opt-0">…</button>[22m

- participate-1: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="participate-1"]').first() to be visible[22m

- participate-2: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="participate-2"]').first() to be visible[22m

- participate-3: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="participate-3"]').first() to be visible[22m

- const-edit: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="const-edit"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="497" data-testid="const-edit">…</button>[22m

- const-taille: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="const-taille"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <input value="" type="number" data-dc-tpl="869" data-testid="const-taille"/>[22m

- const-poids: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="const-poids"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <input value="" type="number" data-dc-tpl="866" data-testid="const-poids"/>[22m

- const-save: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="const-save"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="893" data-testid="const-save">Enregistrer</button>[22m

- btn-dmn-qr: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-dmn-qr"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="542" data-testid="btn-dmn-qr">Générer mon QR médical</button>[22m

- close-dmn-qr-btn: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="close-dmn-qr-btn"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="1052" data-testid="close-dmn-qr-btn">Fermer</button>[22m

- btn-dossier-medical: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-dossier-medical"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="409" data-testid="btn-dossier-medical">Mon dossier médical</button>[22m

- close-dmn-docs-modal: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="close-dmn-docs-modal"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="1028" data-testid="close-dmn-docs-modal">…</button>[22m

- btn-download-dmn: locator.waitFor: Timeout 5000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-download-dmn"]').first() to be visible[22m
[2m    14 × locator resolved to hidden <button data-dc-tpl="528" data-testid="btn-download-dmn">Accéder aux documents</button>[22m


### 🔴 Silencieux (UI)
Aucun élément silencieux.

### ❌ CONTRAT_FAIL (API)
- CONTRAT_FAIL: data absent sur succès — https://api.bolamu.co/api/v1/auth/login
- CONTRAT_FAIL: data absent sur succès — https://api.bolamu.co/api/v1/leaderboard/weekly
- CONTRAT_FAIL: data absent sur succès — https://api.bolamu.co/api/v1/streaks/me
