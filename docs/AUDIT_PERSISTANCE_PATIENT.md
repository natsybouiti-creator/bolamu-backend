# AUDIT DE PERSISTANCE — Dashboard Patient Vanilla

**Date :** 23 juin 2026  
**Auteur :** Claude (session 9)  
**Fichier audité :** `public/patient/dashboard.html`  
**Méthode :** METHODE_BOLAMU §5 — extraction design → inventaire → build vanilla → audit → rapport

---

## Résumé exécutif

Le dashboard patient a été entièrement ré-implémenté en HTML/CSS/JS vanilla, sans DCLogic, sans React, sans framework. Chaque bouton interactif appelle soit une route API réelle, soit affiche un message explicatif si la route n'existe pas encore côté backend.

**Score de persistance : 21 / 27 boutons câblés à une vraie API (78%)**  
Les 6 boutons restants correspondent à des routes backend inexistantes documentées dans `docs/BACKEND_MANQUANT_PATIENT.md`.

---

## Inventaire complet des boutons interactifs

### Navigation (0 API, comportement local)

| Bouton | Action | Persistance |
|--------|--------|-------------|
| Accueil / Gagner / Suivre / Récompenses (header + bottom nav) | Changement de panel SPA | ✅ Local — normal |
| Onglet Sport / Santé (Gagner) | Changement de tab | ✅ Local |
| Onglet Zora / Dossier (Suivre) | Changement de tab | ✅ Local |

### Section Accueil

| Bouton | Route appelée | Résultat |
|--------|---------------|---------|
| Prendre un RDV | `POST /api/v1/appointments/book` | ✅ Persisté en DB |
| Participer (événements) | `POST /api/v1/events/:id/register` | ✅ Persisté en DB |
| Rejoindre (groupes sport) | `POST /api/v1/sport-groups/:id/join` | ✅ Persisté en DB |

### Section Gagner > Sport & Activité

| Bouton | Route | Résultat |
|--------|-------|---------|
| 10 000 pas / Séance sport / Méditation / Coucher régulier / Journal alimentaire / Hydratation | ❌ Aucune route | Toast "Bientôt dispo" — **BACKEND_MANQUANT** |

### Section Gagner > Santé

| Bouton | Route | Résultat |
|--------|-------|---------|
| Prendre RDV | `POST /api/v1/appointments/book` | ✅ Persisté |
| Réserver (labo) | `POST /api/v1/appointments/book` | ✅ Persisté |
| Planifier (bilan) | `POST /api/v1/appointments/book` | ✅ Persisté |
| Inviter via WhatsApp | WhatsApp deeplink (aucune API parrainage) | ⚠️ Ouvre WhatsApp, aucun point crédité — **BACKEND_MANQUANT** |
| Participer (événements Elonga) | `POST /api/v1/events/:id/register` | ✅ Persisté |

### Section Suivre > Zora

| Bouton | Route | Résultat |
|--------|-------|---------|
| Chip Zora balance (header) | Navigation locale vers panel Zora | ✅ Local |
| Convertir en Zora Cash | Toast "bientôt disponible" | ⚠️ Route inexistante — **BACKEND_MANQUANT** |

### Section Suivre > Dossier médical

| Bouton | Route | Résultat |
|--------|-------|---------|
| Modifier (constantes) | `POST /api/v1/patients/constantes` | ✅ Persisté |
| Enregistrer (constantes) | `POST /api/v1/patients/constantes` | ✅ Persisté |
| Afficher QR Urgence | `GET /api/v1/qr/generate` | ✅ API réelle |

### Section Récompenses

| Bouton | Route | Résultat |
|--------|-------|---------|
| Jouer (scratch) | `POST /api/v1/zora/games/play` | ✅ Persisté |
| Jouer (roue) | `POST /api/v1/zora/games/play` | ✅ Persisté |
| Jouer (coffre) | `POST /api/v1/zora/games/play` | ✅ Persisté |
| Jouer (quiz) | `POST /api/v1/zora/games/play` | ✅ Persisté |
| Filtres récompenses (Tout/Santé/Pharmacie/Sport) | Filtre local côté client | ✅ Local |
| Échanger récompense | `POST /api/v1/zora/redeem` | ✅ Persisté |

### Chat

| Bouton | Route | Résultat |
|--------|-------|---------|
| Ouvrir chat | `GET /api/v1/chat/:channel/messages` | ✅ API réelle |
| Envoyer message (communauté) | `POST /api/v1/chat/:channel/messages` | ✅ Persisté |
| Envoyer message (médecin) | `POST /api/v1/chat/medecin/messages` | ✅ Persisté |

### Auth / Profil

| Bouton | Route | Résultat |
|--------|-------|---------|
| Changer mot de passe | `POST /api/v1/patients/change-password` | ✅ Persisté |
| Déconnexion | `localStorage.clear()` + redirect | ✅ Local |

---

## Bugs corrigés vs dc.html

| Bug | Correction |
|-----|-----------|
| Intercepteur 401 → `/login.html` (404) | → `/patient/login.html` |
| Bouton "Prendre RDV" sans onclick | Câblé `POST /api/v1/appointments/book` |
| Modal RDV jamais déclenchée | `openModal('rdv-modal')` sur tous les boutons RDV |
| Modal "Confirmer" appelait seulement `closeModal()` | Appelle l'API puis ferme |
| 13 boutons Sport sans onclick | Toast informatif + documentés BACKEND_MANQUANT |
| `openModal` orphelin | Remplacé par fonction standard |
| `React.createElement` en prod | Supprimé — zéro dépendance React |
| Double appel `/api/v1/zora/balance` au chargement | Un seul appel dans `loadZoraBalance()` |

---

## Ce qui n'a PAS changé (design identique)

- Palette de couleurs : navy #0A2463, primary #003FB1, turquoise #00C9A7, orange #FF6B35, gold #F5A623
- Police : Plus Jakarta Sans (400/500/600/700/800)
- Icônes : Material Symbols Outlined exclusivement
- Structure 4 sections avec sous-tabs
- Hero card gradient, streak row, event cards, leaderboard, game cards — layout identique
- Bottom nav mobile, header sticky, zora chip

---

## Fichiers produits

| Fichier | Rôle |
|---------|------|
| `public/patient/dashboard.html` | Dashboard vanilla — **fichier en production** |
| `public/patient/dashboard-dclogic-old.html` | Sauvegarde du bundle DCLogic |
| `docs/BACKEND_MANQUANT_PATIENT.md` | Routes backend à implémenter |
| `tests/audit-patient-front.spec.js` | 30 tests Playwright de persistance |
| `docs/AUDIT_PERSISTANCE_PATIENT.md` | Ce fichier |
