# PROTOCOL API BOLAMU — Audit Frontend vs Backend (Complet)

**Date** : 29 juin 2026  
**Objectif** : Audit approfondi des 10 dashboards frontend vs routes backend

---

## CONFIGURATION GLOBALE PAR DASHBOARD

| Dashboard | Variable API | URL Base | Token localStorage | Redirection 401 |
|-----------|--------------|----------|-------------------|----------------|
| agence | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_agent_token | /login.html |
| admin | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_admin_token | /login.html |
| patient | fetch('https://api.bolamu.co/api/v1/...') | https://api.bolamu.co/api/v1 | bolamu_patient_token | /login.html |
| medecin | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_doctor_token | - |
| secretaire | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_secretaire_token | - |
| pharmacie | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_pharmacie_token | - |
| laboratoire | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_laboratoire_token | - |
| partenaire | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_partenaire_token | /partenaire/login.html |
| rh | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | bolamu_rh_token | - |
| animateur | const API = 'https://api.bolamu.co/api/v1' | https://api.bolamu.co/api/v1 | - | - |

**Socket.io :** Uniquement patient/dashboard.html (io('https://api.bolamu.co'))

---

## DASHBOARD : agence/dashboard.html

### Appels API (13 endpoints)

| Fonction JS | Méthode | Endpoint | Token | Backend |
|-------------|---------|----------|-------|---------|
| loginAgent() | POST | /api/v1/agence/login | bolamu_agent_token | ✅ agence.routes.js |
| verifierAdherent() | GET | /api/v1/agence/verifier-adherent?q=... | bolamu_agent_token | ✅ agence.routes.js |
| loadStatsGlobales() | GET | /api/v1/agence/stats-globales | bolamu_agent_token | ✅ agence.routes.js |
| loadPartenaires() | GET | /api/v1/agence/partenaires?ville=...&type=...&q=... | bolamu_agent_token | ✅ agence.routes.js |
| loadClient() | GET | /api/v1/agence/client?phone=... | bolamu_agent_token | ✅ agence.routes.js |
| loadMedecins() | GET | /api/v1/agence/medecins?ville=... | bolamu_agent_token | ✅ agence.routes.js |
| loadSlots() | GET | /api/v1/appointments/slots/:id?date=... | bolamu_agent_token | ✅ appointment.routes.js |
| bookRdv() | POST | /api/v1/agence/rdv | bolamu_agent_token | ✅ agence.routes.js |
| reclamation() | POST | /api/v1/agence/reclamation/:action | bolamu_agent_token | ✅ agence.routes.js |
| loadPlansConfig() | GET | /api/v1/agence/plans-config | bolamu_agent_token | ✅ agence.routes.js |
| confirmerSouscriptionComplete() | POST | /api/v1/agence/souscrire-complet | bolamu_agent_token | ✅ agence.routes.js |
| importEmployes() | POST | /api/v1/agence/import-employes | bolamu_agent_token | ✅ agence.routes.js |
| verifierClientExistant() | GET | /api/v1/agence/client?phone=... | bolamu_agent_token | ✅ agence.routes.js |

### localStorage keys
- bolamu_agent_token
- bolamu_agent_phone
- bolamu_agent_name

### Redirections
- 401 → /login.html
- Login success → /agence/dashboard.html
- Logout → /agence/login.html

### Incohérences
- Aucune

---

## DASHBOARD : admin/dashboard.html

### Appels API (50+ endpoints via fonction api())

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /admin/stats | GET | ✅ admin.routes.js |
| /admin/documents/:id | GET | ✅ admin-docs.routes.js |
| /admin/pending | GET | ✅ admin.routes.js |
| /admin/doctors?status=... | GET | ✅ admin.routes.js |
| /admin/pharmacies | GET | ✅ admin.routes.js |
| /admin/laboratories | GET | ✅ admin.routes.js |
| /admin/patients | GET | ✅ admin.routes.js |
| /admin/appointments | GET | ✅ admin.routes.js |
| /admin/prescriptions | GET | ✅ admin.routes.js |
| /admin/payments | GET | ✅ admin.routes.js |
| /admin/fraud | GET | ✅ admin.routes.js |
| /admin/audit?type=... | GET | ✅ admin.routes.js |
| /admin/config | GET | ✅ admin.routes.js |
| /admin/config | PUT | ✅ admin.routes.js |
| /admin/team | GET | ✅ admin.routes.js |
| /admin/team | POST | ✅ admin.routes.js |
| /admin/team/:phone | DELETE | ✅ admin.routes.js |
| /admin/credits | GET | ✅ admin.routes.js |
| /admin/credits/grant | POST | ✅ admin.routes.js |
| /ratings/admin/all | GET | ✅ ratings.routes.js |
| /admin/company-contracts | GET | ✅ admin.routes.js |
| /admin/company-contracts | POST | ✅ admin.routes.js |
| /admin/company-contracts/:id | DELETE | ✅ admin.routes.js |
| /admin/company-contracts/:id/employees | POST | ✅ admin.routes.js |
| /smartflow/admin/transactions | GET | ✅ smartflow.routes.js |
| /admin/events/pending | GET | ✅ elonga-events.routes.js |
| /events?status=published | GET | ✅ elonga-events.routes.js |
| /events/:id/publish | PATCH | ✅ elonga-events.routes.js |
| /events/:id/cancel | PATCH | ⚠️ elonga-events.routes.js (existe DELETE /events/:id/register) |
| /events/:id/registrations | GET | ✅ elonga-events.routes.js |
| /admin/vouchers?status=... | GET | ✅ voucher.routes.js |
| /admin/users/:phone/profile | GET | ✅ admin.routes.js |
| /admin/validate-user | POST | ✅ admin.routes.js |
| /admin/reject-user | POST | ✅ admin.routes.js |
| /admin/suspend-user | POST | ✅ admin.routes.js |
| /admin/doctors/:phone/rehabilitate | PATCH | ✅ doctor.routes.js |
| /admin/ban-user | POST | ✅ admin.routes.js |
| /collecte/admin/dashboard | GET | ✅ collecte.routes.js |
| /admin/ovp/pending | GET | ⚠️ collecte.routes.js (existe /collecte/ovp) |
| /admin/sepa/pending | GET | ⚠️ collecte.routes.js (existe /collecte/sepa) |
| /collecte/admin/ovp/valider/:phone | PATCH | ⚠️ collecte.routes.js |
| /collecte/admin/sepa/valider/:phone | PATCH | ⚠️ collecte.routes.js |
| /admin/conventions | GET | ✅ partner-convention.routes.js |
| /clearing/pending | GET | ✅ clearing.routes.js |
| /clearing/run | POST | ✅ clearing.routes.js |
| /clearing/:id/pay | PATCH | ⚠️ clearing.routes.js (existe /clearing/:id/reconcile) |
| /admin/conflicts?statut=... | GET | ✅ conflict.routes.js |
| /conflicts/:id/assign | PATCH | ✅ conflict.routes.js |
| /conflicts/:id | GET | ✅ conflict.routes.js |
| /conflicts/:id/statut | PATCH | ✅ conflict.routes.js |
| /conflicts/:id/resolve | PATCH | ✅ conflict.routes.js |
| /conflicts/:id/escalade | PATCH | ✅ conflict.routes.js |
| /conflicts/:id/messages | POST | ✅ conflict.routes.js |
| /auth/me | GET | ❌ MANQUANT (auth.routes.js n'a pas /me) |

### localStorage keys
- bolamu_admin_token
- bolamu_admin_phone
- bolamu_role

### Redirections
- 401 → /login.html
- Logout → /admin/login.html

### Incohérences
- **GET /auth/me** : Endpoint manquant dans auth.routes.js
- **PATCH /events/:id/cancel** : Backend a DELETE /events/:id/register
- **GET /admin/ovp/pending** : Backend a /collecte/ovp
- **GET /admin/sepa/pending** : Backend a /collecte/sepa
- **PATCH /clearing/:id/pay** : Backend a /clearing/:id/reconcile

---

## DASHBOARD : patient/dashboard.html

### Appels API (40+ endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /api/v1/patients/profil?phone=... | GET | ✅ patient.routes.js |
| /api/v1/zora/balance | GET | ✅ zora.routes.js |
| /api/v1/streaks/me | GET | ✅ streak.routes.js |
| /api/v1/events | GET | ✅ elonga-events.routes.js |
| /api/v1/events/my/registrations | GET | ✅ elonga-events.routes.js |
| /api/v1/leaderboard/weekly | GET | ✅ leaderboard.routes.js |
| /api/v1/zora/balance?phone=... | GET | ✅ zora.routes.js |
| /api/v1/sport-groups | GET | ✅ sport-groups.routes.js |
| /api/v1/zora/ledger?limit=... | GET | ✅ zora.routes.js |
| /api/v1/patients/subscription?phone=... | GET | ✅ patient.routes.js |
| /api/v1/patients/constantes/:phone | GET | ✅ constantes-medicales.routes.js |
| /api/v1/reports/patient/:phone/timeline | GET | ⚠️ consultation-report.routes.js (existe /api/v1/consultation-report/:id) |
| /api/v1/reports/access-log/:phone | GET | ⚠️ health-records.routes.js (existe /api/v1/health-records/access-log/:recordId) |
| /api/v1/zora/games/config | GET | ✅ zora-games.routes.js |
| /api/v1/doctors | GET | ✅ doctor.routes.js |
| /api/v1/zora/rewards | GET | ✅ zora-marketplace.routes.js |
| /api/v1/vouchers/my | GET | ✅ voucher.routes.js |
| /api/v1/dmn/access-log | GET | ✅ dmn.routes.js |
| /api/v1/qr/generate | GET | ✅ qr.routes.js |
| /api/v1/clubs/:id/join | POST | ✅ clubs.routes.js |
| /api/v1/auth/login | POST | ✅ auth.routes.js |
| /api/v1/vouchers/generate | POST | ✅ voucher.routes.js |
| /api/v1/dmn/download/verify | POST | ✅ dmn.routes.js |
| /api/v1/dmn/summary | GET | ✅ dmn.routes.js |
| /api/v1/dmn/download/:document_id | GET | ✅ dmn.routes.js |
| /api/v1/dmn/qr-payload | GET | ✅ dmn.routes.js |
| /api/v1/events/:id/register | POST | ✅ elonga-events.routes.js |
| /api/v1/zora/games/play | POST | ✅ zora-games.routes.js |
| /api/v1/patients/constantes | PUT | ❌ MANQUANT (existe GET /api/v1/patients/constantes/:phone) |
| /api/v1/appointments/slots/:id?date=... | GET | ✅ appointment.routes.js |
| /api/v1/appointments/book | POST | ✅ appointment.routes.js |
| /api/v1/zora/redeem | POST | ✅ zora-marketplace.routes.js |
| /api/v1/chat/conversations/1/messages | GET | ✅ chat.routes.js |
| /api/v1/clubs | GET | ✅ clubs.routes.js |
| /api/v1/events/:id | GET | ✅ elonga-events.routes.js |
| /api/v1/events/:id/participants | GET | ✅ elonga-events.routes.js |
| /api/v1/chat/conversations | GET | ✅ chat.routes.js |
| /api/v1/clubs/:id | GET | ✅ clubs.routes.js |
| /api/v1/clubs/:id/members | GET | ✅ clubs.routes.js |

### Socket.io
- 🔌 io('https://api.bolamu.co')
- 🔌 Events: new_message, leaderboard_updated
- 🔌 Emit: join_conversation, new_message

### localStorage keys
- bolamu_patient_token
- bolamu_patient_phone

### Redirections
- 401/403 → /login.html
- Login success → /patient/login.html
- Logout → /patient/login.html

### Incohérences
- **PUT /api/v1/patients/constantes** : Endpoint manquant (existe GET /api/v1/patients/constantes/:phone)
- **GET /api/v1/reports/patient/:phone/timeline** : Backend a /api/v1/consultation-report/:id
- **GET /api/v1/reports/access-log/:phone** : Backend a /api/v1/health-records/access-log/:recordId

---

## DASHBOARD : medecin/dashboard.html

### Appels API (30+ endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /doctors/profil?phone=... | GET | ✅ doctor.routes.js |
| /doctors/slots?phone=... | GET | ✅ doctor.routes.js |
| /doctors/slots | POST | ✅ doctor.routes.js |
| /doctors/slots/:id | DELETE | ✅ doctor.routes.js |
| /doctors/change-password | POST | ✅ doctor.routes.js |
| /consultations/queue | GET | ✅ consultation.routes.js |
| /appointments/doctor/:phone | GET | ✅ appointment.routes.js |
| /consultations/open | POST | ✅ consultation.routes.js |
| /reports/submit | POST | ✅ consultation-report.routes.js |
| /smartflow/medicaments/check?nom=... | GET | ✅ smartflow.routes.js |
| /smartflow/stats/moi?mois=... | GET | ✅ smartflow.routes.js |
| /consultations/:id/close | POST | ✅ consultation.routes.js |
| /ordonnances | POST | ✅ ordonnance.routes.js |
| /ai-consult/briefing | POST | ✅ ai-consult.routes.js |
| /ai-consult/tricolor | POST | ✅ ai-consult.routes.js |
| /ai-consult/renewal/:phone | GET | ✅ ai-consult.routes.js |
| /lab/prescribe | POST | ✅ lab.routes.js |
| /qr/generate?phone=... | GET | ✅ qr.routes.js |
| /map/position | PATCH | ✅ map.routes.js |
| /patients/constantes/:phone | GET | ✅ constantes-medicales.routes.js |
| /doctors/constantes-patient | PUT | ❌ MANQUANT |
| /patients/search?q=... | GET | ✅ patient.routes.js |
| /zora/vouchers/:uuid/consume | POST | ✅ zora-marketplace.routes.js |
| /zora/partner/vouchers | GET | ✅ zora-marketplace.routes.js |

### localStorage keys
- bolamu_doctor_token

### Redirections
- Aucune détectée

### Incohérences
- **PUT /doctors/constantes-patient** : Endpoint manquant pour que les médecins mettent à jour les constantes d'un patient

---

## DASHBOARD : secretaire/dashboard.html

### Appels API (20+ endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /secretariat/clinic-info | GET | ✅ secretariat.routes.js |
| /secretariat/verifier-adherent?q=... | GET | ✅ secretariat.routes.js |
| /secretariat/queue?date=... | GET | ✅ secretariat.routes.js |
| /secretariat/medecins | GET | ✅ secretariat.routes.js |
| /secretariat/agenda?doctor_phone=... | GET | ✅ secretariat.routes.js |
| /secretariat/rdv/:id/status | PATCH | ✅ secretariat.routes.js |
| /secretariat/patients/search?q=... | GET | ✅ secretariat.routes.js |
| /secretariat/medecin/:id/disponibilites | GET | ✅ secretariat.routes.js |
| /qr/verify | GET | ✅ qr.routes.js |
| /appointments/slots/:id?date=... | GET | ✅ appointment.routes.js |
| /patients/search?q=... | GET | ✅ patient.routes.js |
| /secretariat/bloquer-creneau | POST | ✅ secretariat.routes.js |

### localStorage keys
- bolamu_secretaire_token

### Redirections
- Aucune détectée

### Incohérences
- Aucune

---

## DASHBOARD : pharmacie/dashboard.html

### Appels API (20+ endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /qr/verify | GET | ✅ qr.routes.js |
| /pharmacies/profil?phone=... | GET | ✅ pharmacie.routes.js |
| /pharmacies/change-password | POST | ✅ pharmacie.routes.js |
| /prescriptions/by-session/:code | GET | ✅ prescription.routes.js |
| /smartflow/medicaments/check?nom=... | GET | ✅ smartflow.routes.js |
| /prescriptions/deliver | POST | ✅ prescription.routes.js |
| /zora/vouchers/:uuid/consume | POST | ✅ zora-marketplace.routes.js |
| /zora/partner/vouchers | GET | ✅ zora-marketplace.routes.js |
| /smartflow/hors-catalogue | POST | ✅ smartflow.routes.js |
| /smartflow/stats/moi?mois=... | GET | ✅ smartflow.routes.js |
| /prescriptions/pharmacie/:phone | GET | ✅ prescription.routes.js |
| /map/position | PATCH | ✅ map.routes.js |
| /smartflow/ssp/medicaments | GET | ✅ smartflow.routes.js |
| /smartflow/pharmacie/catalogue | GET | ✅ smartflow.routes.js |
| /smartflow/pharmacie/catalogue | POST | ✅ smartflow.routes.js |

### localStorage keys
- bolamu_pharmacie_token

### Redirections
- Aucune détectée

### Incohérences
- Aucune

---

## DASHBOARD : laboratoire/dashboard.html

### Appels API (15+ endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /qr/verify | GET | ✅ qr.routes.js |
| /zora/vouchers/:uuid/consume | POST | ✅ zora-marketplace.routes.js |
| /zora/partner/vouchers | GET | ✅ zora-marketplace.routes.js |
| /laboratories/profil?phone=... | GET | ✅ laboratoire.routes.js |
| /lab/change-password | POST | ✅ lab.routes.js |
| /lab/pending | GET | ✅ lab.routes.js |
| /lab/prescription/:code | GET | ✅ lab.routes.js |
| /smartflow/medicaments/check?nom=... | GET | ✅ smartflow.routes.js |
| /smartflow/hors-catalogue | POST | ✅ smartflow.routes.js |
| /smartflow/stats/moi?mois=... | GET | ✅ smartflow.routes.js |
| /lab/results/submit | POST | ✅ lab.routes.js |
| /auth/me | GET | ❌ MANQUANT |
| /map/position | PATCH | ✅ map.routes.js |

### localStorage keys
- bolamu_laboratoire_token

### Redirections
- Aucune détectée

### Incohérences
- **GET /auth/me** : Endpoint manquant dans auth.routes.js

---

## DASHBOARD : partenaire/dashboard.html

### Appels API (5 endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /partenaire/stats | GET | ✅ partenaire.routes.js |
| /vouchers/programs | GET | ✅ voucher.routes.js |
| /partenaire/validations | GET | ⚠️ voucher.routes.js (existe /vouchers/partner) |
| /partenaire/voucher/validate | POST | ⚠️ voucher.routes.js (existe /vouchers/validate) |

### localStorage keys
- bolamu_partenaire_token
- bolamu_partenaire_phone
- bolamu_partenaire_name

### Redirections
- Not logged in → /partenaire/login.html
- Logout → /partenaire/login.html

### Incohérences
- **GET /partenaire/validations** : Backend a /vouchers/partner
- **POST /partenaire/voucher/validate** : Backend a /vouchers/validate

---

## DASHBOARD : rh/dashboard.html

### Appels API (10 endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /smartflow/rh/dashboard | GET | ✅ smartflow.routes.js |
| /smartflow/rh/dashboard?mois=... | GET | ✅ smartflow.routes.js |
| /smartflow/rh/export/:mois | GET | ✅ smartflow.routes.js |
| /smartflow/rh/retenues/provisoire?mois=... | GET | ✅ smartflow.routes.js |
| /smartflow/rh/retenues/valider | POST | ✅ smartflow.routes.js |
| /smartflow/rh/config/categories | GET | ✅ smartflow.routes.js |
| /smartflow/rh/config/categories | POST | ✅ smartflow.routes.js |
| /smartflow/rh/icp/:mois | GET | ✅ smartflow.routes.js |
| /smartflow/rh/rapport/:mois | GET | ✅ smartflow.routes.js |

### localStorage keys
- Non détectées

### Redirections
- Aucune détectée

### Incohérences
- Aucune

---

## DASHBOARD : animateur/dashboard.html

### Appels API (12 endpoints)

| Endpoint | Méthode | Backend |
|----------|---------|---------|
| /animateur/stats | GET | ✅ animateur.routes.js |
| /animateur/events?limit=... | GET | ✅ animateur.routes.js |
| /animateur/checkins/today | GET | ✅ animateur.routes.js |
| /animateur/events/:id/registrations | GET | ✅ elonga-events.routes.js |
| /animateur/events | POST | ✅ elonga-events.routes.js |
| /events/:id/activate | PATCH | ✅ elonga-events.routes.js |
| /events/:id/complete | PATCH | ✅ elonga-events.routes.js |
| /events/:id/checkin-token | GET | ✅ elonga-events.routes.js |
| /events/:id/checkin | POST | ✅ elonga-events.routes.js |
| /animateur/clubs | GET | ✅ clubs.routes.js |
| /animateur/clubs/:id/notify | POST | ✅ animateur.routes.js |

### localStorage keys
- Non détectées

### Redirections
- Aucune détectée

### Incohérences
- Aucune

---

## BILAN GLOBAL

### Endpoints frontend sans backend ❌ (Critiques)

| Dashboard | Endpoint | Impact |
|-----------|----------|--------|
| patient | PUT /api/v1/patients/constantes | Les patients ne peuvent pas mettre à jour leurs constantes médicales |
| medecin | PUT /api/v1/doctors/constantes-patient | Les médecins ne peuvent pas mettre à jour les constantes d'un patient |
| admin | GET /api/v1/auth/me | Les admins ne peuvent pas récupérer leurs infos utilisateur |
| laboratoire | GET /api/v1/auth/me | Les laboratoires ne peuvent pas récupérer leurs infos utilisateur |

### Incohérences de chemin ⚠️

| Dashboard | Appel frontend | Endpoint backend réel |
|-----------|---------------|----------------------|
| patient | GET /api/v1/reports/patient/:phone/timeline | GET /api/v1/consultation-report/:id |
| patient | GET /api/v1/reports/access-log/:phone | GET /api/v1/health-records/access-log/:recordId |
| admin | GET /api/v1/admin/ovp/pending | GET /api/v1/collecte/ovp |
| admin | GET /api/v1/admin/sepa/pending | GET /api/v1/collecte/sepa |
| admin | PATCH /api/v1/clearing/:id/pay | PATCH /api/v1/clearing/:id/reconcile |
| admin | PATCH /api/v1/events/:id/cancel | DELETE /api/v1/events/:id/register |
| partenaire | GET /api/v1/partenaire/validations | GET /api/v1/vouchers/partner |
| partenaire | POST /api/v1/partenaire/voucher/validate | POST /api/v1/vouchers/validate |

### Incohérences de méthode HTTP ⚠️

| Dashboard | Frontend | Backend |
|-----------|----------|---------|
| patient | PUT /api/v1/patients/constantes | GET /api/v1/patients/constantes/:phone (manque PUT) |
| medecin | PUT /api/v1/doctors/constantes-patient | GET /api/v1/patients/constantes/:phone (manque PUT) |

### Socket.io 🔌

| Dashboard | Événements émis | Événements reçus |
|-----------|-----------------|------------------|
| patient | join_conversation, new_message | new_message, leaderboard_updated |

### Recommandations

1. **Ajouter GET /api/v1/auth/me** dans auth.routes.js pour tous les dashboards
2. **Ajouter PUT /api/v1/patients/constantes** pour permettre aux patients de mettre à jour leurs constantes
3. **Ajouter PUT /api/v1/doctors/constantes-patient** pour permettre aux médecins de mettre à jour les constantes d'un patient
4. **Corriger les chemins admin** pour OVP/SEPA/clearing/events
5. **Standardiser les endpoints partenaire** pour les vouchers
