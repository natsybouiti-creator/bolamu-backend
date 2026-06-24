# DIAGNOSTIC — public/patient/dashboard.html
**Date :** 23 juin 2026  
**Statut prod :** boutons majoritairement inactifs, réservation RDV impossible  
**Auteur :** Claude (architecte) — lecture seule, aucune modification

---

## TL;DR — Causes racines

| # | Gravité | Cause | Impact |
|---|---------|-------|--------|
| 1 | **BLOQUANT** | Fichier servi est un `.dc.html` DCLogic (maquette, pas bâtiment) | Tous les handlers `{{ ... }}` dépendent d'un runtime propriétaire |
| 2 | **BLOQUANT** | Bouton "Prendre RDV" sans `onclick` | Impossible de réserver un RDV |
| 3 | **BLOQUANT** | `openModal` défini mais jamais appelé par un bouton | La modal RDV est inaccessible |
| 4 | **BLOQUANT** | Modal RDV n'appelle pas `/api/v1/appointments` | Même si la modal s'ouvrait, aucune réservation ne serait créée |
| 5 | **CRITIQUE** | 13+ boutons "En cours / Démarrer / Suivre / Planifier" sans `onclick` | Section Gagner entièrement fantôme |
| 6 | **MOYEN** | Intercepteur 401 redirige vers `/login.html` | Devrait être `/patient/login.html` |

---

## 1. Architecture — C'est bien le `.dc.html` servi en prod

**Preuves :**
- Ligne 1 : `window.__resources = {"ZoraCoin": "assets/...", "EventCard": "assets/...", ...}` — registre de composants Claude Design
- Ligne 60 : `<x-dc>` / Ligne 1916 : `</x-dc>` — balise propriétaire DCLogic
- Ligne 1917 : `<script type="text/x-dc" data-dc-script="">class Component extends DCLogic {...}` — composant DCLogic
- Lignes 26-43 : Intercepteur fetch pour résoudre les imports de composants enfants (ZoraCoin, EventCard, etc.)
- Ligne 57 : `<script src="assets/4596b80e-dcef-4966-bfd6-5e637c70565b.js">` — runtime DCLogic

METHODE_BOLAMU.md §5 nomme exactement ce cas : **"La faute à ne pas refaire. Le dashboard patient a été servi directement depuis le bundle `.dc.html` (DCLogic)."**

Le dossier `public/patient/assets/` existe (31 fichiers). Le runtime DCLogic se charge **probablement**. Les boutons qui ont des handlers `{{ ... }}` fonctionnent donc — **mais seulement ceux qui ont un handler**.

---

## 2. Le bouton "Prendre RDV" — diagnostic précis

### 2a. Boutons dans la section Gagner > Santé

**Ligne 1372 :**
```html
<button style="background: #003FB1; ...">Prendre RDV</button>
```
→ **Aucun `onclick`. Bouton fantôme.** Cliquer dessus ne fait rien.

**Ligne 1384 :**
```html
<button style="background: #003FB1; ...">Réserver</button>
```
→ **Aucun `onclick`. Bouton fantôme.**

### 2b. La modal RDV existe mais est inaccessible

Il existe une modal RDV complète (lignes 1758-1774) avec un formulaire (médecin, date, créneau, motif). Elle est contrôlée par `openModal` / `closeModal`.

`openModal` est défini dans `renderVals()` ligne 2887 :
```javascript
openModal: () => this.setState({ modal: true }),
```

**Mais `grep openModal` dans tout le fichier → 1 seul résultat : la définition elle-même.**  
Aucun bouton dans le HTML n'appelle `{{ openModal }}`. La modal RDV n'a pas de déclencheur.

### 2c. La modal RDV n'appelle pas l'API appointments

**`grep appointments` dans tout le fichier → 0 résultat.**

Le bouton "Confirmer" de la modal (ligne 1772) :
```html
<button onclick="{{ closeModal }}" style="...">Confirmer</button>
```
Il appelle `closeModal()` — ferme la modal. **Aucun `POST /api/v1/appointments` n'est jamais émis.**

---

## 3. Inventaire complet des boutons morts (sans handler)

### Section Gagner > Sport & Activité

| Ligne | Label | onclick | Endpoint attendu |
|-------|-------|---------|-----------------|
| 1202 | "En cours" (10 000 pas) | **AUCUN** | — |
| 1214 | "Démarrer" (séance sport 30min) | **AUCUN** | — |
| 1226 | "Commencer" (méditation/respiration) | **AUCUN** | — |
| 1238 | "Démarrer" (atelier respiration) | **AUCUN** | — |
| 1255 | "Suivre mon sommeil" | **AUCUN** | — |
| 1267 | "Activer" (coucher régulier 5j) | **AUCUN** | — |
| 1284 | "Remplir" (journal alimentaire) | **AUCUN** | — |
| 1296 | "Suivre" (hydratation 6 verres) | **AUCUN** | — |
| 1308 | "M'inscrire" (atelier nutrition Elonga) | **AUCUN** | — |

### Section Gagner > Santé ← **ZONE CRITIQUE**

| Ligne | Label | onclick | Endpoint attendu |
|-------|-------|---------|-----------------|
| 1372 | **"Prendre RDV"** (consultation médicale) | **AUCUN** | `POST /api/v1/appointments` |
| 1384 | "Réserver" (analyse laboratoire) | **AUCUN** | `POST /api/v1/appointments` |
| 1396 | "Planifier" (bilan annuel) | **AUCUN** | `POST /api/v1/appointments` |
| 1408 | "Inviter via WhatsApp" | **AUCUN** | `POST /api/v1/patients/invite` |

### Autres sections

| Ligne | Label | onclick | Remarque |
|-------|-------|---------|---------|
| 1157 | "Voir tout · Encourager" (classement) | **AUCUN** | Bouton décoratif |
| 1734 | "12" (like), "Commenter" | **AUCUN** | Chat communauté |
| 1740 | "38" (like), "Suivre" | **AUCUN** | Chat communauté |
| 1826 | "Télécharger le PDF" (résultats labo modal) | **AUCUN** | Aucune route PDF |

---

## 4. Boutons fonctionnels (handlers DCLogic présents)

Ces boutons ont un handler `{{ ... }}` et appellent une vraie API :

| Bouton | Handler | Endpoint réel |
|--------|---------|--------------|
| Nav Accueil / Gagner / Suivre / Récompenses | `{{ goAccueil }}` etc. | Navigation SPA — pas d'API |
| Chat (ouvrir/fermer) | `{{ openChat }}` / `{{ closeChat }}` | — |
| Profil (ouvrir/fermer) | `{{ openProfile }}` | — |
| "Participer" (événements) | `{{ ev.participate }}` | `POST /api/v1/events/{id}/register` ✅ |
| Jeux Zora (Jouer) | `{{ g.onPlay }}` | `POST /api/v1/zora/games/play` ✅ |
| Tourner la roue | `{{ spinWheel }}` | `POST /api/v1/zora/games/play` ✅ |
| Coffre (ouvrir) | `{{ c.onOpen }}` | `POST /api/v1/zora/games/play` ✅ |
| Quiz (répondre) | `{{ a.onPick }}` | `POST /api/v1/zora/games/play` ✅ |
| Constantes "Modifier" | `{{ openEditConst }}` | Ouvre modal |
| Constantes "Enregistrer" | `{{ saveConst }}` | `POST /api/v1/patients/constantes` ✅ |
| QR Urgence "Générer" | `{{ openQrUrg }}` | QR hardcodé (pas d'API) |
| Résultats labo "Voir" | `{{ openLabRes }}` | Données hardcodées (pas d'API) |
| Filtres réseau Tout/Cliniques/Pharmacies/Labos | `{{ filterTout }}` etc. | Filtre local — pas d'API |

---

## 5. Auth & Token

**Token lu correctement** (ligne 1937) :
```javascript
const token = localStorage.getItem('bolamu_patient_token');
```
Clé `bolamu_patient_token` — conforme à AGENTS.md.

**Intercepteur 401 — mauvaise URL de redirection** (lignes 45-56) :
```javascript
if (res.status === 401) { localStorage.clear(); window.location.href = '/login.html'; }
```
Redirige vers `/login.html`. La vraie page est `/patient/login.html`. Si le token est expiré, le patient atterrit sur une 404.

**Appels API au chargement :**

| Endpoint | Méthode | Route backend existante |
|----------|---------|------------------------|
| `/api/v1/patients/profil?phone=` | GET | ✅ |
| `/api/v1/zora/balance` | GET | ✅ |
| `/api/v1/streaks/me` | GET | ✅ |
| `/api/v1/events` | GET | ✅ |
| `/api/v1/leaderboard/weekly` | GET | ✅ |
| `/api/v1/zora/balance?phone=` | GET | ✅ (double appel) |
| `/api/v1/sport-groups` | GET | ✅ |
| `/api/v1/zora/ledger?limit=10` | GET | ✅ |
| `/api/v1/patients/subscription?phone=` | GET | ✅ |
| `/api/v1/patients/constantes/{phone}` | GET | ✅ |
| `/api/v1/reports/patient/{phone}/timeline` | GET | ✅ |
| `/api/v1/reports/access-log/{phone}` | GET | ✅ (consultation-report.routes.js) |
| `/api/v1/zora/games/config` | GET | ✅ |
| `/api/v1/qr/generate` | GET | ✅ |

Tous les appels de chargement pointent vers de vraies routes. Si un appel renvoie 401, l'intercepteur déclenche la redirection vers la mauvaise URL.

---

## 6. Runtime DCLogic — `React.createElement` en production

Lignes 2729, 2870-2871 :
```javascript
imgEl: React.createElement('div', {...}),
logoLg: React.createElement('img', {...}),
logoSm: React.createElement('img', {...})
```
Le runtime DCLogic utilise React en interne. Si React n'est pas exposé sur `window.React`, ces appels lèvent une erreur fatale qui casse le rendu de tous les éléments dépendants (bande récompenses, logos).

---

## 7. Conclusion

### Pourquoi "tous les boutons semblent morts"

1. **Le runtime DCLogic charge** (assets présents, 31 fichiers). Les boutons avec `{{ ... }}` qui ont un handler **fonctionnent** : navigation, jeux, constantes, événements.

2. **La cause réelle du "RDV impossible"** est double :
   - Le bouton "Prendre RDV" (ligne 1372) **n'a pas de `onclick`** — c'est un bouton purement décoratif issu de la maquette Claude Design jamais câblé.
   - `openModal` est défini mais **aucun bouton ne l'appelle**.
   - Même si la modal s'ouvrait, le bouton "Confirmer" appelle `closeModal()` — **aucune requête API n'est émise**.

3. **Toute la section Gagner** (Sport + Santé) est un squelette visuel : les boutons d'action (Démarrer, Prendre RDV, Réserver, Planifier, etc.) sont des éléments HTML statiques sans handler, issus de la maquette et jamais câblés.

### Ce que ça n'est PAS

- Pas une erreur de syntaxe JS bloquante globale (le fichier parse correctement).
- Pas un problème de token (le token est lu correctement, les API de chargement sont appelées).
- Pas un problème de route backend manquante pour les appels de chargement.

### Ce qu'il faut faire

Conformément à METHODE_BOLAMU.md §5 : **ré-implémenter le dashboard patient en HTML/CSS/JS vanilla** contre le contrat API (`docs/ENDPOINTS.md`). Le `.dc.html` est l'esquisse, pas le bâtiment. Le câblage (y compris `POST /api/v1/appointments` pour la réservation RDV) doit être fait dans le vanilla réimplémenté.

En urgence pour débloquer le RDV sans réécriture complète : ajouter `onclick="{{ openModal }}"` sur le bouton "Prendre RDV" (ligne 1372), puis remplacer `{{ closeModal }}` par un handler qui appelle `POST /api/v1/appointments` dans la modal. Ce n'est qu'un correctif partiel — la section Gagner restera non fonctionnelle.
