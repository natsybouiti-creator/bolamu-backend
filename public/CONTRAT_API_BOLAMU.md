# CONTRAT API BOLAMU

> **Source de vérité unique** pour le format de toutes les réponses de l'API Bolamu.
> Toute route — existante migrée ou nouvelle — doit s'y conformer.
> Ce document évolue, mais **les codes d'erreur déjà publiés ne changent jamais**.

Version 1.0 — établie le 28 juin 2026.

---

## 1. Le principe

Toute réponse de l'API Bolamu prend **l'une de deux formes seulement** : succès ou erreur.
Le frontend ne devine jamais la forme : il sait toujours ce qu'il reçoit grâce au champ `success`.

---

## 2. Forme de SUCCÈS

```json
{
  "success": true,
  "data": { ... },
  "message": "Texte optionnel pour l'utilisateur"
}
```

| Champ | Règle |
|-------|-------|
| `success` | Toujours `true`. |
| `data` | **TOUJOURS présent.** La charge utile : objet, tableau, ou valeur. |
| `message` | Optionnel. Texte affichable (« Événement créé avec succès »). |

### Règle d'or de `data`

`data` est **toujours là**, même quand il n'y a rien à renvoyer :

- Ressource unique absente → `data: null`
- Liste vide → `data: []`

Le frontend écrit donc toujours `response.data` sans jamais vérifier son existence.
Cette règle supprime par construction toute une famille de crashes
(`Cannot read properties of undefined`).

### Listes paginées

La pagination vit **à l'intérieur** de `data` :

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": { "total": 120, "page": 1, "per_page": 20 }
  }
}
```

---

## 3. Forme d'ERREUR

```json
{
  "success": false,
  "error": {
    "code": "PHONE_ALREADY_EXISTS",
    "message": "Ce numéro est déjà inscrit."
  }
}
```

| Champ | Règle |
|-------|-------|
| `success` | Toujours `false`. |
| `error.code` | Étiquette **machine, STABLE**, en `MAJUSCULES_AVEC_UNDERSCORES`. Ne change jamais, même si le texte change. C'est ce que le frontend teste. |
| `error.message` | Texte lisible, affichable. Peut être traduit (français / Lingala) **sans casser le frontend**, puisque la logique s'appuie sur `code`, pas sur le texte. |

> **Pourquoi `code` ET `message` ?**
> `message` = pour l'humain dans la cabine (« la porte est bloquée »).
> `code` = pour le technicien (« ERR-204 »).
> Le frontend teste `code` pour réagir intelligemment ;
> il affiche `message` à l'utilisateur. Bolamu étant bilingue,
> traduire un `message` ne doit jamais casser la logique : d'où le `code`.

---

## 4. Codes HTTP

| Situation | Code |
|-----------|------|
| Lecture réussie | `200` |
| Création réussie | `201` |
| Données invalides (faute du client) | `400` |
| Non authentifié (token absent / expiré) | `401` |
| Authentifié mais sans le droit | `403` |
| Ressource introuvable | `404` |
| Conflit (doublon, déjà existant) | `409` |
| Erreur serveur inattendue | `500` |

---

## 5. Catalogue des codes d'erreur

Liste vivante, enrichie au fil des migrations.
**Un code publié ne change jamais** — on en ajoute, on n'en renomme pas.

### Authentification
| Code | Sens | HTTP |
|------|------|------|
| `AUTH_REQUIRED` | Token absent | 401 |
| `TOKEN_EXPIRED` | Token expiré | 401 |
| `INVALID_CREDENTIALS` | Identifiants faux | 401 |
| `FORBIDDEN_ROLE` | Authentifié mais mauvais rôle | 403 |

### Validation
| Code | Sens | HTTP |
|------|------|------|
| `VALIDATION_ERROR` | Validation générale échouée | 400 |
| `MISSING_FIELD` | Champ obligatoire manquant | 400 |
| `INVALID_FORMAT` | Format de champ invalide | 400 |

### Ressources
| Code | Sens | HTTP |
|------|------|------|
| `NOT_FOUND` | Ressource introuvable | 404 |
| `ALREADY_EXISTS` | Doublon générique | 409 |
| `PHONE_ALREADY_EXISTS` | Numéro déjà inscrit | 409 |

### Métier
| Code | Sens | HTTP |
|------|------|------|
| `SUBSCRIPTION_REQUIRED` | Abonnement actif requis | 403 |
| `INSUFFICIENT_POINTS` | Solde Zora insuffisant | 400 |
| `EVENT_FULL` | Événement complet | 400 |
| `ALREADY_REGISTERED` | Déjà inscrit à l'événement | 409 |

### Serveur
| Code | Sens | HTTP |
|------|------|------|
| `SERVER_ERROR` | Erreur inattendue | 500 |
| `DATABASE_ERROR` | Erreur base de données | 500 |
| `EXTERNAL_SERVICE_ERROR` | Service tiers en échec (Cloudinary, WAHA…) | 500 |

---

## 6. Les deux seuls outils autorisés

Toute réponse passe par l'un des deux helpers de `src/utils/apiResponse.js`.
**On n'écrit plus jamais `res.json(...)` à la main.**

```javascript
// SUCCÈS
ok(res, data, message, httpStatus = 200)

// Exemples
ok(res, { event });                          // 200, données simples
ok(res, { event }, "Événement créé", 201);   // 201 à la création
ok(res, [], "Aucun résultat");               // liste vide, data = []
ok(res, null);                               // ressource absente, data = null


// ERREUR
err(res, code, message, httpStatus = 400)

// Exemples
err(res, "PHONE_ALREADY_EXISTS", "Ce numéro est déjà inscrit.", 409);
err(res, "NOT_FOUND", "Événement introuvable.", 404);
err(res, "SERVER_ERROR", "Une erreur est survenue.", 500);
```

Avantage : le jour où le format doit évoluer, on modifie **deux fonctions**,
pas 420 routes. Les helpers sont le robinet unique par lequel tout passe.

---

## 7. Exceptions assumées (NE PAS migrer)

Certaines routes dérogent volontairement au contrat, pour de bonnes raisons techniques.
Elles sont documentées ici pour qu'on ne les « corrige » pas par erreur.

| Route / famille | Comportement | Raison |
|-----------------|--------------|--------|
| Webhooks WAHA / WhatsApp / MoMo / Airtel | Toujours `200`, même en erreur métier | Empêcher les fournisseurs de réessayer en boucle |
| Challenge de vérification WhatsApp | Texte brut (pas de JSON) | Format exigé par Meta |
| Exports CSV | Fichier, pas du JSON | Nature du livrable |

---

## 8. La règle d'or de la migration

> **On ne migre jamais une route sans migrer en même temps le frontend qui la lit.**

Route + frontend = **un seul lot**, testé ensemble, poussé ensemble.
Une route migrée seule casse le dashboard qui la consomme.

### Ordre de migration recommandé (par douleur décroissante)

1. **Inscription patient** — bug visible, priorité absolue.
2. Routes `{error}` des modules récents (animateur, community, partenaire,
   zora-games, vouchers) → aligner sur la forme erreur `{ error: { code, message } }`.
3. Routes famille B (`{success, clubs}`, `{success, appointments}`)
   → repackager le contenu sous `data`.
4. Le reste, au fil de l'eau, quand on touche une route pour une autre raison.

On ne réécrit pas 420 routes d'un coup. On standardise l'avenir,
on migre le passé **par lots, par ordre de douleur réelle**.

---

## 9. État actuel (audit du 28 juin 2026)

Photographie de départ, ~420 routes sur 56 fichiers :

**Formats de succès rencontrés**
- A `{ success, data }` — ~40 % (cible)
- B `{ success, <champs nommés> }` — ~35 % (à repackager)
- C résultat service brut — ~13 % (à wrapper)
- D hybrides divers — ~12 % (à normaliser)

**Formats d'erreur rencontrés**
- E `{ success:false, message }` — ~70 % (proche, à mettre sous `error`)
- F `{ error }` ou `{ success:false, error }` — ~21 % (à structurer)
- Spéciaux (webhooks, texte brut) — ~9 % (exceptions, cf. §7)

**Fracture identifiée** : les modules récents utilisent `{error}`,
les anciens `{message}`. La migration réconcilie les deux vers
la forme unique de ce contrat.
