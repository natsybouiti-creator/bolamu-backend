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

## BUGS CORRIGÉS (HISTORIQUE)

*(Aucun bug corrigé dans cette session)*

---

## STATISTIQUES

- **Total bugs :** 6
- **Critiques :** 2
- **Moyens :** 3
- **Mineurs :** 1
- **Corrigés :** 0
- **Ouverts :** 6

---

*Document généré automatiquement suite aux tests Playwright*
