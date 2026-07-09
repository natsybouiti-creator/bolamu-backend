# BUGS - BOLAMU BACKEND

**Dernière mise à jour :** 21 juin 2026

---

## BUGS CRITIQUES (BLOQUANTS)

### BUG-001: Authentification API - Login ne fonctionne pas
**Sévérité :** 🔴 CRITIQUE
**Module :** Authentification
**Description :** L'endpoint `/api/v1/auth/login` ne retourne pas de token valide pour le compte de test (+242069735418 / TestNouveau2026!)
**Impact :** Empêche tous les tests UI nécessitant une authentification
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 21 juin 2026
**Recommandation :** Vérifier que le compte de test existe dans la base de données et que le mot de passe est correctement hashé. Vérifier également que l'endpoint login est accessible et fonctionne.

---

### BUG-002: Navigation par selectors textuels non fonctionnelle
**Sévérité :** 🔴 CRITIQUE
**Module :** Frontend - Dashboard Patient
**Description :** Les selectors `button:has-text("Gagner")`, `button:has-text("Suivre")`, `button:has-text("Récompenses")` ne trouvent pas les éléments
**Impact :** Empêche la navigation entre les onglets du dashboard
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 21 juin 2026
**Recommandation :** Les boutons de navigation utilisent probablement des icônes Material Symbols sans texte visible. Utiliser des selectors basés sur les icônes ou des data-attributes spécifiques.

---

### BUG-003: Bottom nav non visible en mobile
**Sévérité :** 🟠 MOYEN
**Module :** Frontend - Dashboard Patient
**Description :** La classe `.bottom-nav` n'est pas visible lorsque la viewport est réduite à 375px
**Impact :** Navigation mobile non fonctionnelle
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 21 juin 2026
**Recommandation :** Vérifier le CSS media query dans dashboard-v3-design.html (ligne 954-958). La règle `.bottom-nav { display: none !important; }` devrait être inversée en mobile.

---

### BUG-004: Gestion token invalide non gracieuse
**Sévérité :** 🟠 MOYEN
**Module :** Frontend - Dashboard Patient
**Description :** Lorsqu'un token invalide est injecté dans localStorage, la page ne redirige pas vers login et n'affiche pas de message d'erreur
**Impact :** Mauvaise UX en cas de session expirée
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 21 juin 2026
**Recommandation :** Ajouter une vérification du token au chargement de la page et rediriger vers login si invalide.

---

### BUG-005: Bouton profil non trouvé
**Sévérité :** 🟠 MOYEN
**Module :** Frontend - Dashboard Patient
**Description :** Le bouton profil avec initiales "AN" n'est pas trouvé via selector textuel
**Impact :** Empêche l'accès à la page profil
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 21 juin 2026
**Recommandation :** Vérifier que les initiales sont correctement affichées et utiliser un selector plus robuste (data-attribute ou classe spécifique).

---

## BUGS MINEURS (NON BLOQUANTS)

### BUG-006: Icône chat non trouvée
**Sévérité :** 🟡 FAIBLE
**Module :** Frontend - Dashboard Patient
**Description :** L'icône forum pour ouvrir le drawer chat n'est pas trouvée
**Impact :** Fonctionnalité chat non testable
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 21 juin 2026
**Recommandation :** Vérifier que l'icône Material Symbols `forum` est présente et visible.

---

### BUG-007: Subscriptions multiples actives pour un même patient
**Sévérité :** 🟠 MOYEN
**Module :** Backend - Subscriptions
**Description :** Les runs de test empilent des subscriptions actives sans désactiver les précédentes. Le patient +242069735418 a 3 subscriptions 'active' simultanées.
**Impact :** Incohérence de données - un patient ne devrait avoir qu'UNE subscription active
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 30 juin 2026
**Recommandation :** La création de subscription devrait désactiver l'ancienne (UPDATE subscriptions SET status = 'inactive' WHERE patient_phone = $1 AND status = 'active') avant d'insérer la nouvelle.

---

### BUG-008: handlePaymentSuccess n'écrit pas historique_abonnements pour upgrades
**Sévérité :** 🟠 MOYEN
**Module :** Backend - Paiements
**Description :** Lorsqu'un paiement upgrade est confirmé via webhook MoMo/Airtel, handlePaymentSuccess crée un nouvel abonnement mais n'écrit pas dans historique_abonnements. L'historique des upgrades est donc incomplet.
**Impact :** Historique d'audit manquant pour les upgrades payants
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 1 juillet 2026
**Recommandation :** Ajouter un flag is_upgrade dans la table payments lors de l'initiation, et faire écrire historique_abonnements dans handlePaymentSuccess si is_upgrade=true. À traiter après B1.

---

### BUG-009: Bouton notification animateur cassé
**Sévérité :** 🔴 CRITIQUE
**Module :** Frontend - Dashboard Animateur
**Description :** Les fonctions sendNotification() et sendClubNotif() envoient {message} mais le backend attend {message_type, params}. Le handler retourne 400 systématiquement. Les animateurs ne peuvent notifier aucun club.
**Impact :** Fonctionnalité critique inutilisable — les animateurs ne peuvent envoyer de messages WhatsApp à leurs clubs
**Statut :** ✅ CORRIGÉ (1 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 1 juillet 2026
**Recommandation :** Corrigé — les fonctions frontend envoient maintenant {message_type: 'bolamu_club_message', params: [nom_club, message]}.

---

### BUG-010: Comptage notification animateur non fiable
**Sévérité :** 🟠 HIGH
**Module :** Backend - Animateur Service
**Description :** notifyClub (animateur.service.js) incrémentait sentCount même quand l'envoi WhatsApp échouait. sendAutoMessage (whatsapp-web.service.js) retourne false en cas d'échec mais la valeur de retour n'était jamais vérifiée. Le try/catch de notifyClub ne pouvait jamais s'exécuter puisque sendAutoMessage ne throw jamais. Résultat : sent_count=1, failed_count=0 même avec un numéro fictif, signal trompeur pour l'animateur.
**Impact :** Un animateur pouvait croire avoir notifié son club alors que rien n'était parti. Comptage non fiable des notifications.
**Statut :** ✅ CORRIGÉ (1 juillet 2026)
**Assigné à :** Cascade
**Date découverte :** 1 juillet 2026
**Recommandation :** Corrigé — notifyClub vérifie maintenant explicitement le retour booléen de sendAutoMessage (const ok = await sendAutoMessage(...); if (ok) sentCount++; else { failedCount++; logger.warn(...) }). En même temps, le format de réponse du controller a été corrigé pour respecter le standard {success, data}. Fichiers modifiés : src/services/animateur.service.js + src/controllers/animateur.controller.js.

---

### BUG-011: Test S27 envoie un format incompatible à /zora/earn
**Sévérité :** 🟠 MOYEN
**Module :** Tests E2E - S27
**Description :** Le test appelle POST /zora/earn avec { phone, points, reason } mais la route exige { phone, action_type, proof_class, proof_reference } (voir src/routes/zora.routes.js). La requête échoue donc systématiquement en 400, et expect(zoraEarnRes.success).toBe(true) devrait faire échouer le test à cette étape -- à vérifier si c'était bien le cas en B1 ou si un autre mécanisme masquait l'échec.
**Impact :** Test S27 non fonctionnel - l'étape 4 (crédit Zora manuel) échoue systématiquement
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 1 juillet 2026
**Recommandation :** Corriger le test avec les vrais action_type/proof_class valides (consulter src/services/zora.service.js pour la liste des action_type acceptés par awardZora avant de choisir des valeurs). Traité en B2, pas dans ce chantier harnais.

---

### BUG-012: zora_rewards / zora_partners ne peuvent pas être purgées sans casser 2 dépendances vivantes
**Sévérité :** 🟡 DETTE TECHNIQUE (rien n'est cassé aujourd'hui, mais bloque une purge prévue)
**Module :** Backend - Système bon Zora / Clearing admin
**Description :** `zora_rewards` et `zora_partners` sont les tables d'un ancien système (`zora_vouchers`) remplacé par `partner_bons_zora`. La plupart des fichiers qui les référencent sont morts (voir GET /partenaire/stats et /partenaire/validations, neutralisés en 410 Gone — commit `9322e5c`), mais **2 dépendances vivantes bloquent un `DROP TABLE`** :
1. `src/routes/clearing.routes.js:487` — `GET /clearing/bons-zora/pending` (montée sur `/api/v1/clearing`, `server.js:203`), **réellement appelée par `public/admin/dashboard.html:2224,2252,2264`** pour la gestion des règlements/virements aux partenaires bon Zora (`LEFT JOIN zora_partners zp ON zp.phone = bzr.partner_phone` pour afficher `partner_name`). Un `DROP TABLE zora_partners` casserait cette route immédiatement (`relation does not exist`), même en `LEFT JOIN`.
2. `src/jobs/abonnement.job.js:212-242` — étape 7 du cron `jobAbonnement` (démarré sans condition dans `server.js:360`, donc actif en prod), rappel WhatsApp "voucher expire dans 48h" sur `zora_vouchers`/`zora_rewards`/`zora_partners`. Encapsulée dans un `try/catch` local — ne ferait pas planter le job, mais générerait une erreur silencieuse à chaque exécution.
**Impact :** Aucun aujourd'hui (les tables existent encore). Bloque la purge prévue de `zora_rewards`/`zora_partners` tant que ces 2 points ne sont pas traités.
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 9 juillet 2026
**Recommandation :** Avant de purger : (1) réécrire `clearing.routes.js:487` pour sourcer `partner_name` depuis `users` (le compte pharmacie/doctor/laboratoire réel, via `bzr.partner_phone`) au lieu de `zora_partners` ; (2) retirer ou réécrire l'étape 7 de `abonnement.job.js` (le système `zora_vouchers` qu'elle sert n'a jamais été mis en production, cf. BUG neutralisation partenaire.routes.js). Une fois ces deux points corrigés et testés, `DROP TABLE zora_rewards, zora_partners` peut s'exécuter sans risque, avec suppression de `zora-marketplace.service.js`, `zora-voucher.service.js` et `partenaire.controller.js` (déjà morts, plus aucune route ne les importe).

---

### BUG-013: dossier-qr retiré temporairement — flux DMN scan/vérification jamais spécifié
**Sévérité :** 🟡 DETTE TECHNIQUE / DONNÉES DE SANTÉ (retiré préventivement, rien n'était exposé, mais aucun flux fiable n'existe pour le remplacer)
**Module :** Frontend - Dashboard Patient / DMN (BHP v1.2)
**Description :** `public/patient/dashboard.html:899` contenait un `<div id="dossier-qr">` statique dans la "carte membre" (panel Suivre → Dossier médical), jamais peuplé par aucune fonction JS (`A.renderQR()` existe et fonctionne pour 6 autres QR, mais n'était jamais appelée avec cet id). Retiré (commit à venir) plutôt que branché sur un flux mal défini, vu la sensibilité des données de santé en jeu.
Audit des 3 mécanismes QR existants avant décision — aucun n'est un match sûr :
1. **QR identification** (`hero-qr` / `GET /qr/generate` + `GET,POST /qr/verify`) — fonctionnel, mais n'expose aucune donnée de santé (identité, statut abonnement, convention).
2. **QR urgence** (`urg-qr` / `GET /qr/emergency/generate` + `GET /qr/urgence`) — fonctionnel, expose allergies/groupe sanguin/traitements, scan **public sans authentification** (conçu pour une urgence réelle), notifie le contact d'urgence à chaque scan.
3. **QR DMN** (`dmn-qr-med`, bouton "Générer mon QR médical", `GET /api/v1/dmn/qr-payload`) — **génère un JWT signé (type `dmn_qr`) mais aucune route ne le vérifie jamais**. `grep` exhaustif de `dmn_qr`/`QR_TOKEN_TYPE` dans tout le repo : 0 route de vérification. L'`acces_url` embarquée dans le payload (`https://bolamu.co/patient/dossier?qr=1&p=...`) pointe vers une page qui n'existe pas (ni fichier statique, ni route serveur). **Ce QR, déjà en production, ne peut être scanné-et-exploité par personne aujourd'hui.**
Découverte associée : **`dmn_access_log` et `dossier_access_log` sont deux tables de traçabilité d'accès au dossier distinctes, jamais réconciliées** (`dmn.service.js` écrit dans la première, `consultation-report.controller.js:logDossierAccess` — utilisée par le flux urgence — écrit dans la seconde). Même pattern de duplication que le classement Zora et les vouchers déjà documentés (BUG-012).
**Impact :** Aucune régression (l'élément retiré n'a jamais fonctionné). Fonctionnalité "accès dossier via QR" absente de la carte membre en attendant une vraie spécification.
**Statut :** 🔴 OUVERT
**Assigné à :** À assigner
**Date découverte :** 9 juillet 2026
**Recommandation :** Avant de réintroduire un QR "accès dossier" sur la carte membre, trancher côté produit : qui peut scanner (professionnel authentifié uniquement, ou public comme le QR urgence ?), quel consentement BHP est requis pour l'accès aux `health_records`, quelles données exactes sont exposées. Une fois la route de vérification correspondante conçue et implémentée (avec contrôle de consentement conforme BHP v1.2), réconcilier `dmn_access_log`/`dossier_access_log` en une seule table de traçabilité, puis brancher `dmn-qr-med` (déjà en prod mais non fonctionnel côté scan) sur cette même route.

---

## BUGS CORRIGÉS (HISTORIQUE)

*(Aucun bug corrigé dans cette session)*

---

## STATISTIQUES

- **Total bugs :** 9
- **Critiques :** 2
- **Moyens :** 4
- **Mineurs :** 1
- **Dette technique :** 2
- **Corrigés :** 0
- **Ouverts :** 9

---

*Document généré automatiquement suite aux tests Playwright*
