# Changelog - Bolamu Backend

## 20 juillet 2026

### dashboard-v2.html — Audit profond + corrections prioritaires

**Fichier :** `public/medecin/dashboard-v2.html`  
**Commits :** `52088d2`, `777543f`

#### Corrections livrées

**A) Chat — Intégration bolamu-chat-window**
- Ajout de `/css/bolamu-chat-window.css` dans `<head>`
- Ajout de `/js/bolamu-chat-window.js` dans `<head>`
- Placés après socket.io comme dans dashboard.html production

**B) Profil — Modal édition + upload photo**
- Bouton "Modifier le Profil" avec onclick fonctionnel
- Modal d'édition avec tous les champs : nom, spécialité, ville, quartier, téléphone cabinet, bio
- Upload photo via `POST /api/v1/doctors/photo` (Cloudinary)
- Sauvegarde via `PATCH /api/v1/doctors/profil`
- Rechargement automatique du profil après mise à jour

**C) Offres — Modal création**
- Bouton "Créer une offre" dans renderOffres()
- Modal de création avec tous les champs requis : nom, description, coût Zora, valeur FCFA, catégorie, stock, image
- Upload image via Cloudinary (multer)
- Création via `POST /api/v1/bons-zora/programs`
- Rechargement automatique de la liste après création

**E) Format dates — Fonctions utilitaires + application**
- Ajout de `formatDate()` (format JJ/MM/AAAA)
- Ajout de `formatHeure()` (format HH:MM)
- Application dans `renderRDVs()` (date + heure)
- Application dans `renderAccueil()` (heure)
- Application dans `renderPatients()` (date)

#### Bugs trouvés et corrigés post-livraison

**Bug #1 — apiFetch() cassait FormData**
- **Problème :** apiFetch() forçait `Content-Type: application/json` même sur FormData, ce qui cassait l'upload photo et la création d'offre (le navigateur ne pouvait pas générer le boundary automatiquement)
- **Correction :** Content-Type conditionnel — ne pas fixer quand `options.body instanceof FormData`
- **Impact :** Upload photo profil et création d'offre avec image fonctionnent maintenant

**Bug #2 — loadDoctorProfile() appelée mais jamais définie**
- **Problème :** saveProfil() appelait loadDoctorProfile() mais cette fonction n'existait pas
- **Correction :** Extraction de loadDoctorProfile() depuis le bloc try/catch inline dans window.onload
- **Impact :** Rechargement du profil après mise à jour fonctionne maintenant

#### Reporté — Non traité

**D) Feed — Fonctionnalités sociales**
- **Statut :** Reporté, non traité
- **Raison :** Architecture sociale (`ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md`) se concentre sur Événements, Clubs, Chat et ne mentionne pas le feed comme fonctionnalité canonique pour le dashboard médecin. L'implémentation actuelle est incomplète (sans likes, commentaires, stories, etc.) et nécessiterait ~200 lignes de code (objet A depuis dashboard.html production) pour une fonctionnalité non prioritaire selon l'architecture.
- **Note :** Si ce chantier est repris, relire `ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` avec citation exacte pour justifier la priorité ou non du feed.

---

## Point en suspens (séparé, non urgent)

**20 fichiers (configs test/eslint/jest/playwright + scripts extract-v3-*, diagnose-auth.js, etc.)**
- Apparaissent supprimés dans le working directory sans commit correspondant
- Origine inconnue (ni Cascade ni commande identifiée dans cette session)
- Non stagés, sans risque immédiat
- À investiguer par Natsy quand le temps le permet
- Ne pas stager ni committer sans clarification préalable de leur origine
