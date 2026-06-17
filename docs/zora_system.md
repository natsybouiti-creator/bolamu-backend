# SYSTÈME ZORA — DOCUMENT DE RÉFÉRENCE V2

> Document interne Bolamu. Ne pas diffuser. Version 3 — mise à jour : juin 2026.

---

## 1. Nature et positionnement

Zora est le programme de bien-être lifestyle de Bolamu. Ce n'est pas un programme de fidélité classique — c'est une infrastructure comportementale qui transforme chaque acte de santé et de bien-être en pouvoir d'achat réel chez les enseignes qui comptent dans la vie quotidienne du Congolais.

**Modèle de référence :** Aquitai (leader européen data fidélité grande distribution) appliqué au bien-être au Congo.

**Positionnement :** La première devise bien-être du Congo. Tu prends soin de toi → tu te fais plaisir.

**Règle de communication :** Ne jamais dire "1 Zora = X FCFA". Toujours communiquer la récompense concrète en face de l'acte concret. Exemple : "Fais ta consultation ce mois-ci → tu t'approches de ton plein d'essence gratuit."

**Valeur interne (jamais communiquée publiquement) :**
- 1 Zora Point = ~1,5 FCFA de coût réel pour Bolamu
- Valeur perçue par l'adhérent = 3 à 5 FCFA grâce à la combinaison Zora Cash + MFR partenaire

---

## 2. Mécanique de base

**Zora Points** : compteur d'activité trimestriel. Reset à zéro chaque trimestre.

**Zora Cash** : valeur convertible en FCFA, créditée sur MoMo MTN ou Airtel en fin de trimestre selon le palier atteint.

**Règle absolue de mesure** : aucun point sans preuve système automatique. Zéro déclaratif non vérifiable. Chaque acte doit laisser une trace dans Bolamu ADSP, chez un partenaire via QR, ou via un device tiers certifié (wearable).

---

## 3. Paliers trimestriels (loi de Pareto)

| Palier | Points requis | Zora Cash MoMo | Part adhérents |
|--------|--------------|----------------|----------------|
| Bronze | 0 – 499 pts | 0 FCFA | ~60% |
| Argent | 500 – 2 999 pts | 2 500 FCFA | ~20% |
| Or | 3 000 – 6 999 pts | 5 000 FCFA | ~15% |
| Platine | 7 000+ pts | 10 000 FCFA | ~5% |

**Note Pareto :** 60% des adhérents n'atteindront jamais Argent. C'est une constante comportementale universelle observée dans tous les programmes de gamification santé. Ce n'est pas un problème — c'est ce qui rend le système financièrement viable. Ces adhérents bénéficient des remises MFR partenaires sans que Bolamu sorte du cash.

**Breakage :** 15 à 25% des Zora Cash éligibles ne seront jamais réclamés (friction naturelle, oubli, procrastination). C'est une réduction automatique du coût réel du pool — constante observée dans tous les programmes de fidélité mondiaux. À comptabiliser comme réduction de coût, jamais comme objectif.

---

## 4. Actes générateurs de points

### Règle de plafonnement par catégorie (anti-manipulation)

| Catégorie | Part max des points atteignables |
|-----------|----------------------------------|
| Santé | 60% |
| Activité physique | 25% |
| Engagement plateforme | 10% |
| Lifestyle partenaires | 5% |

Un adhérent Platine doit nécessairement avoir fait des actes de santé significatifs. Il est impossible d'atteindre Platine uniquement via des achats lifestyle chez les partenaires.

### 4.1 Santé (60% max)

Tous les actes santé sont mesurés via QR Bolamu scanné chez le partenaire clinique/labo ET enregistrement du praticien dans Bolamu ADSP. Les deux conditions doivent être remplies.

- **Consultation préventive** chez médecin partenaire → QR scanné à l'entrée + enregistrement praticien
- **Bilan sanguin** au labo partenaire → QR scanné + résultat uploadé par le labo dans le dossier patient (points déclenchés à réception du résultat, pas à la prise de sang)
- **Dépistage HTA/diabète** → mesure enregistrée par le praticien dans ADSP (tension et glycémie = valeurs objectives saisies par le médecin)
- **Consultation spécialiste partenaire** → même mécanique QR
- **CPN (consultation prénatale)** → enregistrement sage-femme/gynéco dans dossier Bolamu
- **Vaccination** → enregistrement praticien + carnet vaccinal numérique Bolamu mis à jour
- **Renouvellement ordonnance** → ordonnance émise par médecin Bolamu ADSP (encourage la continuité des soins maladies chroniques)

### 4.2 Activité physique (25% max)

- **Séance Elonga encadrée** → check-in coach Elonga dans l'app (coach valide la présence, pas le patient)
- **Événement sportif Elonga** → inscription + check-in événement numérique
- **Activité physique trackée wearable** → intégration Apple Health / Google Fit / Garmin. Seuil minimum : 30 minutes activité modérée continue, fréquence cardiaque > 100 bpm. Plafonné à 1 séance par jour.
- **Marche quotidienne trackée** → même intégration wearable. Seuil : 7 000 pas minimum. Plafonné à 1 fois par jour.

### 4.3 Nutrition & prévention

- **Atelier nutrition Loboko** → check-in atelier via QR (Loboko valide la présence)
- **Consultation nutritionniste partenaire** → enregistrement consultation dans Bolamu
- **Achat nutrition santé chez partenaire** → scan QR caisse + catégorie produit validée par Bolamu (uniquement sur produits pré-approuvés dans le catalogue Bolamu)

### 4.4 Engagement plateforme (10% max)

- **Connexion hebdomadaire app** → log serveur automatique. 1 fois par semaine maximum.
- **Mise à jour dossier de santé** → champ rempli dans ADSP. Points modestes (déclaratif partiel).
- **Score HPQ hebdomadaire** → B2B uniquement (Wellness entreprises). Pas disponible pour Care grand public : questionnaire nécessite consentement entreprise + calcul ICP interne.
- **Parrainage validé** → nouvel adhérent actif depuis 30 jours. Points déclenchés à J+30 d'activité réelle, jamais à l'inscription.

### 4.5 Lifestyle partenaires (5% max — bonus uniquement)

- Achat chez partenaire Zora (essence, resto, hôtel, supermarché, sport) → scan QR caisse partenaire
- Points bonus uniquement — ne peut pas à lui seul faire monter au palier supérieur

---

## 5. Catalogue de récompenses

### 5.1 Distinction actes / récompenses

La beauté et le bien-être lifestyle sont **principalement des récompenses**, pas des actes générateurs. Exception : consultation bien-être psychologique ou nutritionniste = acte générateur car acte de prévention santé vérifiable. Achat beauté chez partenaire = récompense + petits points Lifestyle bonus (5% max).

### 5.2 Récompenses par palier

**Bronze — remises MFR uniquement (partenaire finance, Bolamu ne sort rien)**
- Bidon essence 5L : -10% chez Total/Puma partenaire
- Coupe de cheveux : -10 à -15% chez salon partenaire
- Repas restaurant partenaire : -10% sur addition
- Produit beauté / skincare entrée de gamme : -10% chez boutique partenaire

**Argent — 2 500 FCFA Zora Cash MoMo + remises MFR**
- Plein essence partiel (~15L) : économie ~4 500 FCFA (Zora Cash + MFR 10%)
- Courses supermarché premium : -15% + 2 500 FCFA sur panier 20 000 FCFA
- Soin spa / salon beauté : -10% + 2 500 FCFA sur prestation 25 000 FCFA
- Kit skincare partenaire : remise MFR + Zora Cash
- Manucure / pédicure / soin capillaire : remise MFR partenaire

**Or — 5 000 FCFA Zora Cash MoMo + remises MFR**
- Plein essence complet (30L) : économie ~9 500 FCFA soit -32% (5 000 Zora Cash + MFR 15%)
- Aide loyer partielle : 5 000 FCFA déduits via MoMo direct à l'agence partenaire
- Nuitée hôtel Brazzaville : économie ~12 500 FCFA soit -25% (5 000 Zora Cash + MFR 15%)
- Bon restaurant gastronomique : -20% sur table (MFR 10% + 5 000 FCFA Zora Cash)
- Kit beauté / parfum premium : remise MFR + Zora Cash
- Séance spa complète : -25 à -30%

**Platine — 10 000 FCFA Zora Cash MoMo + MFR + pool Wellness B2B**
- Aide loyer significative : 10 000 à 20 000 FCFA/mois cumulable sur 3 mois
- Vol Brazzaville–Pointe-Noire : économie ~35% (10 000 Zora Cash + MFR airline 20% + pool Wellness)
- Week-end hôtel + spa partenaire : -30%
- Vol international Brazzaville–Paris : économie 27 à 47% (Zora Cash cumulé sur 3 à 4 trimestres consécutifs + pool Wellness entreprise + MFR airline 20% — pas atteignable en 1 seul trimestre)
- Box beauté & bien-être trimestrielle : sélection produits partenaires premium

---

## 6. Modèle financier — qui paie quoi

### 6.1 Le modèle MFR (Merchant Funded Rewards)

C'est le moteur principal du système. Le partenaire finance sa propre remise comme il financerait n'importe quel budget marketing — sauf qu'ici le coût est variable (uniquement si vente réalisée) et le ROI est mesurable.

**Mécanique :**
1. Adhérent achète chez partenaire
2. Partenaire offre remise 10 à 20% financée sur son budget marketing
3. Bolamu prend 30 à 40% de la remise en commission de mise en relation
4. Facturation mensuelle groupée B2B (facture Bolamu → partenaire)
5. Partenaire ne perd jamais rien — il paie uniquement sur vente réalisée

**Exemple nuitée hôtel 80 000 FCFA :**
- Remise MFR hôtel 15% = 12 000 FCFA financés par l'hôtel
- Commission Bolamu 35% de la remise = 4 200 FCFA
- Adhérent paie = 68 000 FCFA
- Hôtel reçoit = 68 000 FCFA (son coût net = 12 000 FCFA, soit son budget pub)

### 6.2 Zora Cash MoMo — coût réel Bolamu

Bolamu sort du cash uniquement pour les paliers Or et Platine.

**Sources de financement du pool Zora Cash :**
1. Marge nette abonnement Care (~500 FCFA/mois/adhérent) — contribution partielle
2. Wellness B2B (BRASCO et grands groupes) — source principale pour Or et Platine
3. Breakage naturel 15 à 25% — réduction automatique du coût réel
4. Commission MFR — contribue au solde

**Règle de sécurité :** Budget pool Zora Cash plafonné à un pourcentage fixe des revenus trimestriels. Si beaucoup d'adhérents sont actifs, les seuils de points sont ajustés à la hausse pour rester dans l'enveloppe. Jamais une promesse illimitée.

**Règle de sécurité dynamique :** Si plus de 25% des adhérents atteignent Or ou Platine un trimestre donné, les seuils de points sont ajustés automatiquement à la hausse (exemple : Argent 500 → 750 pts, Or 3 000 → 4 000 pts) pour rester dans l'enveloppe budget fixe. Jamais une promesse illimitée.

### 6.3 La donnée — revenu Phase 2 et 3

**Phase 2 (5 000+ adhérents) — reporting partenaire monétisable**
- Reporting mensuel : nb clients, panier moyen, fréquence, pics d'activité
- Campagnes ciblées : partenaire paie pour atteindre un segment précis de la base Bolamu
- Tarif campagne ciblée : 150 000 à 300 000 FCFA par campagne

**Phase 3 (20 000+ adhérents) — intelligence prédictive**
- Profils comportementaux bien-être croisés avec données d'achat lifestyle
- Valeur par profil ciblé : 100 à 500 FCFA selon la précision du segment
- Aucun autre acteur au Congo ne peut proposer cette donnée

---

## 7. L'intérêt partenaire — argument de vente

### Ce qui les fait signer

**Argument 1 — Client qualifié, pas un passant**
L'adhérent Bolamu a prouvé trois choses : il paie un abonnement mensuel (revenu régulier, discipline financière), il fait des actes de bien-être (valorise la qualité de vie), il est actif sur la plateforme (engagé). C'est le profil premium que tout commerçant veut.

**Argument 2 — Coût variable, zéro risque**
La pub radio coûte 200 000 FCFA que tu aies des clients ou non. La remise MFR Bolamu ne coûte que si un client vient et achète. Proportionnel au résultat, jamais à perte.

**Argument 3 — Données (Phase 2)**
Premier canal marketing au Congo qui fournit : nb clients réels envoyés, panier moyen, fréquence de visite, pics d'activité. Aucun autre canal ne peut donner ça aujourd'hui.

**Argument 4 — Campagnes ciblées (Phase 3)**
Accès à des segments ultra-qualifiés. Total veut pousser son carburant premium → Bolamu cible les 200 adhérents Or/Platine qui ont déjà fait le plein chez Total. ROI mesurable et immédiat.

### Ce qu'on ne leur dit pas

Ne jamais parler de "points", de "Zora", de "système de fidélité" dans le pitch partenaire. Leur langage : "je vous amène des clients qualifiés qui achètent, vous ne payez que si ça marche, je vous donne les chiffres pour le prouver."

### Séquence de signature

- **Phase 0 :** Test pilote 2 mois. Commission Bolamu = 0%. Le partenaire finance uniquement sa remise MFR sur son propre budget marketing. Objectif : prouver le trafic réel sans risque financier pour personne. La commission Bolamu (30 à 40% de la remise) démarre uniquement en Phase 1 après présentation des chiffres réels.
- **Phase 1 :** Après test, présentation des chiffres réels + activation commission MFR.
- **Phase 2 :** Forfait marketing partenaire sur preuves de trafic et données.

### Argument par type de partenaire

| Partenaire | Argument principal |
|------------|-------------------|
| Station essence Total/Puma | "Vos clients Bolamu viennent 2x/mois au lieu d'une — votre volume augmente sans pub supplémentaire" |
| Hôtel / spa | "Vous accédez au segment premium que Facebook ne vous donne pas" |
| Agence immobilière | "Seul acteur immobilier à Brazzaville associé à un avantage concret pour le locataire" |
| Restaurant gastronomique | "Vos tables vides le lundi-mardi se remplissent avec des clients qui ont le pouvoir d'achat pour revenir" |
| Salon coiffure / beauté | "Vos créneaux creux deviennent rentables — vous ne payez que sur les clients effectivement venus" |
| Boutique skincare / parfumerie | "Accès au segment féminin actif avec pouvoir d'achat — profil identique à votre cliente idéale" |

---

## 8. Séquence de déploiement sans levée de fonds

### Phase 0 — 0 à 1 000 adhérents
- Zora Points gamifiés existent dès le premier jour (ça ne coûte rien techniquement)
- Zoro Cash MoMo non activé — les points s'accumulent "en banque"
- Communication : "Vos points s'accumulent dès maintenant. Les premières récompenses Zora Cash seront débloquées au lancement officiel [date]."
- Partenaires : 2 à 3 partenaires test gratuit (connaissances, petits commerces)
- Financement : Wellness B2B (BRASCO) finance les premiers vrais Zora Cash dès signature

### Phase 1 — 1 000 à 5 000 adhérents
- Paliers Argent et Or activés avec Zora Cash MoMo réel
- MFR + commission en place chez 10 à 15 partenaires
- Wellness B2B finance pool Platine
- Reporting basique partenaires disponible

### Phase 2 — 5 000 à 20 000 adhérents
- Platine pleinement actif
- Campagnes ciblées monétisées (150 000 à 300 000 FCFA/campagne)
- Forfaits marketing partenaires activés
- La donnée devient un produit structurant

---

## 9. Règles absolues — ne jamais enfreindre

### Interdictions strictes

- **Pas de détention de fonds** : agrément BEAC requis. MTN et Airtel sont le rail financier obligatoire. Bolamu calcule les droits Zora, MTN/Airtel exécutent les virements.
- **Pas de crédit revolving** : ne jamais lier Zora à du crédit ou du financement.
- **Pas de système pyramidal** : jamais faire payer une adhésion "Premium" ou un droit d'entrée. Le parrainage est gratuit.
- **Pas de valeur FCFA publique du point** : toujours la récompense concrète, jamais "1 Zora = X FCFA".
- **Pas de points sans preuve système** : zéro déclaratif non vérifiable automatiquement.
- **Pas de pool illimité** : budget Zora Cash plafonné à % fixe des revenus trimestriels.
- **Pas de vente de données personnelles** : Bolamu ne vend jamais les données individuelles des adhérents. Seuls les rapports agrégés et anonymisés sont monétisés en Phase 2+. Conformité CNPD Congo obligatoire.

### Règles positives

- Le partenaire ne perd jamais rien en Phase 1 : il finance sa remise sur son budget marketing, Bolamu prend commission sur transaction réelle uniquement.
- La beauté et le bien-être lifestyle sont des récompenses en priorité, pas des actes majeurs générateurs de points.
- Le Zora Cash MoMo est non négociable dans le système : c'est le mécanisme viral principal au Congo.
- Le Platine doit rester aspirationnel et rare (5% des adhérents maximum).

---

## 10. Lexique interne

| Terme | Définition |
|-------|-----------|
| Zora Points | Compteur d'activité bien-être, reset trimestriel |
| Zora Cash | Valeur FCFA créditée MoMo en fin de trimestre selon palier |
| MFR | Merchant Funded Rewards — remise financée par le partenaire sur son budget marketing |
| Breakage | Part des Zora Cash jamais réclamés (15–25%) — réduction naturelle du coût réel du pool |
| Pool Zora | Budget trimestriel Bolamu alloué au Zora Cash MoMo |
| Wellness B2B | Revenus entreprises (BRASCO etc.) qui financent le pool Platine |
| ICP | Index de Capacité de Production — indicateur agrégé B2B calculé via score HPQ |
| CDR | Contribution de Disponibilité Réseau — frais fixe mensuel Bolamu aux partenaires cliniques/labos/pharmacies |

---

*Zora en une phrase : la première infrastructure de bien-être lifestyle au Congo — chaque acte de santé, de beauté ou d'activité physique se convertit en pouvoir d'achat réel chez les enseignes qui comptent dans la vie quotidienne du Congolais.*
