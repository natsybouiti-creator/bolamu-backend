# Score Bolamu — Documentation technique

## Vue d'ensemble

Le Score Bolamu est un indicateur de bien-être et d'engagement patient, calculé sur une échelle de 0 à 100. Il combine 5 composantes pondérées pour refléter l'activité du patient sur la plateforme.

---

## Backend

### Service de calcul

**Fichier** : `src/services/scoreBolamu.service.js`

### Formule pondérée

| Composante | Poids | Description |
|------------|-------|-------------|
| Assiduité RDV | 30% | RDV honorés / RDV planifiés |
| Engagement Elonga | 25% | Événements suivis (checked_in) |
| Activité communauté/club | 20% | Membres actifs dans les clubs |
| Régularité Zora | 15% | Fréquence de gains de points |
| Suivi médical | 10% | Consultations effectuées |

### Fenêtres temporelles

| Composante | Période de calcul | Période de tendance |
|------------|------------------|---------------------|
| Assiduité RDV | 90 jours glissants | 90-180 jours |
| Engagement Elonga | 90 jours glissants | 90-180 jours |
| Activité club | 30 jours glissants | 30-60 jours |
| Régularité Zora | 30 jours glissants | 30-60 jours |
| Suivi médical | 6 mois glissants | 6-12 mois |

### Plafonds par composante

- **Assiduité RDV** : ratio non plafonné (0-100%)
- **Engagement Elonga** : plafonné à 5 événements (5 événements = 100%)
- **Activité club** : plafonné à 3 clubs actifs (3 clubs = 100%)
- **Régularité Zora** : plafonné à 10 transactions (10 transactions = 100%)
- **Suivi médical** : plafonné à 2 consultations (2 consultations = 100%)

### Logique de calcul de tendance

Comparaison entre le score actuel et le score de la période précédente :

- **up** : score actuel > score précédent + 5 points
- **down** : score actuel < score précédent - 5 points
- **stable** : écart ≤ 5 points dans les deux sens

### Labels selon score

| Score | Label |
|-------|-------|
| 80-100 | Excellent |
| 60-79 | Très bon |
| 40-59 | Bon |
| 20-39 | En progression |
| 0-19 | À démarrer |

### Endpoint API

**Route** : `GET /api/v1/patients/score-bienetre`

**Middleware** : `authMiddleware` (patient connecté requis)

**Payload de réponse** :

```json
{
  "success": true,
  "data": {
    "score": 72,
    "tendance": "up",
    "label": "Très bon",
    "composantes": {
      "assiduite_rdv": {
        "score": 85,
        "poids": 30,
        "details": {
          "honors": 8,
          "planned": 10
        }
      },
      "engagement_elonga": {
        "score": 60,
        "poids": 25,
        "details": {
          "attended": 3
        }
      },
      "activite_club": {
        "score": 100,
        "poids": 20,
        "details": {
          "active_memberships": 3
        }
      },
      "regularite_zora": {
        "score": 50,
        "poids": 15,
        "details": {
          "transactions": 5
        }
      },
      "suivi_medical": {
        "score": 100,
        "poids": 10,
        "details": {
          "consultations": 2
        }
      }
    }
  }
}
```

**Cas particulier** : Si le patient est nouveau (données insuffisantes), le service peut retourner `score: null` ou un score bas avec tendance `stable`.

### Tables sources

Le service interroge les tables suivantes :

1. **rendez_vous** : RDV du patient (colonnes `patient_phone`, `scheduled_at`, `status`)
2. **event_registrations** + **elonga_events** : Inscriptions aux événements Elonga (colonnes `patient_phone`, `event_id`, `status`, `checked_in_at`, `pillar`)
3. **club_members** : Appartenance aux clubs (colonnes `patient_phone`, `is_active`, `joined_at`)
4. **zora_ledger** : Transactions Zora (colonnes `phone`, `created_at`)
5. **consultations** : Consultations médicales (colonnes `patient_phone`, `started_at`)

---

## Frontend

### Widget anneau SVG

**Fichier** : `public/patient/dashboard.html`

**Structure HTML** :

```html
<div style="position: relative; width: 58px; height: 58px; flex-shrink: 0;">
  <svg width="58" height="58" viewBox="0 0 72 72">
    <circle cx="36" cy="36" r="30" fill="none" stroke="#E4E4F2" stroke-width="7"></circle>
    <circle id="score-ring" cx="36" cy="36" r="30" fill="none" stroke="#003FB1" 
            stroke-width="7" stroke-linecap="round" transform="rotate(-90 36 36)" 
            stroke-dasharray="188.5" stroke-dashoffset="188.5" 
            style="transition: stroke-dashoffset 0.5s ease;"></circle>
  </svg>
  <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
    <span class="material-symbols-outlined" style="color: #003FB1; font-size: 22px;">favorite</span>
  </div>
</div>
```

**Calcul du stroke-dashoffset** :

- Circonférence du cercle : `2 * π * 30 = 188.5`
- Offset = `188.5 - (188.5 * score / 100)`
- Exemple : score 72 → offset = `188.5 - (188.5 * 0.72) = 52.78`

### Chargement des données

**Fonction** : `A._loadAll()` (appelée au chargement du dashboard)

```javascript
fetch('https://www.bolamu.co/api/v1/patients/score-bienetre', H).then(function (r) { 
  return r.json(); 
}).then(function (d) {
  if (d.success && d.data) {
    // Mise à jour de l'affichage
    setText('scoreBolamu', d.data.score);
    // Affichage de la tendance
    var tendanceEl = $('score-tendance');
    if (tendanceEl && d.data.tendance) {
      tendanceEl.innerHTML = '<span style="font-size: 0.68rem; font-weight: 800; color: #00875f;">' + 
        (d.data.tendance === 'up' ? '↗ En hausse' : d.data.tendance === 'down' ? '↘ En baisse' : '→ Stable') + 
        '</span>';
    }
  }
}).catch(function (err) {
  console.error('[Score Bolamu] Erreur:', err);
  setText('scoreBolamu', '—');
});
```

### États gérés

1. **Score normal** : Affichage du score (0-100) + tendance (up/down/stable)
2. **Tendance affichée** : Flèche indicatrice + texte ("En hausse", "En baisse", "Stable")
3. **Données insuffisantes** : Affichage de "—" si le score est null ou en cas d'erreur

### Personnage illustratif

Le personnage 3D (`garcons3Dbleu.png`) est affiché à droite de l'anneau SVG dans la carte Score Bolamu, avec une animation flottante (`zoraFloat`).

---

## Data

### Schéma des tables utilisées

#### rendez_vous

| Colonne | Type | Description |
|---------|------|-------------|
| patient_phone | VARCHAR | Numéro du patient |
| scheduled_at | TIMESTAMP | Date/heure du RDV |
| status | ENUM | pending, confirmed, in_progress, completed, cancelled |

#### event_registrations

| Colonne | Type | Description |
|---------|------|-------------|
| patient_phone | VARCHAR | Numéro du patient |
| event_id | INTEGER | ID de l'événement |
| status | ENUM | registered, checked_in, cancelled |
| checked_in_at | TIMESTAMP | Heure de check-in |

#### elonga_events

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | ID de l'événement |
| pillar | VARCHAR | Pillar Elonga (activite, nutrition, sante, etc.) |

#### club_members

| Colonne | Type | Description |
|---------|------|-------------|
| patient_phone | VARCHAR | Numéro du patient |
| is_active | BOOLEAN | Statut d'adhésion |
| joined_at | TIMESTAMP | Date d'adhésion |

#### zora_ledger

| Colonne | Type | Description |
|---------|------|-------------|
| phone | VARCHAR | Numéro du patient |
| created_at | TIMESTAMP | Date de la transaction |

#### consultations

| Colonne | Type | Description |
|---------|------|-------------|
| patient_phone | VARCHAR | Numéro du patient |
| started_at | TIMESTAMP | Date de début de consultation |

---

## Notes de maintenance

- Le service utilise `normalizePhone()` pour standardiser tous les numéros de téléphone
- Les requêtes SQL utilisent des filtres temporels pour les fenêtres glissantes
- La tendance est calculée en comparant deux périodes consécutives de même durée
- Les plafonds évitent qu'une composante ne domine excessivement le score global
- En cas d'erreur de calcul, le frontend affiche "—" et log l'erreur dans la console
