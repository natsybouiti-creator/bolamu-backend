# Score Bolamu — Documentation technique

> Source vérifiée : `src/services/scoreBolamu.service.js`, `src/routes/patient.routes.js`,
> `public/patient/dashboard.html` · Mise à jour : 2026-07-04

---

## 1. Vue d'ensemble

Le Score Bolamu est un indicateur de bien-être et d'engagement patient calculé sur une
échelle de **0 à 100**. Il agrège 5 composantes pondérées reflétant l'activité réelle du
patient sur la plateforme (RDV, événements Elonga, clubs, Zora, consultations).

### Pourquoi il remplace le widget compteur de pas

Introduit par le commit `3eb9b28 feat(dashboard): score bolamu remplace widget releve de pas`,
le Score Bolamu remplace l'emplacement occupé par un widget de relevé de pas dans le
dashboard patient. Le compteur de pas ne reposait sur aucune source de données temps réel
(intégration wearables non encore activée) et renvoyait une valeur statique. Le Score
Bolamu utilise à la place des données déjà disponibles en base (RDV, Zora, clubs,
événements, consultations) pour produire un indicateur actionnable et mis à jour à chaque
chargement du dashboard.

---

## 2. Logique backend

### Fichier source

```
src/services/scoreBolamu.service.js
```

### Import — bug résolu (commit 2fb6d31, 2026-07-02)

L'import initial de `normalizePhone` pointait vers un chemin inexistant :

```js
// ❌ Avant — crash au démarrage du service
const { normalizePhone } = require('../utils/phone.utils');

// ✅ Après — chemin correct
const { normalizePhone } = require('../utils/phone');
```

Commit : `2fb6d31 fix(scoreBolamu): correction import normalizePhone - utils/phone au lieu de phone.utils`

### Formule de calcul (score global pondéré)

```js
// src/services/scoreBolamu.service.js — lignes 166-172
const score = Math.round(
  (rdvScore        * 0.30) +   // Assiduité RDV        30 %
  (elongaScore     * 0.25) +   // Engagement Elonga    25 %
  (clubScore       * 0.20) +   // Activité club        20 %
  (zoraScore       * 0.15) +   // Régularité Zora      15 %
  (consultationScore * 0.10)   // Suivi médical        10 %
);
```

### Composantes détaillées

| Composante | Poids | Fenêtre courante | Plafond | Calcul brut |
|---|---|---|---|---|
| Assiduité RDV | 30 % | 90 jours glissants | non plafonné | `completed / (pending + confirmed + in_progress) * 100` |
| Engagement Elonga | 25 % | 90 jours glissants | 5 événements | `min(attended / 5, 1) * 100` — filtre `e.pillar = 'activite'` uniquement |
| Activité club | 20 % | 30 jours glissants | 3 clubs actifs | `min(active_memberships / 3, 1) * 100` |
| Régularité Zora | 15 % | 30 jours glissants | 10 transactions | `min(transaction_count / 10, 1) * 100` — nombre de lignes, pas montant |
| Suivi médical | 10 % | 6 mois glissants | 2 consultations | `min(consultation_count / 2, 1) * 100` |

### Calcul de tendance

Chaque composante est recalculée sur la **période précédente** (même durée, décalée dans le
temps) et le score global précédent est comparé au score courant :

```js
// src/services/scoreBolamu.service.js — lignes 184-186
let tendance = 'stable';
if (score > scorePrev + 5) tendance = 'up';
else if (score < scorePrev - 5) tendance = 'down';
```

Seuil : ±5 points. En dessous de ce seuil, la tendance reste `stable`.

| Fenêtre courante | Fenêtre précédente |
|---|---|
| 0 → 90 j | 90 → 180 j |
| 0 → 30 j | 30 → 60 j |
| 0 → 6 mois | 6 → 12 mois |

### Labels selon score

```js
// src/services/scoreBolamu.service.js — lignes 189-194
if (score >= 80) label = 'Excellent';
else if (score >= 60) label = 'Très bon';
else if (score >= 40) label = 'Bon';
else if (score >= 20) label = 'En progression';
else label = 'À démarrer';
```

### Endpoint API

**Route** : `GET /api/v1/patients/score-bienetre`  
**Fichier** : `src/routes/patient.routes.js` ligne 164  
**Middleware** : `authMiddleware` (token patient requis)  
**Service appelé** : `calculerScoreBolamu(req.user.phone)`

Payload de réponse :

```json
{
  "success": true,
  "data": {
    "score": 72,
    "tendance": "up",
    "label": "Très bon",
    "composantes": {
      "assiduite_rdv":      { "score": 85, "poids": 30, "details": { "honors": 8,  "planned": 10 } },
      "engagement_elonga":  { "score": 60, "poids": 25, "details": { "attended": 3 } },
      "activite_club":      { "score": 100,"poids": 20, "details": { "active_memberships": 3 } },
      "regularite_zora":    { "score": 50, "poids": 15, "details": { "transactions": 5 } },
      "suivi_medical":      { "score": 100,"poids": 10, "details": { "consultations": 2 } }
    }
  }
}
```

Cas particulier : si `score === null` (patient nouveau sans données), le service retourne
`score: null` ; le frontend affiche `—` et le message `Données insuffisantes`.

---

## 3. Widget frontend SVG

### Fichier source

```
public/patient/dashboard.html
```

### Structure HTML (lignes 143-153)

```html
<!-- Anneau SVG Score Bolamu -->
<div style="position: relative; width: 58px; height: 58px; flex-shrink: 0;">
  <svg width="58" height="58" viewBox="0 0 72 72">
    <!-- Piste de fond grise -->
    <circle cx="36" cy="36" r="30" fill="none" stroke="#E4E4F2" stroke-width="7"></circle>
    <!-- Anneau de progression bleu — animé par JS -->
    <circle id="score-ring"
            cx="36" cy="36" r="30"
            fill="none" stroke="#003FB1" stroke-width="7"
            stroke-linecap="round"
            transform="rotate(-90 36 36)"
            stroke-dasharray="188.5"
            stroke-dashoffset="188.5"
            style="transition: stroke-dashoffset 0.5s ease;">
    </circle>
  </svg>
  <!-- Icône cœur centrale -->
  <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
    <span class="material-symbols-outlined" style="color: #003FB1; font-size: 22px;">favorite</span>
  </div>
</div>

<!-- Valeur numérique -->
<span id="scoreBolamu" style="font-size: 1.3rem; font-weight: 800; color: #0A2463;">—</span>
<span style="font-size: 0.68rem; font-weight: 700; color: #9498a8;">/ 100</span>

<!-- Indicateur de tendance -->
<div id="score-tendance">
  <span style="font-size: 0.68rem; font-weight: 800; color: #00875f;">—</span>
</div>

<!-- Personnage 3D flottant -->
<div style="background-image: url('/images/landing/garcons3Dbleu.png');
            animation: zoraFloat 4s ease-in-out infinite;">
</div>
```

**Circonférence** : `2 × π × 30 = 188.5 px` (r=30, valeur `stroke-dasharray`)  
**État initial** : `stroke-dashoffset="188.5"` = anneau vide (0 %)

### Chargement des données (lignes 2332-2362)

```js
// public/patient/dashboard.html — appelé dans A._loadAll()
fetch('https://www.bolamu.co/api/v1/patients/score-bienetre', H)
  .then(function (r) { return r.json(); })
  .then(function (d) {
    if (d.success && d.data) {
      // Stockage dans le state local A
      A._scoreBolamu  = d.data.score;
      A._scoreTendance = d.data.tendance;
      A._scoreLabel   = d.data.label;

      // Affichage de la valeur (null → tiret)
      setText('scoreBolamu', d.data.score !== null ? d.data.score : '—');

      // Indicateur de tendance
      var tendanceEl = $('score-tendance');
      if (tendanceEl) {
        var tendanceIcon  = d.data.tendance === 'up'   ? '↑'
                          : d.data.tendance === 'down' ? '↓' : '=';
        var tendanceColor = d.data.tendance === 'up'   ? '#00875f'
                          : d.data.tendance === 'down' ? '#BA1A1A' : '#9498a8';
        tendanceEl.innerHTML = '<span style="color: ' + tendanceColor
          + '; font-size: 0.68rem; font-weight: 800;">'
          + tendanceIcon + ' vs période précédente</span>';
      }

      // Animation de l'anneau SVG
      var ring = $('score-ring');
      if (ring && d.data.score !== null) {
        var offset = 188.5 * (1 - Math.min(1, d.data.score / 100));
        ring.setAttribute('stroke-dashoffset', offset.toFixed(1));
      }

    } else if (d.data && d.data.score === null) {
      // Patient nouveau — données insuffisantes
      setText('scoreBolamu', '—');
      var tendanceEl = $('score-tendance');
      if (tendanceEl) {
        tendanceEl.innerHTML =
          '<span style="color: #9498a8; font-size: 0.68rem; font-weight: 800;">Données insuffisantes</span>';
      }
    }
  })
  .catch(function (err) {
    console.error('[Score Bolamu] Erreur:', err);
    setText('scoreBolamu', '—');
  });
```

### Formule SVG `stroke-dashoffset`

```
offset = 188.5 × (1 − min(1, score / 100))
```

- Score 0   → offset = 188.5 (anneau vide)
- Score 50  → offset = 94.3  (demi-anneau)
- Score 100 → offset = 0     (anneau plein)

La valeur est arrondie à 1 décimale via `.toFixed(1)` avant d'être passée à `setAttribute`.

### États gérés

| Condition | `#scoreBolamu` | `#score-tendance` | Anneau SVG |
|---|---|---|---|
| Score > 0 | valeur numérique | `↑ / ↓ / =` + couleur | animé |
| `score === null` | `—` | `Données insuffisantes` (#9498a8) | inchangé |
| Erreur réseau | `—` | inchangé | inchangé |

---

## 4. Sources de données

### Tables interrogées

| Table | Composante | Colonnes clés | Filtre temporel |
|---|---|---|---|
| `rendez_vous` | Assiduité RDV | `patient_phone`, `scheduled_at`, `status` | 90 j / 90-180 j |
| `event_registrations` | Engagement Elonga | `patient_phone`, `event_id`, `status`, `checked_in_at` | 90 j / 90-180 j |
| `elonga_events` | Engagement Elonga | `id`, `pillar` | JOIN — filtre `pillar = 'activite'` |
| `club_members` | Activité club | `patient_phone`, `is_active`, `joined_at` | 30 j / 30-60 j |
| `zora_ledger` | Régularité Zora | `phone`, `created_at` | 30 j / 30-60 j |
| `consultations` | Suivi médical | `patient_phone`, `started_at` | 6 mois / 6-12 mois |

### Endpoint impliqué

| Méthode | Chemin | Fichier | Service |
|---|---|---|---|
| GET | `/api/v1/patients/score-bienetre` | `src/routes/patient.routes.js:164` | `calculerScoreBolamu()` |

### Règles d'intégrité

- `normalizePhone()` (`src/utils/phone.js`) appliqué en entrée sur `patientPhone` avant toute requête SQL.
- Toutes les requêtes SQL sont paramétrées (`$1`, `$2`, `$3`) — aucune interpolation de chaîne.
- En cas d'erreur SQL, le service `throw error` — le handler route renvoie HTTP 500 sans exposer le détail.
