# PILOTAGE BOLAMU

> ⚠️ **DOCUMENT HISTORIQUE (juin 2025)** — certaines affirmations sont obsolètes : `wame.service.js` n'est pas le seul service WhatsApp (le canal actif est `whatsapp.service.js`/`sendAutoMessage()`), plusieurs noms de fichiers ne correspondent plus aux fichiers réels. Consulter `ARCHITECTURE_BOLAMU_OVERVIEW.md` pour l'état actuel.

**Document de référence opérationnelle — Architecture Agents & Boucles Métier**
*Juin 2025 — v3.0*

---

## 1. DESTINATION FINALE

La plateforme Bolamu connecte les patients, professionnels de santé, entreprises et partenaires commerciaux autour de trois piliers :

- Santé préventive et curative accessible via un réseau structuré de cliniques, médecins et pharmacies
- Économie de la récompense — les comportements sains génèrent des Zora convertibles chez les partenaires marchands
- Intelligence RH — les entreprises pilotent l'engagement santé de leurs équipes sans jamais exposer de données nominatives

---

## 2. RÈGLES D'OR — NON NÉGOCIABLES

1. Aucun git push sans validation Master Loop + confirmation WhatsApp reçue sur numéro test.
2. Preuve SQL définie AVANT que l'agent commence. Le bureau d'études (Claude) la pose, pas l'agent.
3. Changements chirurgicaux — un agent ne touche que les fichiers de son périmètre de lot.
4. `public/patient/dashboard.html` et `public/pharmacie/dashboard.html` : zéro changement visuel.
5. Toute donnée de santé nominative est chiffrée au repos. Jamais de jointure `health_records` ↔ tables d'identité dans les payloads RH.
6. `wame.service.js` est le SEUL service WhatsApp autorisé.
7. `normalizePhone()` sur tout input téléphone. Aucune valeur en dur — tout passe par `platform_config`.
8. L'Agent UX/UI lit `docs/design_system.md` et `bolamu-ds.css` AVANT de toucher un dashboard.

---

## 3. HIÉRARCHIE DES LOOPS

```
VOUS (Natsy)
    └── Master Loop
            ├── Boucle 0 — Administration & Contrôle
            ├── Boucle 1 — Fondation Patient, Agence & Inscription Partenaires
            ├── Boucle 2 — Communauté & Engagement
            ├── Boucle 3 — Prévention, Animateurs & Elonga
            ├── Boucle 4 — Parcours de Soins
            ├── Boucle 5 — Réseau Partenaires Santé
            ├── Boucle 6 — Récompenses & Économie Zora
            └── Boucle 7 — RH, Entreprises & SmartFlow
```

- **Vous** : validez chaque boucle livrée, donnez le feu vert git push, lisez uniquement les preuves.
- **Master Loop** : lit ce fichier, coordonne les 8 boucles, lance les tests cross-boucles après chaque livraison, envoie le rapport WhatsApp final.
- **Boucles Métier** : chaque boucle est un lot indépendant avec ses agents, fichiers et preuves.
- **Agents** : exécutent dans leur périmètre strict, ne touchent pas aux fichiers des autres boucles.

---

## 4. PRINCIPES KARPATHY — CODE DE CONDUITE DES AGENTS

| Principe | Application dans Bolamu |
|---|---|
| **Think Before Coding** | L'agent formule ses hypothèses avant d'écrire. En cas d'ambiguïté, il s'arrête et demande. Jamais de choix silencieux. |
| **Simplicity First** | Minimum de code pour résoudre le problème. Pas d'abstraction spéculative. 200 lignes pouvant être 50 → on réécrit. |
| **Surgical Changes** | On touche uniquement les fichiers du périmètre du lot. Un agent Boucle 4 ne touche JAMAIS `pharmacie/dashboard.html`. |
| **Goal-Driven Execution** | La preuve (SQL + WhatsApp + Design) est définie AVANT le début. L'agent boucle jusqu'à ce que les trois soient vertes. |

---

## 5. SKILLS & COMPÉTENCES PAR AGENT

| Agent | Compétences clés | Règles de comportement |
|---|---|---|
| **Architecte Données** | PostgreSQL strict, migrations idempotentes, contraintes d'intégrité, index séparés | `CREATE TABLE IF NOT EXISTS` obligatoire. Tables BHP non joinables aux tables d'identité. Index dans fichiers séparés. |
| **Architecte Backend** | Node.js/Express, idempotence, RBAC, normalisation téléphone | `normalizePhone()` sur tout input. Aucune valeur en dur. `wame.service.js` uniquement. Codes HTTP imposés par action. |
| **Architecte Santé** | BHP, chiffrement AES-256, CNPD Loi 5-2025, RBAC médical, ordonnances | Chiffrement au repos obligatoire. Jointures `health_records` ↔ identité interdites dans payloads RH. |
| **Architecte Communauté** | WebSockets, temps réel, gamification, Elonga, Google Fit, Zora | Attribution Zora par preuve : `ground_truth` (QR), `device_measured` (Google Fit), `auto_recorded` (plateforme). Anti-fraude double scan. |
| **Architecte Business** | SmartFlow, KPI RH, anonymisation, formules ROI, vouchers, abonnements | Jamais `user_id` dans payloads RH. Formules ROI vérifiables au centime. Dette Bolamu envers partenaires récompenses. |
| **Agent UX/UI** | Design system Bolamu, Plus Jakarta Sans, Navy `#0A2463`, Turquoise `#00C9A7` | Lit `design_system.md` + `bolamu-ds.css` avant tout. Dashboards protégés (patient + pharmacie) : zéro changement visuel. |
| **QA / Contrôleur** | Playwright, SQL de preuve, tests intégration, non-régression, WhatsApp | Scénarios fraude obligatoires (double scan, accès non autorisé). Capture Playwright pharmacie. Checklist réception 3 preuves. |
| **Master Loop** | Coordination cross-boucles, rapport final, tests d'intégration globaux | Lit ce fichier. Parcours Playwright complet après chaque boucle. Rapport WhatsApp à Natsy avant git push. Ne code pas. |

---

## 6. TEMPLATE DE SESSION CASCADE

```
[SKILL: <Nom de l'agent> Bolamu]
Tu es <rôle> de la plateforme Bolamu.

Règles permanentes :
- Principes Karpathy (Think, Simple, Surgical, Goal-Driven)
- wame.service.js uniquement pour WhatsApp
- normalizePhone() sur tout input téléphone
- Aucune valeur en dur → platform_config
- Ne touche pas les fichiers hors périmètre du lot

Boucle en cours : [NOM DE LA BOUCLE]
Lot : [DESCRIPTION DU LOT]
Fichiers autorisés : [LISTE EXACTE]
Preuve SQL : [REQUÊTE EXACTE]
Preuve WhatsApp : [NUMÉRO TEST + MESSAGE ATTENDU]
Preuve Design : [ÉLÉMENTS VISUELS À VÉRIFIER]
```

---

## 7. LES 8 BOUCLES MÉTIER

> Chaque boucle est un lot indépendant. Les trois preuves (SQL/Fonctionnel, WhatsApp, Design) doivent être vertes avant de passer à la suivante.

---

### BOUCLE 0 — Administration & Contrôle

**Résultat métier :** L'admin se connecte, visualise l'ensemble de la plateforme, valide l'inscription des partenaires réseau, gère `platform_config`, modère le contenu, consulte les logs et statistiques globales.

**Résultat visuel :**
- `public/admin/dashboard.html` — tableau de bord global, gestion utilisateurs, validation partenaires, configuration. Agent UX/UI optimise selon `design_system.md`.
- `public/admin/content.html` — modération contenu, logs d'audit.

**Fichiers :**
- `routes/admin.routes.js`, `routes/admin-docs.routes.js`
- `services/wame.service.js`
- `public/admin/dashboard.html`, `public/admin/content.html`
- Tables : `users`, `audit_log`, `platform_config`, `partner_conventions`, `clinics`

**Agents :** Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → Admin valide un partenaire → statut mis à jour dans `partner_conventions`. Modification `platform_config` → valeur persistée et lue correctement par le service concerné.
- **WhatsApp** → Partenaire reçoit notification de validation de son compte réseau Bolamu.
- **Design** → Dashboard admin : Navy `#0A2463`, Turquoise `#00C9A7`, Plus Jakarta Sans, Material Symbols Outlined, composants admin conformes `design_system.md`.

---

### BOUCLE 1 — Fondation Patient, Agence & Inscription Partenaires Réseau

**Résultat métier :** Patient inscrit, abonnement actif, solde Zora initialisé. Agent agence encaisse cash et crée un compte. Médecins, pharmacies et laboratoires onboardés dans le réseau. Idempotence du ledger garantie.

**Résultat visuel :**
- `public/patient/dashboard.html` — **AUCUN CHANGEMENT VISUEL**. Fonctionnel uniquement.
- `public/agence/dashboard.html` — formulaire inscription + confirmation encaissement. Agent UX/UI optimise selon `design_system.md`.

**Fichiers :**
- `routes/patient.routes.js`, `routes/agence.routes.js`, `routes/auth.routes.js`
- `services/zoraService.js`, `services/wame.service.js`
- `public/patient/dashboard.html`, `public/agence/dashboard.html`
- Tables : `users`, `subscriptions`, `zora_points`, `zora_ledger`, `idempotency_keys`, `whatsapp_notifications`

**Agents :** Architecte Données · Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → Inscription patient → crédit Zora initial → `SELECT` sur `zora_ledger` : solde = somme des lignes. Second appel identique → rejeté 409. Agent agence encaisse → ligne dans `bolamu_accounts` créée.
- **WhatsApp** → Patient reçoit message de bienvenue avec son numéro de membre et palier d'abonnement actif.
- **Design** → Capture `public/agence/dashboard.html` : Plus Jakarta Sans, Navy + Turquoise, Material Symbols Outlined, zéro emoji, composants agence conformes `design_system.md`.

---

### BOUCLE 2 — Communauté & Engagement

**Résultat métier :** Adhérents créent et rejoignent des équipes sport, s'envoient des messages en temps réel, participent à des défis collectifs avec bonus Zora.

**Résultat visuel :**
- Pages dédiées par équipe sport — chaque équipe a sa propre page avec membres, classement, défis en cours, fil de chat. Agent UX/UI crée ces pages selon `design_system.md`.
- `public/patient/dashboard.html` — **AUCUN CHANGEMENT VISUEL**. Fonctionnel uniquement.

**Fichiers :**
- `routes/chat.routes.js`, `routes/sport-groups.routes.js`, `routes/clubs.routes.js`, `routes/leaderboard.routes.js`, `routes/streak.routes.js`
- `services/socketService.js`, `services/wame.service.js`
- `public/patient/dashboard.html`, pages équipes dédiées
- Tables : `conversations`, `messages`, `sport_groups`, `sport_group_members`, `clubs`, `club_members`, `leaderboard_weekly`, `user_streaks`, `whatsapp_notifications`

**Agents :** Architecte Communauté · Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → 20 messages simultanés entre deux utilisateurs fictifs → `SELECT` sur `messages` : ordre chronologique intact, zéro perte. Défi complété → `zora_ledger` crédité selon `zora_earn_rules`.
- **WhatsApp** → Membre reçoit notification quand son équipe monte dans le classement ou quand un défi collectif est complété.
- **Design** → Pages équipe : Navy + Turquoise, typographie Bolamu, navigation `bolamu-nav.js` (desktop tabs + mobile bottom-nav), indicateurs classement conformes `design_system.md`.

---

### BOUCLE 3 — Prévention, Animateurs & Santé Connectée (Elonga)

**Résultat métier :** Animateur crée et gère les événements Elonga, valide la présence physique par QR. Google Fit alimente automatiquement les Zora via nombre de pas et métriques bien-être.

**Résultat visuel :**
- `public/animateur/dashboard.html` — création événement, liste participants, scanner QR retour vert/rouge, historique check-ins. Agent UX/UI optimise pour usage terrain (grands boutons ≥ 48px, lisible en plein air).
- `public/patient/dashboard.html` — **AUCUN CHANGEMENT VISUEL**.

**Fichiers :**
- `routes/animateur.routes.js`, `routes/elonga-events.routes.js`, `routes/wellness.routes.js`, `routes/qr.routes.js`
- `services/qrService.js`, `services/wame.service.js`, `services/googleHealthService.js`
- `public/animateur/dashboard.html`
- Tables : `elonga_events`, `elonga_registrations`, `elonga_checkin_tokens`, `event_checkin_log`, `wellness_logs`, `wellness_rules`, `google_fit_tokens`, `whatsapp_notifications`

**Agents :** Architecte Communauté · Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → Scan QR valide → `elonga_checkin_tokens` passe `'utilisé'` + `zora_ledger` crédité. Second scan même token → rejeté. 10 000 pas simulés Google Fit → `wellness_logs` + Zora attribué selon `wellness_rules`.
- **WhatsApp** → Adhérent reçoit confirmation de présence validée + montant Zora gagné.
- **Design** → Dashboard animateur : boutons larges ≥ 48px, contraste fort, scanner QR plein écran mobile, conformes `design_system.md` section animateur.

---

### BOUCLE 4 — Parcours de Soins — Cliniques, Secrétaires, Praticiens

**Résultat métier :** Secrétaire accueille le patient, valide l'adhésion, gère la file d'attente. Médecin consulte le dossier, consigne l'acte, génère une ordonnance numérique chiffrée. BHP respecté — données sensibles chiffrées au repos.

**Résultat visuel :**
- `public/secretaire/dashboard.html` — file d'attente temps réel, création dossier. Agent UX/UI optimise pour rapidité d'exécution.
- `public/medecin/dashboard.html` — historique médical, formulaire consultation, module ordonnance. Agent UX/UI optimise pour flux clinique.
- `public/patient/dashboard.html` — **AUCUN CHANGEMENT VISUEL**.

**Fichiers :**
- `routes/secretariat.routes.js`, `routes/doctor.routes.js`, `routes/appointment.routes.js`, `routes/dmn.routes.js`
- `routes/healthRecords.routes.js`, `routes/consultation-report.routes.js`, `routes/prescription.routes.js`, `routes/ai-consult.routes.js`
- `services/cryptoService.js`, `services/wame.service.js`
- `public/secretaire/dashboard.html`, `public/medecin/dashboard.html`
- Tables : `clinics`, `secretaries`, `queue_entries`, `appointments`, `health_records`, `consultation_reports`, `prescriptions`, `ai_consult_sessions`, `whatsapp_notifications`

**Agents :** Architecte Santé · Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → Arrivée patient → `queue_entries` créé → consultation → `health_records` chiffré vérifié → ordonnance générée. Accès sans droits → 403.
- **WhatsApp** → Patient reçoit confirmation RDV (heure, médecin, clinique). Après consultation, notification de compte-rendu disponible.
- **Design** → Dashboards secrétaire et médecin : couleurs de rôle conformes `design_system.md`, flux clinique linéaire optimisé, zéro rouge/orange hors alertes.

---

### BOUCLE 5 — Réseau Partenaires Santé — Pharmacies & Laboratoires

**Résultat métier :** Pharmacie reçoit et valide les ordonnances de la Boucle 4. Laboratoire injecte les résultats d'analyses sur le profil patient. Reversements financiers calculés par zone. Zéro régression pharmacie.

**Résultat visuel :**
- `public/pharmacie/dashboard.html` — **AUCUN CHANGEMENT VISUEL**. Fonctionnel uniquement.
- `public/laboratoire/dashboard.html` — interface dépôt résultats + validation. Agent UX/UI optimise pour techniciens labo selon `design_system.md`.

**Fichiers :**
- `routes/pharmacie.routes.js`, `routes/lab.routes.js`, `routes/laboratoire.routes.js`, `routes/clearing.routes.js`, `routes/partner-convention.routes.js`
- `services/billingService.js`, `services/wame.service.js`
- `public/pharmacie/dashboard.html`, `public/laboratoire/dashboard.html`
- Tables : `pharmacies`, `laboratories`, `lab_prescriptions`, `lab_results`, `partner_zones`, `partner_payouts`, `partner_conventions`, `whatsapp_notifications`

**Agents :** Architecte Santé · Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → Ordonnance traitée → `partner_payouts` crédité selon grille `partner_zones`. Résultat labo déposé → visible sur dossier patient.
- **WhatsApp** → Patient reçoit notification que ses résultats sont disponibles. Pharmacien reçoit alerte nouvelle ordonnance à traiter.
- **Design** → Playwright capture `public/pharmacie/dashboard.html` → comparaison pixel par pixel avec référence → zéro écart. Dashboard labo conforme `design_system.md` section laboratoire.

---

### BOUCLE 6 — Partenaires Récompenses & Économie Zora

**Résultat métier :** Patient convertit ses Zora en voucher commercial chez un partenaire marchand. Partenaire valide le bon. Bolamu enregistre la dette financière. Jeux, quiz, scratch fonctionnels.

**Résultat visuel :**
- Section Zora/récompenses dans `public/patient/dashboard.html` — catalogue vouchers, historique, jeux. **AUCUN CHANGEMENT AU DESIGN GLOBAL** du dashboard.
- `public/partenaire/dashboard.html` — validation rapide voucher. Agent UX/UI optimise pour usage caisse selon `design_system.md`.

**Fichiers :**
- `routes/voucher.routes.js`, `routes/partenaire.routes.js`, `routes/coupon.routes.js`, `routes/credits.routes.js`
- `services/voucherEngine.js`, `services/wame.service.js`
- `public/patient/dashboard.html`, `public/partenaire/dashboard.html`
- Tables : `zora_rewards`, `zora_vouchers`, `zora_partners`, `zora_games`, `zora_game_prizes`, `zora_game_plays`, `partner_programs`, `partner_vouchers`, `partner_validations`, `coupons`, `whatsapp_notifications`

**Agents :** Architecte Business · Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → Voucher généré → `zora_ledger` débité → partenaire valide → statut `'utilisé'` + dette enregistrée. Second scan → rejeté. Solde après = solde avant − valeur voucher.
- **WhatsApp** → Patient reçoit son voucher par WhatsApp avec code et conditions. Confirmation d'utilisation après validation partenaire.
- **Design** → Section récompenses conforme `design_system.md` : couleurs Zora (`#F5A623`), composants jeux intégrés sans rompre le design global du dashboard patient.

---

### BOUCLE 7 — RH, Entreprises & SmartFlow (BRASCO)

**Résultat métier :** Dashboard corporate affiche KPI anonymisés — absentéisme, engagement Elonga, Google Fit agrégé, ROI financier. Aucune donnée nominative. Contrats et paie gérés.

**Résultat visuel :**
- `public/rh/dashboard.html` — graphiques analytiques, KPI financiers et sanitaires, tableaux executive. Agent UX/UI optimise pour lecture rapide par un DRH selon `design_system.md` section entreprise.

**Fichiers :**
- `routes/smartflow.routes.js`, `routes/payouts.routes.js`, `routes/bank-transfer.routes.js`
- `services/metricsEngine.js`, `services/wame.service.js`
- `public/rh/dashboard.html`
- Tables : `company_contracts`, `company_employees`, `export_paie_mensuel`, `config_categories_rh`, `retenues_validees`, `doctor_payouts`, `hors_catalogue_transactions`, `whatsapp_notifications`

**Agents :** Architecte Business · Architecte Backend · Architecte Front · Agent UX/UI · QA

**Preuves de résultat :**
- **SQL** → 500 événements fictifs pour 50 employés → ROI calculé vérifié contre formule théorique au centime. `SELECT` vérifie qu'aucun `user_id` ni nom ne transite dans le payload JSON retourné.
- **WhatsApp** → RH reçoit rapport mensuel synthétique automatique avec taux d'engagement et indicateur d'absentéisme.
- **Design** → Dashboard RH : indicateurs KPI avec micro-animations, palette executive (Navy dominant), graphiques conformes `design_system.md` section entreprise.

---

## 8. MASTER LOOP — PARCOURS CROSS-BOUCLES

Après chaque boucle livrée, le Master Loop exécute le parcours complet :

1. Inscription patient (B1) → check-in événement Elonga (B3) → gain Zora
2. Gain Zora → consultation médicale (B4) → ordonnance générée
3. Ordonnance → traitement pharmacie (B5) → résultat labo déposé
4. Résultat labo → rachat voucher partenaire (B6) → dette enregistrée
5. Impact agrégé → dashboard RH (B7) → anonymisation vérifiée
6. Rapport final WhatsApp envoyé à Natsy → git push autorisé

> ⚠ **AUCUN GIT PUSH** sans validation Master Loop + WhatsApp reçu.

---

## 9. TABLEAU DE BORD — RITUEL D'OUVERTURE ET CLÔTURE

| Boucle | Ouverture (avant de coder) | Clôture (avant git push) |
|---|---|---|
| B0 Admin | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |
| B1 Fondation | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |
| B2 Communauté | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |
| B3 Elonga | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |
| B4 Soins | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |
| B5 Partenaires Santé | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |
| B6 Récompenses | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |
| B7 RH | Charger SKILL agent · Brief lot · Fichiers autorisés · Preuves définies | SQL ✓ · WhatsApp reçu ✓ · Design conforme ✓ · Playwright ✓ |

---

---

## 10. NOTES TECHNIQUES

### Socket.io — Module temps réel (B4 — juin 2026)
- `src/services/socketService.js` : `initializeSocket(server)`, `emitToRoom()`, `emitToAll()`, `getIo()`
- `src/server.js` : serveur HTTP brut (`http.createServer`) requis — `app.listen()` ne supporte pas Socket.io
- Événements actifs : `new_message` (ciblé room), `leaderboard_updated` (broadcast global)
- CORS Socket.io : `bolamu.co` uniquement en prod. Les clients Node.js (tests) ne transmettent pas d'Origin → connexion OK sans domaine whitelist

### awardZora — Performance (optimisé juin 2026)
- Optimisé de ~5 s à ~3 s (Neon DB Frankfurt, latence réseau)
- Fusion Q2-Q6 : idempotence + daily_cap + category_total + total_earned + cap_percent en **1 seule requête** (était 5 séquentielles)
- Cache `zora_tiers_config` : TTL 5 min en mémoire (`_tiersCache`). Après modification des paliers en base, prévoir **5 min de propagation** (ou redémarrer le serveur pour forcer)
- Emit `leaderboard_updated` placé immédiatement après `COMMIT` (avant chatService.postAchievement) pour minimiser la latence Socket.io
- Optimisation future possible : passer recalcul tier / postAchievement / stats en arrière-plan (`setImmediate`) pour viser <1 s si la latence Neon gêne en prod

*PILOTAGE BOLAMU v3.0 — Document confidentiel — Juin 2025*
