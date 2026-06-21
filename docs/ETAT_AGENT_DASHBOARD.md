# ÉTAT DES LIEUX — DASHBOARD AGENT (analyse du code réel)

> Analyse de `public/agence/dashboard.html` tel que fourni. Vue ingénieur (endpoints,
> DOM, persistance) + vue utilisateur (ce que l'agent et le client vivent).
> Rappel méthode : « appel API existe » ≠ « persiste en base » — les écritures réelles
> restent à confirmer par un SELECT, mais on distingue déjà le câblé du fantôme.

---

## 1. Comment l'agent fonctionne réellement

Auth par `bolamu_agent_token` (sinon redirection `/agence/login.html`). Cinq onglets :

1. **Accueil** — vérifier un adhérent sur tout le réseau + 4 stats globales.
2. **Souscription** — assistant 4 étapes (Identité → Documents+photo → Formule+CGU/OVP
   → Paiement) **+** import employés en masse (Excel/CSV).
3. **Orientation réseau** — annuaire des partenaires (clinique/pharmacie/labo) filtrable.
4. **Rendez-vous** — créer un RDV réseau (patient + médecin + créneau + motif).
5. **Réclamations** — rechercher un compte + 4 actions.

Le cœur métier = l'assistant de souscription, qui capture la **photo** (caméra ou
fichier, stockée en base64 et envoyée), fait accepter CGU/OVP par l'agent en présence
du client, puis crée le compte et renvoie `member_code` + mot de passe temporaire
transmis via WhatsApp/email/proche.

---

## 2. Ce qui est réellement câblé (appel API présent — à confirmer en base)

| Action | Endpoint | Onglet |
|---|---|---|
| Vérifier un adhérent | `GET /agence/verifier-adherent?q=` | Accueil |
| Stats globales | `GET /agence/stats-globales` | Accueil |
| Vérifier client existant | `GET /agence/client?phone=` | Souscription / RDV / Réclam |
| Souscrire (complet) | `POST /agence/souscrire-complet` | Souscription |
| Import employés masse | `POST /agence/import-employes` | Souscription |
| Plans + tarifs | `GET /agence/plans-config` | Souscription |
| Partenaires réseau | `GET /agence/partenaires?ville&type&q` | Orientation |
| Médecins réseau | `GET /agence/medecins?ville=` | RDV |
| Créneaux | `GET /appointments/slots/:doctorId?date=` | RDV |
| Créer RDV | `POST /agence/rdv` | RDV |

La photo est incluse dans le payload de `souscrire-complet` (`wizardData.photoData`),
ainsi que `created_by` (téléphone de l'agent). **À vérifier en base** : que
`souscrire-complet` et `import-employes` écrivent bien (compte créé, photo stockée
sur Cloudinary, abonnement actif).

---

## 3. Ce qui est fantôme / non câblé

- **Réclamations — les 4 actions** (`réactiver`, `changer de formule`, `corriger`,
  `signaler`) : `ouvrirActionModal()` n'affiche qu'un texte « sera connecté au module…
  contactez l'administrateur ». **Aucun appel API.** Du pur affichage.
- **Couverture motif SSP** : `checkMotifCoverage()` est 100 % côté client, basée sur la
  liste codée en dur. Informatif, pas une vérification serveur (acceptable mais à
  assumer comme tel).

---

## 4. Code mort & doublons (à supprimer — risque de casse silencieuse)

- **Souscription legacy orpheline** : `rechercherClient()` et `confirmerSouscription()`
  lisent des éléments DOM qui **n'existent plus** (`sub-phone`, `sub-client-result`,
  `sub-new-client`, `sub-nom`, `sub-prenom`, `sub-payment-mode`, `sub-confirmation`,
  `step-plan`). Elles posteraient sur `POST /agence/souscrire` (ancien endpoint).
  Mortes mais présentes.
- **Fonctions définies deux fois** : `renderPlanCards()` et `selectPlan()` existent en
  version legacy (cible `plan-cards`, signature `selectPlan(key, el)`) **et** version
  wizard (cible `w-plan-cards`, signature `selectPlan(card)`). En JS, la **seconde
  écrase la première** — la version legacy est inatteignable, donc trompeuse.

---

## 5. Incohérences critiques de données (prix & plans)

**Trois définitions de tarifs différentes dans le même fichier :**

| Source | MOTO | NDEKO | LIBOTA | Membres |
|---|---|---|---|---|
| `PLANS_UI` (legacy) | 2 000 | 4 000 | 10 000 | 1 / 2 / 5 |
| Fallback `loadPlansConfig` | 15 000 | 35 000 | 70 000 | 1 / 4 / 8 |
| Tarifs réels Bolamu | 2 000 | 5 000 | 10 000 | 1 / 2 / 5 |

→ Le **fallback (15 000 / 35 000 / 70 000) est faux** et s'affiche si `plans-config`
échoue. NDEKO est à 4 000 en legacy vs 5 000 réel. **Identifiants de plan incohérents** :
`moto/ndeko/libota` (legacy) vs `essentiel/standard/premium` (import + fallback) vs les
`id` renvoyés par l'API. Risque : mauvais prix affiché/facturé, mauvais plan envoyé.

**Règle à appliquer** : un seul source de vérité — `GET /agence/plans-config` (issu de
`platform_config`), pas de fallback à prix codé en dur (ou un fallback aux vrais prix),
et un seul jeu d'identifiants de plan partout.

---

## 6. Lacune métier — l'import « entreprise » n'en est pas un

`import-employes` envoie seulement `nom, prenom, phone, categorie_rh, plan,
payment_method`. **Aucun `company_id`, aucun `company_contract`, et la colonne `site`
attendue dans le fichier n'est pas lue.** Résultat : ce n'est pas un enrôlement
d'entreprise (B2B groupé rattaché à un contrat), mais une création de comptes
individuels en lot. Il manque : sélection/création de l'entreprise, rattachement au
contrat (`companies`, `company_employees`, `company_contracts`), et la facturation B2B
plutôt qu'un paiement par employé.

---

## 7. Autres points

- **Bénéficiaires/famille non gérés** : les formules couvrent 2 à 5 personnes, mais
  l'assistant ne capture qu'un seul titulaire — pas d'écran pour ajouter les
  bénéficiaires (`beneficiaires_familiaux` / `subscription_members`).
- **SSP sans prix** : le catalogue SSP est codé en dur (≈60 items, dupliqué du
  dashboard secrétaire) et ne porte qu'un booléen `couvert`, **aucun prix** — alors que
  tu veux « la liste des SSP, les prix ». À sourcer depuis le backend, pas dupliqué.
- **Conformité design** : le fichier utilise **Fraunces** et des **emojis** (📷 📧 👥 📱
  ✅ 🔑) — hors charte (Plus Jakarta Sans + Material Symbols, zéro emoji). À reprendre
  lors du pass UI.
- **Sécurité / vie privée** : le **mot de passe temporaire s'affiche en clair** à
  l'écran et part dans un lien WhatsApp pré-rempli. Acceptable pour l'onboarding, mais à
  arbitrer (lien à usage unique, expiration courte).
- **Pas d'OTP côté agent** : l'agent crée le compte directement ; l'anti-fraude repose
  alors entièrement sur la **photo + la pièce d'identité** — d'où l'importance de
  confirmer que la photo est bien stockée et consultable.

---

## 8. Priorités chirurgicales (proposition)

1. **Unifier prix & plans** — supprimer le fallback faux, une seule source
   (`platform_config`), un seul jeu d'identifiants. (Risque client direct.)
2. **Supprimer le code mort** — souscription legacy + doublons `renderPlanCards` /
   `selectPlan`.
3. **Confirmer la persistance** de `souscrire-complet` (compte + photo + abonnement) et
   `import-employes` par SELECT en base.
4. **Câbler les réclamations** (ou les retirer tant qu'elles ne sont pas connectées —
   ne pas laisser de faux boutons).
5. **Faire de l'import un vrai enrôlement entreprise** — rattachement
   `companies`/`company_contracts`, lecture de `site`, facturation B2B.
6. **Ajouter la gestion des bénéficiaires** dans l'assistant (cohérence avec les
   formules multi-membres).
7. **Pass UI conforme** (retirer Fraunces/emojis) + **SSP avec prix** depuis le backend.
