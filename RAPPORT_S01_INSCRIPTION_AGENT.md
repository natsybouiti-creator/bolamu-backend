# RAPPORT S01 — INSCRIPTION PATIENT VIA AGENT
> Test Playwright E2E — 28/06/2026 23:04:49

---

## RÉSUMÉ EXÉCUTIF

- **Début:** 2026-06-28T21:04:37.767Z
- **Fin:** 2026-06-28T21:04:49.268Z
- **Étapes totales:** 14
- **Étapes réussies:** ✅ 6
- **Étapes échouées:** ❌ 1
- **Violations contrat API:** 0
- **Bugs identifiés:** 0

---

## ÉTAPES DU SCÉNARIO

### ⏳ 1. Agent se connecte sur /api/v1/agence/login
- **Statut:** IN_PROGRESS
- **Détails:** N/A
- **Timestamp:** 2026-06-28T21:04:37.903Z

### ✅ 1. Agent se connecte
- **Statut:** SUCCESS
- **Détails:** Token reçu, role: undefined
- **Timestamp:** 2026-06-28T21:04:41.887Z

### ⏳ 2. Agent crée dossier patient via /api/v1/agence/souscrire-complet
- **Statut:** IN_PROGRESS
- **Détails:** N/A
- **Timestamp:** 2026-06-28T21:04:41.931Z

### ✅ 2. Agent crée dossier patient
- **Statut:** SUCCESS
- **Détails:** Subscription ID: 87, Member Code: BLM-00030, Plan: essentiel
- **Timestamp:** 2026-06-28T21:04:44.161Z

### ⏳ 3. Vérification DB - compte patient créé
- **Statut:** IN_PROGRESS
- **Détails:** N/A
- **Timestamp:** 2026-06-28T21:04:44.221Z

### ✅ 3. Vérification DB - compte patient créé
- **Statut:** SUCCESS
- **Détails:** Client trouvé: S01 Test, Statut: actif
- **Timestamp:** 2026-06-28T21:04:45.409Z

### ⏳ 4. Admin se connecte sur /api/v1/auth/admin-login
- **Statut:** IN_PROGRESS
- **Détails:** N/A
- **Timestamp:** 2026-06-28T21:04:45.434Z

### ✅ 4. Admin se connecte
- **Statut:** SUCCESS
- **Détails:** Role: admin
- **Timestamp:** 2026-06-28T21:04:46.479Z

### ⏳ 5. Vérification dossier visible sur admin
- **Statut:** IN_PROGRESS
- **Détails:** N/A
- **Timestamp:** 2026-06-28T21:04:46.510Z

### ✅ 5. Vérification dossier visible sur admin
- **Statut:** SUCCESS
- **Détails:** Patient trouvé: S01 Test, is_active: true
- **Timestamp:** 2026-06-28T21:04:47.557Z

### ⏳ 6. Vérification magic link envoyé (audit_log)
- **Statut:** IN_PROGRESS
- **Détails:** N/A
- **Timestamp:** 2026-06-28T21:04:47.575Z

### ❌ 6. Vérification magic link envoyé
- **Statut:** FAILED
- **Détails:** Route introuvable
- **Timestamp:** 2026-06-28T21:04:48.517Z

### ⏳ 7. Vérification statut abonnement actif
- **Statut:** IN_PROGRESS
- **Détails:** N/A
- **Timestamp:** 2026-06-28T21:04:48.544Z

### ✅ 7. Vérification statut abonnement actif
- **Statut:** SUCCESS
- **Détails:** Statut: active, Plan: essentiel
- **Timestamp:** 2026-06-28T21:04:49.249Z

---

## RÉPONSES API

### POST /api/v1/agence/login
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDcsInBob25lIjoiKzI0MjA3NzAwMDAxMCIsInJvbGUiOiJhZ2VudF9ib2xhbXUiLCJjb21wYW55X2lkIjpudWxsLCJpYXQiOjE3ODI2ODA2ODEsImV4cCI6MTc4MjcyMzg4MX0.T4ljEfYSSCbsex2XuQE-aQSJMOkORW6FKnV2ujZtMdk",
  "agent": {
    "id": 47,
    "full_name": "Agent Bolamu Test",
    "phone": "+242077000010",
    "company_id": null
  }
}
```
- **Timestamp:** 2026-06-28T21:04:41.887Z

### POST /api/v1/agence/souscrire-complet
```json
{
  "success": true,
  "subscription_id": 87,
  "plan": "essentiel",
  "amount_fcfa": 2000,
  "expires_at": "2026-07-28",
  "member_code": "BLM-00030",
  "temp_password": "A465A0AC6ACC",
  "canal": null,
  "proche_number": null
}
```
- **Timestamp:** 2026-06-28T21:04:44.161Z

### GET /api/v1/agence/client
```json
{
  "success": true,
  "client": {
    "id": 280,
    "full_name": "S01 Test",
    "phone": "+242068500020",
    "statut_abonnement": "actif",
    "plan": "essentiel",
    "expires_at": "2026-07-28T21:03:03.269Z",
    "sub_status": "active"
  }
}
```
- **Timestamp:** 2026-06-28T21:04:45.409Z

### POST /api/v1/auth/admin-login
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicGhvbmUiOiIrMjQyMDYwMDAwMDk5Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzgyNjgwNjg1LCJleHAiOjE3ODI2ODE1ODV9.NxpxEFVorxAV8eDV3Orrw7ATBrs-Gkh1q-QmB9ibVf8",
  "refreshToken": "68c89d4e59dcf238dffb82f91183897dff020131f8c24813feabf47bdcc20d344cfc9cafef91038ca304578d8612f7532ca0faa2e3cc98f6dacdc705d2e27cb4",
  "phone": "+242060000099",
  "role": "admin",
  "full_name": "Admin Bolamu",
  "redirectUrl": "/admin/dashboard.html"
}
```
- **Timestamp:** 2026-06-28T21:04:46.479Z

### GET /api/v1/admin/patients
```json
{
  "success": true,
  "data": [
    {
      "phone": "+242068500020",
      "full_name": "S01 Test",
      "first_name": "S01",
      "last_name": "Test",
      "created_at": "2026-06-28T21:03:03.202Z",
      "is_active": true,
      "member_code": "BLM-00030"
    },
    {
      "phone": "+242069735419",
      "full_name": "Patient Test Mega Loop",
      "first_name": null,
      "last_name": null,
      "created_at": "2026-06-25T22:17:08.419Z",
      "is_active": true,
      "member_code": null
    },
    {
      "phone": "+242099999999",
      "full_name": "Test Zora",
      "first_name": null,
      "last_name": null,
      "created_at": "2026-06-20T15:41:43.364Z",
      "is_active": true,
      "member_code": null
    },
    {
      "phone": "+242065207273",
      "full_name": "Cedric Miguel",
      "first_name": "Cedric",
      "last_name": "Miguel",
      "created_at": "2026-06-11T22:22:57.675Z",
      "is_active": true,
      "member_code": "BLM-00028"
    },
    {
      "phone": "+242066529341",
      "full_name": "Brel Bikindou",
      "first_name": "Brel",
      "last_name": "Bikindou",
      "created_at": "2026-06-08T13:39:24.358Z",
      "is_active": true,
      "member_code": "BLM-00027"
    },
    {
      "phone": "+242068500004",
      "full_name": "Patience LOEMBA",
      "first_name": "Patience",
      "last_name": "LOEMBA",
      "created_at": "2026-06-01T01:11:11.304Z",
      "is_active": true,
      "member_code": "BLM-00025"
    },
    {
      "phone": "+242068500002",
      "full_name": "Marie-Claire NGOMA",
      "first_name": "Marie-Claire",
      "last_name": "NGOMA",
      "created_at": "2026-06-01T01:11:11.304Z",
      "is_active": true,
      "member_code": "BLM-00023"
    },
    {
      "phone": "+242068500001",
      "full_name": "Jean-Paul MOUKALA",
      "first_name": "Jean-Paul",
      "last_name": "MOUKALA",
      "created_at": "2026-06-01T01:11:11.304Z",
      "is_active": true,
      "member_code": "BLM-00022"
    },
    {
      "phone": "+242068500003",
      "full_name": "Hervé BAZINGA",
      "first_name": "Hervé",
      "last_name": "BAZINGA",
      "created_at": "2026-06-01T01:11:11.304Z",
      "is_active": true,
      "member_code": "BLM-00024"
    },
    {
      "phone": "+242068500005",
      "full_name": "Rodrigue NZABA",
      "first_name": "Rodrigue",
      "last_name": "NZABA",
      "created_at": "2026-06-01T01:11:11.304Z",
      "is_active": true,
      "member_code": "BLM-00026"
    },
    {
      "phone": "+242+33612312686",
      "full_name": "Christa Samba",
      "first_name": "Christa",
      "last_name": "Samba",
      "created_at": "2026-05-31T16:16:17.004Z",
      "is_active": true,
      "member_code": "BLM-00021"
    },
    {
      "phone": "+242066055868",
      "full_name": "Justin Kéfane Bouiti",
      "first_name": "Justin Kéfane",
      "last_name": "Bouiti",
      "created_at": "2026-05-31T15:52:38.959Z",
      "is_active": true,
      "member_code": "BLM-00020"
    },
    {
      "phone": "+242065452585",
      "full_name": "Isola Bouiti",
      "first_name": "Isola",
      "last_name": "Bouiti",
      "created_at": "2026-05-31T14:38:19.856Z",
      "is_active": true,
      "member_code": "BLM-00019"
    },
    {
      "phone": "+242063214596",
      "full_name": "Manika Bouiti",
      "first_name": "Manika",
      "last_name": "Bouiti",
      "created_at": "2026-05-31T13:19:45.122Z",
      "is_active": true,
      "member_code": "BLM-00018"
    },
    {
      "phone": "+242065458932",
      "full_name": "RifRaf Jordan",
      "first_name": "RifRaf",
      "last_name": "Jordan",
      "created_at": "2026-05-30T03:59:05.935Z",
      "is_active": true,
      "member_code": "BLM-00015"
    },
    {
      "phone": "+242065412396",
      "full_name": "beatrice nguema",
      "first_name": "beatrice",
      "last_name": "nguema",
      "created_at": "2026-05-30T02:12:08.024Z",
      "is_active": true,
      "member_code": "BLM-00014"
    },
    {
      "phone": "+242062325478",
      "full_name": "Test Bolamu",
      "first_name": "Test",
      "last_name": "Bolamu",
      "created_at": "2026-05-30T02:07:44.046Z",
      "is_active": true,
      "member_code": "BLM-00013"
    },
    {
      "phone": "+242064547898",
      "full_name": "marie dubois",
      "first_name": "marie",
      "last_name": "dubois",
      "created_at": "2026-05-30T01:08:45.851Z",
      "is_active": true,
      "member_code": "BLM-00012"
    },
    {
      "phone": "+24262325478",
      "full_name": "Lakalo Bilonga",
      "first_name": "Lakalo",
      "last_name": "Bilonga",
      "created_at": "2026-05-30T00:57:39.796Z",
      "is_active": true,
      "member_code": "BLM-00011"
    },
    {
      "phone": "+24266374190TTYY",
      "full_name": "TONTON DU CONTINENT",
      "first_name": "TONTON",
      "last_name": "DU CONTINENT",
      "created_at": "2026-05-12T11:24:33.261Z",
      "is_active": true,
      "member_code": "BLM-00010"
    },
    {
      "phone": "+242068719289",
      "full_name": "Esther Lassy",
      "first_name": "Esther",
      "last_name": "Lassy",
      "created_at": "2026-05-11T17:42:50.376Z",
      "is_active": true,
      "member_code": "BLM-00009"
    },
    {
      "phone": "+24265786548",
      "full_name": "Bernard Milandou",
      "first_name": "Bernard",
      "last_name": "Milandou",
      "created_at": "2026-04-25T00:54:04.919Z",
      "is_active": true,
      "member_code": "BLM-00008"
    },
    {
      "phone": "+242063504041",
      "full_name": "Martial POATY",
      "first_name": "Martial",
      "last_name": "POATY",
      "created_at": "2026-04-23T19:22:54.416Z",
      "is_active": true,
      "member_code": "BLM-00007"
    },
    {
      "phone": "+242069855663",
      "full_name": "Loic Samba",
      "first_name": "Loic",
      "last_name": "Samba",
      "created_at": "2026-04-12T00:18:51.920Z",
      "is_active": true,
      "member_code": "BLM-00006"
    },
    {
      "phone": "+242065566869",
      "full_name": "Valery Ickonga",
      "first_name": "Valery",
      "last_name": "Ickonga",
      "created_at": "2026-04-11T15:01:16.140Z",
      "is_active": true,
      "member_code": "BLM-00005"
    },
    {
      "phone": "+242065658796",
      "full_name": "Brel Bikindou",
      "first_name": "Brel",
      "last_name": "Bikindou",
      "created_at": "2026-04-03T07:48:54.087Z",
      "is_active": true,
      "member_code": "BLM-00003"
    },
    {
      "phone": "+242066622158",
      "full_name": "Brel Bikindou",
      "first_name": "Brel",
      "last_name": "Bikindou",
      "created_at": "2026-04-03T07:36:40.557Z",
      "is_active": true,
      "member_code": "BLM-00002"
    },
    {
      "phone": "+242069735418",
      "full_name": "Antonio Test",
      "first_name": "Antonio",
      "last_name": "Ngambou",
      "created_at": "2026-03-28T06:10:09.141Z",
      "is_active": true,
      "member_code": null
    }
  ],
  "message": "",
  "timestamp": "2026-06-28T21:04:46.814Z"
}
```
- **Timestamp:** 2026-06-28T21:04:47.557Z

### GET /api/v1/admin/audit-log
```json
{
  "success": false,
  "message": "Route introuvable"
}
```
- **Timestamp:** 2026-06-28T21:04:48.517Z

### GET /api/v1/patients/subscription
```json
{
  "success": true,
  "data": {
    "plan": "essentiel",
    "amount_fcfa": 2000,
    "status": "active",
    "started_at": "2026-06-28T21:04:42.419Z",
    "expires_at": "2026-07-28T21:04:42.483Z"
  }
}
```
- **Timestamp:** 2026-06-28T21:04:49.249Z

---

## CORRECTIONS À FAIR

### BUG-S01-01
- **Type:** Route manquante
- **Endpoint:** GET /api/v1/admin/audit-log
- **Action:** À créer dans src/routes/admin.routes.js
- **Impact:** Vérification audit_log non possible (étape 6 échouée)
- **Priorité:** Moyenne (flux métier principal fonctionnel)
---

## CONCLUSION

❌ **SCENARIO S01 EN ÉCHEC** — 1 étape(s) échouée(s), 0 violation(s) contrat API.
