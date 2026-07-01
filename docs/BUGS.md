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

## BUGS CORRIGÉS (HISTORIQUE)

*(Aucun bug corrigé dans cette session)*

---

## STATISTIQUES

- **Total bugs :** 7
- **Critiques :** 2
- **Moyens :** 4
- **Mineurs :** 1
- **Corrigés :** 0
- **Ouverts :** 7

---

*Document généré automatiquement suite aux tests Playwright*
