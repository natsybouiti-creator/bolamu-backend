# MÉTHODE BOLAMU — l'usine qui construit l'OS

> Manuel d'organisation du développement. À lire en tête de chaque session Cascade,
> au même titre que `CONTEXT.md` et `AGENTS.md`. Destiné à : le PO (M. Bouiti),
> l'architecte (Claude en chat), et chaque agent d'exécution (Cascade).
> Emplacement cible dans le repo : `docs/METHODE_BOLAMU.md`.

---

## 0. Principe fondateur — le mur porteur

Bolamu est un OS de santé interconnecté : le back et le front ne sont pas deux projets,
ce sont **deux corps de métier qui câblent contre le même plan**. Le plan, c'est le
**contrat API** (`docs/ENDPOINTS.md`).

Toute une famille de bugs (jeux Zora non persistés, `'ev' + e.id` envoyé à une route
qui attend un entier, table `zora_balances` devinée au lieu de `zora_points`, toast de
succès affiché avant écriture en base) a une seule cause : le front et le back
inventaient chacun leur version de la vérité, sans contrat liant.

**Deux lois en découlent, non négociables :**

1. **Un agent lit le contrat, ne l'invente jamais.** Ce qui manque côté backend part
   dans `docs/BACKEND_MANQUANT_<dashboard>.md`, jamais dans une supposition.
2. **Le front n'annonce jamais un succès que le contrat n'a pas confirmé.**
   Appel API → `response.ok` → *puis seulement* mise à jour visuelle et toast.
   Jamais l'inverse. Un échec affiche une erreur claire, pas un faux succès.

Ces deux lois suppriment ~80 % de ce qui a été débuggé manuellement.

---

## 1. Les corps de métier (qui fait quoi)

| Rôle | Qui | Responsabilité | Ne fait jamais |
|---|---|---|---|
| Maître d'ouvrage | M. Bouiti (PO/CEO) | Priorités business, validation des étapes irréversibles, décisions finales | Toucher au code |
| Architecte / maître d'œuvre | Claude (chat) | Traduire les décisions en specs, rédiger les prompts maîtres, relire les diffs sensibles, tenir la cohérence inter-chantiers | Tenir la truelle |
| Compagnons d'exécution | Cascade ×6 (sessions Windsurf) | Câbler un dashboard de bout en bout, en autonomie, contre le contrat | Inventer une route, modifier les plans communs |
| Structure déjà coulée | Backend Node/Express + Neon | Routes API + base de données existantes | (Existant — on ne le réinvente pas) |
| Banc de contrôle qualité | Harness d'audit (Playwright + SELECT SQL) | Prouver la persistance avant/après, en lecture seule | Écrire en base |

---

## 2. Les plans (source de vérité unique)

Ces fichiers sont les plans d'architecte. Un agent les lit ; seuls le PO et l'architecte
les modifient, **jamais deux sessions en parallèle** (risque de conflit de merge / dérive).

- `docs/CONTEXT.md` — le terrain et les règles générales du projet.
- `docs/ENDPOINTS.md` — le **contrat API** : plomberie + électricité. Source de vérité
  pour toute donnée et toute action. Versionné, autoritaire.
- `docs/AGENTS.md` — les règles de chantier communes (persistance vérifiée, design
  dynamique, vanilla HTML, API avant toast, audit obligatoire avant « terminé »).
- Design system partagé — `bolamu-ds.css` + `bolamu-nav.js` : le cahier des finitions.
  Un seul habillage pour que les 6 dashboards forment **un seul bâtiment**.

---

## 3. La chaîne de montage (pipeline par dashboard)

Quatre postes autonomes, puis un seul point d'arrêt humain.

1. **Cadrage** *(autonome)* — lire le fichier, inventorier les données mock, mapper
   chacune vers la vraie route du contrat, signaler les manques. Aucune supposition.
2. **Câblage** *(autonome)* — brancher aux vraies routes. Loi #2 stricte : API d'abord,
   toast ensuite.
3. **UI liée** *(autonome)* — ré-implémentation vanilla de la maquette validée
   (voir §5, generative UI), déjà branchée au contrat. **Indissociable du câblage** :
   on n'habille jamais un mur non plombé. Le dynamisme (animations, micro-interactions,
   count-up) vient du mouvement, pas de nouveaux styles hors design system.
4. **Audit** *(autonome, en boucle)* — l'oracle de vérité. Preuve SQL avant/après
   pour chaque action à effet persistant. Si NON PERSISTÉ → corriger → re-tester.
   Boucle jusqu'à PERSISTÉ ou **5 essais max** par action ; au-delà, documenter dans
   `docs/BLOCAGE_<dashboard>.md` et continuer (jamais de boucle infinie).
5. **Gate humain** *(arrêt obligatoire)* — `git push` uniquement après que le PO a vu :
   le rapport de persistance, le `git diff --stat`, la liste des routes manquantes.
6. **Prod** — déploiement Render, vérifié vert avant de relancer l'audit en prod.

---

## 4. La règle du looping

Un looping autonome n'est sûr **que** s'il boucle contre un oracle de vérité objectif.
Sans oracle, l'agent optimise pour l'apparence et déclare un faux succès.

- **Autonomie illimitée** entre le Cadrage et le commit local, parce que l'Audit
  (preuve SQL) sert d'oracle.
- **Verrou humain** réservé à l'irréversible et au stratégique :
  `git push`, modification d'un plan commun (contrat / AGENTS / design system),
  décision business, flux d'argent réel.

Conception de l'usine = **minimiser les points de contact humains aux seuls verrous
irréversibles**. Tout le reste boucle seul.

---

## 5. Generative UI — la maquette et le bâtiment

> Le 3ᵉ pilier, avec l'agentic engineering (rôles + autonomie) et le looping (§4).

**Définition pour Bolamu.** On *explore* le visuel par génération — Claude Design :
canvas, animations, perspectives riches, ce qu'un schéma de chat ne donnera jamais —
puis on *ré-implémente* le résultat validé en HTML/CSS/JS **vanilla** par Cascade,
contre le design system et le contrat.

**Analogie.** Claude Design produit la **maquette d'architecte** : faite pour voir,
valider, décider. Le vanilla réimplémenté est le **bâtiment**. On ne fait jamais
habiter les gens dans la maquette.

**La faute à ne pas refaire.** Le dashboard patient a été servi directement depuis le
bundle `.dc.html` (DCLogic) — c'était faire habiter les patients dans la maquette.
Conséquences : DOM injecté au runtime invisible aux tests Playwright, bundle de 5,7 Mo,
moitié des bugs de câblage. Le `.dc.html` est une **esquisse jetable**, jamais un livrable.

**Règles du pilier :**

1. L'export Claude Design (`.dc.html`) est un **artefact d'exploration**, jamais servi
   en prod.
2. La validation visuelle se fait sur la maquette ; le câblage et la persistance se
   font sur le vanilla réimplémenté.
3. La ré-implémentation respecte le design system commun (`bolamu-ds.css`) — la maquette
   *inspire*, elle n'impose ni ses styles propres ni son runtime.
4. Le dynamisme est porté dans le vanilla, pas hérité du runtime propriétaire.
5. Une maquette n'est « terminée » que quand son équivalent vanilla passe l'Audit de
   persistance. La beauté ne compte pas tant que la plomberie n'est pas prouvée.

**Où ça s'insère.** L'exploration se fait en amont, hors chaîne, avec le PO et
l'architecte. La chaîne (§3) part donc d'une **maquette déjà validée**, pas d'une page
blanche : le poste « UI liée » est la ré-implémentation vanilla de cette maquette.

---

## 6. La convergence — comment 6 dashboards font UN OS

Trois colonnes vertébrales partagées. C'est ce qui fait l'« OS interconnecté ».

- **Contrat commun** — mêmes routes, mêmes tables. Une prescription écrite par le
  médecin est lue par le patient et vue par la pharmacie. Une entrée `zora_ledger`,
  une `notification`, un `health_record` : tous tapent dans la même plomberie.
- **Design commun** — `bolamu-ds.css` / `bolamu-nav.js`. Un seul habillage = un seul
  bâtiment, pas six maisons.
- **Système nerveux commun** — `notifications`, `zora_*`, `health_records`,
  `audit_log` : les événements qui traversent les rôles.

### Le test qui manque encore (prochaine pierre)

La persistance a été prouvée *dans* le dashboard patient. Le vrai test de l'OS est le
**flux inter-rôles de bout en bout**, jamais encore construit. Exemples à couvrir :

- Médecin prescrit → patient notifié → pharmacie voit l'ordonnance → patient retire.
- Labo dépose un résultat → patient + médecin notifiés → résultat dans `health_records`
  avec consentement/traçabilité (BHP).
- Patient s'inscrit à un événement Elonga → check-in QR → crédit `zora_ledger` →
  notification → progression de palier.

Ces parcours sont la preuve que l'OS fonctionne « ensemble », pas dashboard par dashboard.

---

## 7. La cadence (avec Windsurf / Cascade)

- 6 sessions Windsurf en parallèle, une par dashboard. Fichiers HTML distincts =
  parallélisme sûr (pas de conflit git).
- Chaque session boucle jusqu'au **commit local**, puis s'arrête au gate avec son
  rapport.
- Le PO regroupe les rapports et les transmet à l'architecte ; on franchit les gates
  ensemble, dashboard par dashboard.
- Le goulot d'étranglement, ce sont les gates — **par conception**, pas par accident.

---

## 8. Les livrables (le dossier permanent)

Par dashboard, en fin de chaîne :

- Le fichier HTML câblé en vrai (zéro mock restant, ou liste explicite des manques).
- `docs/AUDIT_PERSISTANCE_<dashboard>.md` — preuve SQL avant/après par action.
- `docs/BACKEND_MANQUANT_<dashboard>.md` — routes à créer, le cas échéant.
- `docs/BLOCAGE_<dashboard>.md` — toute action non résolue après 5 essais.
- `docs/PROGRESS.md` — état d'avancement global, mis à jour.

Pour l'ensemble : chaque rôle (médecin, secrétaire, pharmacie, labo, RH, agence)
dispose d'un dashboard aussi fiable que celui du patient sécurisé — et les flux
inter-rôles sont testés, pas seulement la persistance locale.

---

## 9. Garde-fous transverses (rappel)

- Lecture seule pour tout script d'audit : SELECT uniquement, jamais d'écriture SQL
  directe ; les écritures passent par les vrais endpoints métier.
- RH : jamais de Zora individuel nommé — agrégats anonymisés (BHP).
- Pharmacie / paiements : tout flux d'argent réel est signalé avant d'être câblé.
- Labo / dossier médical : consentement + traçabilité (Lois 29-2019, 5-2025) respectés
  à chaque écriture.
- Index PostgreSQL : `CREATE INDEX` séparés, jamais d'index inline façon MySQL.
- HTML : jamais de `node --check` ; lecture complète du fichier avant modification
  chirurgicale.
