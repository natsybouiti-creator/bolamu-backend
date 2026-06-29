# RAPPORT TEST GROUPES SPORT
> Test de rejoindre groupes avec vrais IDs
> Date: 2026-06-28T13:36:30.308Z
> Compte: +242069735418

---

## Violations contrat API

- ❌ https://api.bolamu.co/api/v1/auth/login — data absent
- ❌ https://api.bolamu.co/api/v1/streaks/me — data absent
- ❌ https://api.bolamu.co/api/v1/leaderboard/weekly — data absent

---

## Résultats tests

| Action | Toast affiché | Erreur console | Changement DOM | Screenshot | VERDICT |
|--------|---------------|---------------|----------------|------------|---------|
| Navigation sport | N/A | N/A | Section sport visible | groupes-00-section-sport.png | ⚠️ |
| joinGroup(2) | N/A | N/A | Groupe 2 rejoint | groupes-01-join-group-2.png | ⚠️ |
| joinGroup(3) | N/A | N/A | Groupe 3 rejoint | groupes-02-join-group-3.png | ⚠️ |
| joinGroup(5) | N/A | N/A | Groupe 5 rejoint | groupes-03-join-group-5.png | ⚠️ |
| openClubPanel(2) | N/A | N/A | Panel groupe 2 ouvert | groupes-04-open-club-panel-2.png | ⚠️ |
| openCreateGroupModal | N/A | N/A | Modal création ouvert | groupes-05-open-create-group-modal.png | ⚠️ |
---

## Logs d'exécution

```
=== Navigation vers login ===
=== Remplissage formulaire login ===
CONTRAT_FAIL: data absent — https://api.bolamu.co/api/v1/auth/login
=== Navigation vers dashboard ===
=== Vérification protocole ===
CONTRAT_FAIL: data absent — https://api.bolamu.co/api/v1/streaks/me
CONTRAT_FAIL: data absent — https://api.bolamu.co/api/v1/leaderboard/weekly
✅ Protocole window.__bolamu_test disponible
=== Navigation vers section sport ===
📸 Screenshot: groupes-00-section-sport.png
=== TEST 1 — Rejoindre groupe ID 2 ===
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: joinGroup error: TypeError: Failed to fetch
    at window.fetch (https://www.bolamu.co/patient/dashboard.html:43:12)
    at window.fetch (https://www.bolamu.co/patient/dashboard.html:52:15)
    at eval (eval at evaluate (:303:30), <anonymous>:5:25)
    at UtilityScript.evaluate (<anonymous>:305:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_CONNECTION_ABORTED
CONSOLE_ERROR: Failed to load resource: net::ERR_ADDRESS_UNREACHABLE
CONSOLE_ERROR: Failed to load resource: net::ERR_ADDRESS_UNREACHABLE
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
📸 Screenshot: groupes-01-join-group-2.png
=== TEST 2 — Rejoindre groupe ID 3 ===
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: joinGroup error: TypeError: Failed to fetch
    at window.fetch (https://www.bolamu.co/patient/dashboard.html:43:12)
    at window.fetch (https://www.bolamu.co/patient/dashboard.html:52:15)
    at eval (eval at evaluate (:303:30), <anonymous>:5:25)
    at UtilityScript.evaluate (<anonymous>:305:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
CONSOLE_ERROR: Failed to load resource: net::ERR_NETWORK_CHANGED
📸 Screenshot: groupes-02-join-group-3.png
=== TEST 3 — Rejoindre groupe ID 5 ===
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
CONSOLE_ERROR: joinGroup error: TypeError: Failed to fetch
    at window.fetch (https://www.bolamu.co/patient/dashboard.html:43:12)
    at window.fetch (https://www.bolamu.co/patient/dashboard.html:52:15)
    at eval (eval at evaluate (:303:30), <anonymous>:5:25)
    at UtilityScript.evaluate (<anonymous>:305:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
CONSOLE_ERROR: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
📸 Screenshot: groupes-03-join-group-5.png
=== TEST 4 — Ouvrir panel groupe ID 2 ===
📸 Screenshot: groupes-04-open-club-panel-2.png
Panel fermé
=== TEST 5 — Modal création groupe ===
📸 Screenshot: groupes-05-open-create-group-modal.png
Modal fermé
=== Génération rapport ===
```
