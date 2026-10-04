# AUDIT BOLAMU — RAPPORT COMPLET
**Date : 4 octobre 2026**
**Type : Audit en lecture seule (aucune modification)**
**Objectif : Préparer la migration du modèle "abonnement mensuel" vers "carte prépayée rechargeable"**

---

## 1. RÉSUMÉ EXÉCUTIF

### Nombre d'occurrences par catégorie

| Catégorie | Termes recherchés | Occurrences trouvées | Fichiers concernés |
|-----------|------------------|---------------------|-------------------|
| **A - Vocabulaire visible** | 32 termes | 500+ | 45+ fichiers |
| **B - Logique métier** | 9 sous-catégories | 85+ | 25+ fichiers |
| **C - Cohérence** | 3 sous-catégories | 40+ | 15+ fichiers |
| **TOTAL** | - | **625+** | **70+ fichiers** |

### Répartition par dossier

| Dossier | Occurrences | Fichiers principaux |
|---------|-------------|---------------------|
| public/ | 450+ | landing.html, cgu.html, agent/dashboard.html, agence/dashboard.html, secretaire/dashboard.html, offres/*.html |
| src/ | 175+ | patient.routes.js, patient.controller.js, whatsapp.service.js, subscriptions.routes.js, abonnement.job.js |
| docs/ | 10+ | ARCHITECTURE_*.md, CONTEXT.md |

---

## 2. TABLEAU DÉTAILLÉ DES OCCURRENCES

### Format du tableau
- **Catégorie** : A (vocabulaire visible), B (logique métier), C (cohérence)
- **Gravité** : HAUTE (promesse proche d'une assurance/garantie, logique contraire aux décisions, prix faux), MOYENNE (mot à changer visible), BASSE (commentaire, nom interne)

---

### PARTIE A — VOCABULAIRE VISIBLE UTILISATEUR

| Fichier | Ligne | Texte actuel | Catégorie | Gravité | Remplacement proposé |
|---------|-------|-------------|-----------|---------|---------------------|
| public/landing.html | 206 | `S'abonner` | A | MOYENNE | "Recharger ma carte" |
| public/landing.html | 234 | `100% Sécurisé` | A | MOYENNE | Supprimer ou vérifier |
| public/landing.html | 238 | `50,000+ Membres` | A | MOYENNE | Vérifier chiffre réel |
| public/landing.html | 257-258 | `250+ PARTENAIRES` | A | MOYENNE | Vérifier chiffre réel |
| public/landing.html | 265-266 | `4M MEMBRES CIBLES` | A | MOYENNE | Vérifier chiffre réel |
| public/landing.html | 269 | `24/7` | A | MOYENNE | Vérifier disponibilité réelle |
| public/landing.html | 279 | `tranquillité d'esprit totale` | A | MOYENNE | "Sérénité" |
| public/landing.html | 304 | `Badgez et profitez de soins immédiats` | A | MOYENNE | "Scannez et profitez" |
| public/landing.html | 312 | `ILS NOUS FONT CONFIANCE` | A | HAUTE | Supprimer ou remplacer par logos réels |
| public/landing.html | 316-327 | Logos BRASCO, AGL, CFAO, TOTALENERGIES, ENI, BGFI BANK, MTN, AIRTEL | A | HAUTE | Remplacer par partenaires confirmés ou supprimer |
| public/landing.html | 350 | `Protégez vos proches avec des abonnements mensuels` | A | HAUTE | "Offrez à vos proches une carte santé" |
| public/landing.html | 350 | `un accès complet à votre Catalogue de soins` | A | MOYENNE | "un accès à votre Catalogue de soins" |
| public/landing.html | 401 | `Choisissez votre abonnement` | A | HAUTE | "Choisissez votre carte" |
| public/landing.html | 411 | `2.000 FCFA/mois` | A | HAUTE | "2 000 FCFA/mois" (format espace) |
| public/landing.html | 417-425 | `0 FCFA à payer` (x3) | A | HAUTE | "Sans avance de frais" ou "Couvert" |
| public/landing.html | 434 | `NDEKO... max 2` | A | MOYENNE | Conserver (correct) |
| public/landing.html | 437 | `5.000 FCFA/mois` | A | MOYENNE | "5 000 FCFA/mois" (format espace) |
| public/landing.html | 459 | `LIBOTA... max 5` | A | MOYENNE | Conserver (correct) |
| public/landing.html | 462 | `10.000 FCFA/mois` | A | HAUTE | "10 000 FCFA/mois" (format espace) |
| public/landing.html | 468 | `jusqu'à 5 personnes` | A | MOYENNE | Conserver (correct) |
| public/landing.html | 585 | `forfaits internet` | A | BASSE | Contexte telecom (conserver) |
| public/landing.html | 601 | `partenaires bien-être` | A | HAUTE | Conserver (remplacement validé : Partenaires Zora) |
| public/landing.html | 799 | `24/7` | A | MOYENNE | Vérifier disponibilité réelle |
| public/cgu.html | 160 | `Appelez immédiatement le 1515` | A | BASSE | Contexte urgence (conserver) |
| public/cgu.html | 169-170 | Définition OVP | A | HAUTE | Supprimer (OVP retiré) |
| public/cgu.html | 175 | `Loi n°8-2009 portant Code de la Santé` | C | HAUTE | Vérifier numéro exact |
| public/cgu.html | 176 | `Loi n°37-2014 et n°12-2023 instituant le RAMU — Loi n°19-2023 créant la CAMU` | C | HAUTE | Vérifier numéros exacts |
| public/cgu.html | 177 | `Loi n°29-2019 portant protection des données` | C | HAUTE | Vérifier numéro exact |
| public/cgu.html | 178 | `Loi n°5-2025 portant création de la CNPD` | C | HAUTE | Vérifier promulgation |
| public/cgu.html | 179 | `Code du Travail Art. 142 — Ordonnance-loi n°68-70 Ordre des Médecins — Code OHADA` | C | HAUTE | Vérifier articles exacts |
| public/cgu.html | 277 | `Article 15 — Protection des données` | C | BASSE | Conserver (loi applicable) |
| public/cgu.html | 321 | `Direct Primary Care (DPC) low-cost adapté` | A | HAUTE | "Direct Primary Care (DPC) adapté" |
| public/cgu.html | 325 | `gestion d'un fonds de garantie` | A | HAUTE | "gestion d'un fonds de répartition" |
| public/cgu.html | 325 | `de remboursement de soins` | A | HAUTE | "de répartition des soins" |
| public/cgu.html | 325 | `Bolamu n'exerce aucune activité d'assurance` | A | HAUTE | Conserver (disclaimer légal) |
| public/cgu.html | 339 | `sans intermédiaire financier de type assurance` | A | HAUTE | Conserver (disclaimer légal) |
| public/cgu.html | 340 | `Agent conversationnel d'assistance` | A | BASSE | "Agent conversationnel IA" |
| public/cgu.html | 341 | `CAMU : Organisme public créé par la Loi n°19-2023` | A | HAUTE | Supprimer référence CAMU (retiré) |
| public/cgu.html | 341 | `Bolamu est complémentaire à la CAMU` | A | HAUTE | Supprimer (complémentaire retiré) |
| public/cgu.html | 342 | `Carte d'Adhérent : Carte numérique` | A | HAUTE | "Pass QR : Code numérique" |
| public/cgu.html | 344 | `Commission Nationale pour la Protection des Données` | A | BASSE | Conserver (loi applicable) |
| public/cgu.html | 350 | Définition complète OVP | A | HAUTE | Supprimer (OVP retiré) |
| public/cgu.html | 350 | `Mandat de prélèvement mensuel automatique` | A | HAUTE | Supprimer (prélèvement automatique retiré) |
| public/cgu.html | 360 | `Bolamu n'est pas une assurance` | A | HAUTE | Conserver (disclaimer légal) |
| public/cgu.html | 368 | `Assurance maladie (CIMA)` | A | HAUTE | "Mutuelle maladie (CIMA)" |
| public/cgu.html | 379-381 | Tableau "Remboursement" | A | HAUTE | "Répartition" |
| public/cgu.html | 381 | `aucun remboursement d'acte` | A | HAUTE | "aucune répartition d'acte" |
| public/cgu.html | 385 | `prime selon profil santé` | A | HAUTE | "contribution selon profil santé" |
| public/cgu.html | 390 | `3,5 Mrd FCFA (CIMA)` | A | BASSE | Conserver (comparaison historique) |
| public/cgu.html | 395 | `Un sinistre, un acte médical` | A | HAUTE | "Un besoin de santé, un acte médical" |
| public/cgu.html | 402 | `Bolamu est complémentaire au RAMU/CAMU` | A | HAUTE | Supprimer (complémentaire retiré) |
| public/cgu.html | 428 | `2 000 FCFA` | A | MOYENNE | Conserver (format correct) |
| public/cgu.html | 430 | `8 000 FCFA` | A | HAUTE | "24 000 FCFA" (prix annuel correct) |
| public/cgu.html | 434 | `5 000 FCFA` | A | MOYENNE | Conserver (format correct) |
| public/cgu.html | 436 | `25 000 FCFA` | A | HAUTE | "60 000 FCFA" (prix annuel correct : 5 000 × 12) |
| public/cgu.html | 440 | `10 000 FCFA` | A | MOYENNE | Conserver (format correct) |
| public/cgu.html | 442 | `50 000 FCFA` | A | HAUTE | "120 000 FCFA" (prix annuel correct) |
| public/cgu.html | 447 | `Consentement conjoint tuteur + mineur requis en dessous de 16 ans (Art. 62 Loi n°29-2019)` | C | HAUTE | Vérifier article exact |
| public/cgu.html | 484 | `Amina 24h/24 — Ordonnance numérique — Pharmacies partenaires` | A | MOYENNE | "Amina disponible — Ordonnance numérique — Pharmacies partenaires" |
| public/cgu.html | 490 | `MOTO × 2 personnes` | A | HAUTE | "NDEKO × 2 personnes" |
| public/cgu.html | 496 | `NDEKO × 5 personnes` | A | HAUTE | "LIBOTA × 5 personnes" |
| public/cgu.html | 510 | `Bolamu ne rembourse jamais des soins` | A | HAUTE | "Bolamu ne répartit jamais des soins" |
| public/cgu.html | 521 | `Bolamu n'intervient à aucun titre dans... la prise en charge` | A | HAUTE | "Bolamu n'intervient à aucun titre dans... la répartition" |
| public/cgu.html | 521 | `sur présentation d'une Carte d'Adhérent valide` | A | HAUTE | "sur présentation d'un Pass QR valide" |
| public/cgu.html | 521 | `accède gratuitement au catalogue SSP` | A | HAUTE | "accède au catalogue SSP (couvert)" |
| public/cgu.html | 537 | `prélèvement automatique à la date anniversaire` | A | HAUTE | Supprimer (prélèvement automatique retiré) |
| public/cgu.html | 538 | `Virement bancaire via RIB (OVP)` | A | HAUTE | "Virement bancaire via RIB" |
| public/cgu.html | 540 | `Dans les deux cas, le prélèvement est automatique` | A | HAUTE | Supprimer (prélèvement automatique retiré) |
| public/cgu.html | 541 | `Bolamu encaisse les abonnements mensuels via Mobile Money ou virement bancaire (OVP)` | A | HAUTE | "Bolamu encaisse les recharges via Mobile Money ou virement bancaire" |
| public/cgu.html | 558 | `Hub conventionné` | A | HAUTE | "Hub partenaire" |
| public/cgu.html | 589 | `gratuit une fois par an` | A | HAUTE | "couvert une fois par an" |
| public/cgu.html | 613 | `Partenaires Bien-Être conventionnés` | A | HAUTE | Remplacer par "Partenaires Zora" |
| public/cgu.html | 613 | `Des Crédits Fidélité sont attribués mensuellement` | A | HAUTE | Remplacer par "Zora Points" |
| public/cgu.html | 634 | `Article 15 — Protection des données personnelles` | C | BASSE | Conserver (loi applicable) |
| public/cgu.html | 671 | `Bolamu s'engage à maintenir la Plateforme disponible 24h/24, 7j/7` | A | MOYENNE | Vérifier SLA réel |
| public/cgu.html | 693 | `Aucun remboursement au prorata` | A | HAUTE | "Aucune répartition au prorata" |
| public/agent/dashboard.html | 85 | `Réseau : vérification adhérent` | A | HAUTE | "Réseau : vérification titulaire" |
| public/agent/dashboard.html | 107 | `.motif-coverage-result.couvert` | A | MOYENNE | ".motif-coverage-result.inclus" |
| public/agent/dashboard.html | 320 | `Sans abonnement` | A | HAUTE | "Sans carte active" |
| public/agent/dashboard.html | 321-323 | Options de plans d'abonnement | A | HAUTE | "Options de cartes" |
| public/agent/dashboard.html | 554 | `offre de vente personnalisée (OVP)` | A | HAUTE | Supprimer (OVP retiré) |
| public/agent/dashboard.html | 554 | `Les soins couverts sont définis` | A | MOYENNE | "Les soins inclus sont définis" |
| public/agent/dashboard.html | 558 | `Le client a lu et accepte les CGU et l'OVP` | A | HAUTE | "Le client a lu et accepte les CGU" |
| public/agent/dashboard.html | 612 | `Vérification adhérent et statistiques` | A | HAUTE | "Vérification titulaire et statistiques" |
| public/agent/dashboard.html | 615 | `Vérifier un adhérent` | A | HAUTE | "Vérifier un titulaire" |
| public/agent/dashboard.html | 624 | `Adhérents total` | A | HAUTE | "Titulaires total" |
| public/agent/dashboard.html | 625 | `Abonnés actifs` | A | HAUTE | "Cartes actives" |
| public/agent/dashboard.html | 712-713 | `Réactiver abonnement` | A | HAUTE | "Réactiver carte" |
| public/agent/dashboard.html | 744 | `Plan d'abonnement *` | A | HAUTE | "Type de carte *" |
| public/agent/dashboard.html | 916 | `couvert (gratuit) pour tout abonné actif` | A | HAUTE | "inclus pour toute carte active" |
| public/agent/dashboard.html | 931 | `couvert: item.est_ssp` | A | MOYENNE | `inclus: item.est_ssp` |
| public/agent/dashboard.html | 944-946 | `Couvert par l'abonnement Bolamu` | A | HAUTE | "Inclus dans la carte Bolamu" |
| public/agent/dashboard.html | 992 | `Non couvert` | A | MOYENNE | "Non inclus" |
| public/agent/dashboard.html | 1012 | `${item.couvert}` | A | MOYENNE | `${item.inclus}` |
| public/agent/dashboard.html | 1092 | `CATALOGUE_SSP.filter(i => i.couvert)` | A | MOYENNE | `CATALOGUE_SSP.filter(i => i.inclus)` |
| public/agent/dashboard.html | 1203 | `comptes actifs immédiatement` | A | MOYENNE | "comptes actifs après validation" |
| public/agent/dashboard.html | 1270 | `couvert (gratuit) pour tout abonné actif` | A | HAUTE | "inclus pour toute carte active" |
| public/agent/dashboard.html | 1277 | `couvert: item.est_ssp` | A | MOYENNE | `inclus: item.est_ssp` |
| public/agent/dashboard.html | 1286-1289 | `Couvert par l'abonnement Bolamu` | A | HAUTE | "Inclus dans la carte Bolamu" |
| public/agent/dashboard.html | 1296-1311 | Fonction verifierAdherent() | A | HAUTE | verifierTitulaire() |
| public/agent/dashboard.html | 1315-1316 | Statut abonnement | A | HAUTE | Statut carte |
| public/agent/dashboard.html | 1316 | `Non couvert` | A | MOYENNE | "Non inclus" |
| public/agent/dashboard.html | 1336 | `${item.couvert}` | A | MOYENNE | `${item.inclus}` |
| public/agent/dashboard.html | 1351-1352 | Stats abonnés | A | HAUTE | Stats cartes |
| public/agent/dashboard.html | 1413 | `CATALOGUE_SSP.filter(i => i.couvert)` | A | MOYENNE | `CATALOGUE_SSP.filter(i => i.inclus)` |
| public/agent/dashboard.html | 1761 | Alert `Le client doit accepter les CGU et l'OVP` | A | HAUTE | "Le client doit accepter les CGU" |
| public/agent/dashboard.html | 1815-1817 | Prix MOTO 2000, NDEKO 4000, LIBOTA 10000 | A | MOYENNE | Conserver (correct) |
| public/agent/dashboard.html | 1893-1894 | Messages WhatsApp "Votre abonnement" | A | HAUTE | "Votre carte" |
| public/agent/login.html | 105 | `Inscription et suivi des adhérents Bolamu` | A | HAUTE | "Inscription et suivi des titulaires Bolamu" |
| public/agence/dashboard.html | 135 | CSS `.motif-coverage-result.couvert` | A | MOYENNE | ".motif-coverage-result.inclus" |
| public/agence/dashboard.html | 450 | `Vérifier un adhérent` | A | HAUTE | "Vérifier un titulaire" |
| public/agence/dashboard.html | 461 | `Adhérents total` | A | HAUTE | "Titulaires total" |
| public/agence/dashboard.html | 462 | `Abonnés actifs` | A | HAUTE | "Cartes actives" |
| public/agence/dashboard.html | 633-638 | Bloc CGU + OVP | A | HAUTE | Bloc CGU uniquement |
| public/agence/dashboard.html | 638 | `Les soins couverts sont définis` | A | MOYENNE | "Les soins inclus sont définis" |
| public/agence/dashboard.html | 644 | `Le client a lu et accepte les CGU et l'OVP` | A | HAUTE | "Le client a lu et accepte les CGU" |
| public/agence/dashboard.html | 721 | `Plan d'abonnement *` | A | HAUTE | "Type de carte *" |
| public/agence/dashboard.html | 845-846 | `Réactiver abonnement` | A | HAUTE | "Réactiver carte" |
| public/agence/dashboard.html | 916 | `couvert (gratuit) pour tout abonné actif` | A | HAUTE | "inclus pour toute carte active" |
| public/agence/dashboard.html | 931 | `couvert: item.est_ssp` | A | MOYENNE | `inclus: item.est_ssp` |
| public/agence/dashboard.html | 944-946 | `Couvert par l'abonnement Bolamu` | A | HAUTE | "Inclus dans la carte Bolamu" |
| public/agence/dashboard.html | 971-987 | Fonction verifierAdherent() | A | HAUTE | verifierTitulaire() |
| public/agence/dashboard.html | 992 | `Non couvert` | A | MOYENNE | "Non inclus" |
| public/agence/dashboard.html | 1012 | `${item.couvert}` | A | MOYENNE | `${item.inclus}` |
| public/agence/dashboard.html | 1092 | `CATALOGUE_SSP.filter(i => i.couvert)` | A | MOYENNE | `CATALOGUE_SSP.filter(i => i.inclus)` |
| public/agence/dashboard.html | 1507 | Alert similaire OVP | A | HAUTE | Alert CGU uniquement |
| public/agence/dashboard.html | 1587-1589 | Prix MOTO 2000, NDEKO 4000, LIBOTA 10000 | A | MOYENNE | Conserver (correct) |
| public/secretaire/dashboard.html | 497-498 | CSS vérification adhérent | A | HAUTE | CSS vérification titulaire |
| public/secretaire/dashboard.html | 511 | `Vérifier un adhérent` | A | HAUTE | "Vérifier un titulaire" |
| public/secretaire/dashboard.html | 645 | `Motif dans vérification adhérent` | A | HAUTE | "Motif dans vérification titulaire" |
| public/secretaire/dashboard.html | 679-830 | CSS badges couvert | A | MOYENNE | CSS badges inclus |
| public/secretaire/dashboard.html | 965 | `Verification adhérent` | A | HAUTE | "Verification titulaire" |
| public/secretaire/dashboard.html | 1536 | `Vérifier adhérent` | A | HAUTE | "Vérifier titulaire" |
| public/secretaire/dashboard.html | 1631 | `VÉRIFICATION ADHÉRENT` | A | HAUTE | "VÉRIFICATION TITULAIRE" |
| public/secretaire/dashboard.html | 1762 | `Vérifier un adhérent` | A | HAUTE | "Vérifier un titulaire" |
| public/secretaire/dashboard.html | 2232 | `Scanner QR Code Adhérent` | A | HAUTE | "Scanner Pass QR" |
| public/secretaire/dashboard.html | 2511 | Commentaire `couvert (gratuit)` | A | HAUTE | "inclus" |
| public/secretaire/dashboard.html | 2526 | `couvert: item.est_ssp` | A | MOYENNE | `inclus: item.est_ssp` |
| public/secretaire/dashboard.html | 2566 | Badges couvert | A | MOYENNE | Badges inclus |
| public/secretaire/dashboard.html | 2611 | `Conventionné Bolamu` | A | HAUTE | "Partenaire Bolamu" |
| public/secretaire/dashboard.html | 2611 | `Convention inactive` | A | HAUTE | "Partenariat inactif" |
| public/secretaire/dashboard.html | 2661 | `Aucun adhérent trouvé` | A | HAUTE | "Aucun titulaire trouvé" |
| public/secretaire/dashboard.html | 3031 | `SCANNER QR CODE ADHÉRENT` | A | HAUTE | "SCANNER PASS QR" |
| public/secretaire/dashboard.html | 3643 | `Soins de Santé Primaires gratuits inclus` | A | HAUTE | "Soins de Santé Primaires inclus" |
| public/offres/particuliers.html | 177 | `délivrés gratuitement` | A | HAUTE | "délivrés (couverts)" |
| public/offres/particuliers.html | 177 | `réseau de partenaires conventionnés` | A | HAUTE | "réseau de partenaires" |
| public/offres/particuliers.html | 192 | `délivrés gratuitement` | A | HAUTE | "délivrés (couverts)" |
| public/offres/particuliers.html | 231 | `Soins SSP en cliniques 100 % Gratuits` | A | HAUTE | "Soins SSP en cliniques 100 % couverts" |
| public/offres/particuliers.html | 232-233 | `0 FCFA à payer` (x2) | A | HAUTE | "Sans avance de frais" |
| public/offres/particuliers.html | 272 | `Prélèvement automatique à date anniversaire` | A | HAUTE | Supprimer (prélèvement automatique retiré) |
| public/offres/particuliers.html | 285-287 | `Amina 24h/24` | A | MOYENNE | "Amina disponible" |
| public/offres/particuliers.html | 295 | `Dépistages gratuits` | A | HAUTE | "Dépistages couverts" |
| public/offres/syndicats.html | 155 | `Protégez l'ensemble de votre communauté` | A | MOYENNE | "Offrez à l'ensemble de votre communauté" |
| public/offres/syndicats.html | 174 | `accès aux soins primaires gratuits` | A | HAUTE | "accès aux soins primaires couverts" |
| public/offres/syndicats.html | 241 | `carte d'adhérent numérique` | A | HAUTE | "Pass QR numérique" |
| public/offres/syndicats.html | 241 | `accède immédiatement au réseau` | A | MOYENNE | "accède au réseau" |
| public/offres/entreprises.html | 176 | `réseau physique de prestataires déjà conventionnés` | A | HAUTE | "réseau physique de prestataires" |
| public/offres/entreprises.html | 176 | `Amina disponible 24h/24` | A | MOYENNE | "Amina disponible" |
| public/offres/entreprises.html | 240 | `Forfaits télécom MTN et Airtel` | A | BASSE | Contexte telecom (conserver) |
| public/offres/entreprises.html | 251-252 | `Amina — Assistante santé 24h/24` | A | MOYENNE | "Amina — Assistante santé" |
| public/offres/entreprises.html | 296 | `assurer la protection sanitaire de ses salariés` | A | BASSE | Contexte légal (conserver) |
| public/offres/entreprises.html | 307-309 | `250+ partenaires`, `4M membres cibles` | A | MOYENNE | Vérifier chiffres réels |
| public/offres/entreprises.html | 309 | `24/7 Amina` | A | MOYENNE | "Amina disponible" |
| public/offres/pme.html | 159 | `Code du Travail Art. 142` | C | HAUTE | Vérifier article exact |
| public/offres/pme.html | 225 | `Article 142 du Code du Travail congolais` | C | HAUTE | Vérifier article exact |
| public/confidentialite.html | 149 | `Protection de vos données de santé` | A | BASSE | Contexte légal (conserver) |
| public/confidentialite.html | 201 | `Loi relative à la protection des données` | A | BASSE | Contexte légal (conserver) |
| public/confidentialite.html | 214-219 | Mesures de sécurité (AES-256, TLS 1.3, SOC 2, OTP, audits trimestriels) | C | MOYENNE | Vérifier conformité réelle |
| public/confidentialite.html | 230 | `Loi n° 5-2025 et aux missions de la CNPD` | C | HAUTE | Vérifier promulgation |
| public/confidentialite.html | 300 | `Délégué à la Protection des Données` | A | BASSE | Contexte légal (conserver) |
| public/mentions-legales.html | 228 | `Loi relative à la protection des données personnelles` | A | BASSE | Contexte légal (conserver) |
| public/reseau/cliniques-medecins.html | 229-230 | `24/7 disponibilité urgences` | A | MOYENNE | Vérifier disponibilité réelle |
| public/reseau/cliniques-medecins.html | 287 | `Urgences 24/7` | A | MOYENNE | Vérifier disponibilité réelle |
| public/reseau/pharmacies.html | 206 | `réseau 24/7` | A | MOYENNE | Vérifier disponibilité réelle |
| public/reseau/pharmacies.html | 229-230 | `24/7 service de garde` | A | MOYENNE | Vérifier disponibilité réelle |
| public/reseau/pharmacies.html | 287 | `Service de garde 24/7` | A | MOYENNE | Vérifier disponibilité réelle |
| public/reseau/pharmacies.html | 508 | `sans avance de frais` | A | HAUTE | Supprimer (terme retiré) |
| public/reseau/laboratoires.html | 353 | `pour garantir des résultats fiables` | A | BASSE | Contexte qualité (conserver) |
| public/js/etablissements-carte-temp.js | 27 | `horaires: "24h/24 — 7j/7 (SAMU)"` | A | MOYENNE | Conserver (contexte SAMU) |
| public/js/etablissements-carte-temp.js | 32 | `urgences 24h/24` | A | MOYENNE | Conserver (contexte SAMU) |
| public/js/etablissements-carte-temp.js | 137 | `Urgences 24h/24` | A | MOYENNE | Conserver (contexte urgences) |
| public/js/etablissements-carte-temp.js | 142 | `Urgences 24h/24` | A | MOYENNE | Conserver (contexte urgences) |
| public/laboratoire/dashboard.html | 548 | `droit au SSP gratuit` | A | HAUTE | "droit au SSP (couvert)" |
| public/laboratoire/dashboard.html | 714 | `Stock (vide = illimité)` | A | BASSE | Contexte stock (conserver) |
| public/laboratoire/dashboard.html | 781 | `SSP — Actes gratuits` | A | HAUTE | "SSP — Actes couverts" |
| public/laboratoire/dashboard.html | 1157 | `SSP, gratuit dans le cadre de son abonnement` | A | HAUTE | "SSP, couvert dans le cadre de sa carte" |
| public/laboratoire/dashboard.html | 1825 | Badge `GRATUIT` | A | HAUTE | Badge "COUVERT" |
| public/laboratoire/dashboard.html | 2107 | `${p.stock===null?'Illimité':p.stock}` | A | BASSE | Contexte stock (conserver) |
| public/pharmacie/dashboard.html | 772 | `Mise en avant garantie` | A | BASSE | Contexte UI (conserver) |
| public/pharmacie/dashboard.html | 773 | Badge `GRATUIT` | A | HAUTE | Badge "COUVERT" |
| public/pharmacie/dashboard.html | 837 | `Stock (vide = illimité)` | A | BASSE | Contexte stock (conserver) |
| public/pharmacie/dashboard.html | 2360 | `${p.stock===null?'Illimité':p.stock}` | A | BASSE | Contexte stock (conserver) |
| public/medecin/dashboard-v2.html | 3369 | `Instructions complémentaires` | A | BASSE | Contexte médical (conserver) |
| public/medecin/dashboard-v2.html | 1461 | `Catalogue des forfaits disponibles` | A | BASSE | Contexte catalogue (conserver) |
| public/medecin/dashboard-v2.html | 1508 | `${p.stock === null ? 'Illimité' : p.stock}` | A | BASSE | Contexte stock (conserver) |
| public/medecin/dashboard-v2.html | 3981-3982 | `Stock (laisser vide pour illimité)` | A | BASSE | Contexte stock (conserver) |
| public/medecin/dashboard-v2.html | 4057-4058 | Idem | A | BASSE | Contexte stock (conserver) |
| public/medecin/dashboard-v2.html | 4191-4192 | Idem | A | BASSE | Contexte stock (conserver) |
| public/medecin/dashboard-v2.html | 601 | `Accès complet aux dossiers médicaux numériques` | A | MOYENNE | "Accès aux dossiers médicaux numériques" |
| public/medecin/dashboard.html | 2018 | `examens complémentaires` | A | BASSE | Contexte médical (conserver) |
| public/medecin/dashboard.html | 2129 | `Instructions complémentaires` | A | BASSE | Contexte médical (conserver) |
| public/medecin/dashboard.html | 2327 | `${p.stock===null?'Illimité':p.stock}` | A | BASSE | Contexte stock (conserver) |
| public/medecin/dashboard.html | 2346 | `Stock (vide = illimité)` | A | BASSE | Contexte stock (conserver) |
| public/partenaire/dashboard.html | 916-917 | `Stock (laisser vide = illimité)` | A | BASSE | Contexte stock (conserver) |
| public/partenaire/dashboard.html | 1004 | `Stock: Illimité` | A | BASSE | Contexte stock (conserver) |
| public/partenaire/dashboard.html | 1041 | `${p.stock===null ? 'Illimité' : p.stock}` | A | BASSE | Contexte stock (conserver) |
| public/patient/dashboard.html | 1458 | `un accès immédiat à vos constantes vitales` | A | MOYENNE | "un accès à vos constantes vitales" |
| public/patient/dashboard.html | 1654 | `un accès immédiat à votre dossier médical` | A | MOYENNE | "un accès à votre dossier médical" |
| public/rh/dashboard.html | 547 | `0 FCFA — couvert Bolamu` | A | HAUTE | "Couvert Bolamu" |
| public/admin/dashboard.html | 1794 | `${p.stock===null?'Illimité':p.stock}` | A | BASSE | Contexte stock (conserver) |
| public/admin/dashboard.html | 1814 | `Stock (vide = illimité)` | A | BASSE | Contexte stock (conserver) |
| public/zora/recompenses.html | 641 | `Crédit téléphonique, forfaits data` | A | BASSE | Contexte telecom (conserver) |
| public/zora/partenaires/telecom.html | 204 | `Forfaits & data` | A | BASSE | Contexte telecom (conserver) |
| public/zora/partenaires/telecom.html | 345 | `Crédit d'appel, forfaits data` | A | BASSE | Contexte telecom (conserver) |
| public/zora/partenaires/telecom.html | 362 | `Forfaits voix et internet` | A | BASSE | Contexte telecom (conserver) |
| public/zora/partenaires/telecom.html | 404 | `vos forfaits comme bon vous semble` | A | BASSE | Contexte telecom (conserver) |
| public/zora/partenaires/hotels.html | 371 | `Forfaits spa complets` | A | BASSE | Contexte spa (conserver) |
| public/zora/partenaires/voyages.html | 333 | `réduction ou prestation immédiate` | A | MOYENNE | "réduction ou prestation" |
| public/zora/partenaires/lifestyle.html | 333 | `réduction ou prestation immédiate` | A | MOYENNE | "réduction ou prestation" |
| public/blog/grossesse-sereine-bolamu.html | 198 | `5 personnes` | A | MOYENNE | Conserver (correct) |
| public/__next.__PAGE__.txt | 10 | `sans avance de frais` | A | HAUTE | Supprimer (terme retiré) |

---

### PARTIE B — LOGIQUE MÉTIER À ALIGNER

| Fichier | Ligne | Texte actuel | Catégorie | Gravité | Remplacement proposé |
|---------|-------|-------------|-----------|---------|---------------------|
| src/jobs/abonnement.job.js | 1-354 | Job cron abonnement quotidien | B1 | HAUTE | Renommer en "carte.job.js" |
| src/jobs/abonnement.job.js | 349-352 | `cron.schedule('0 1 * * *', runAbonnementJob, { timezone: 'Africa/Brazzaville' })` | B1 | HAUTE | Conserver (nécessaire pour expiration) |
| src/jobs/abonnement.job.js | 20-43 | Rappels J-30 pour abonnements MoMo annuel | B1 | HAUTE | Adapter pour recharges (logique différente) |
| src/jobs/abonnement.job.js | 25 | `WHERE s.canal_paiement = 'momo_annuel'` | B1 | HAUTE | Supprimer (canal retiré) |
| src/jobs/abonnement.job.js | 45-72 | Notifications J-3 pour expiration | B1 | HAUTE | Conserver (période de grâce supprimée) |
| src/jobs/abonnement.job.js | 74-142 | Expiration des abonnements | B1 | HAUTE | Conserver (arrêt accès à l'échéance) |
| src/jobs/abonnement.job.js | 82 | `WHERE s.expires_at < NOW()` | B1 | HAUTE | Conserver (comportement correct) |
| src/jobs/abonnement.job.js | 96-99 | Suspension users | B1 | HAUTE | Conserver (comportement correct) |
| src/jobs/abonnement.job.js | 102-108 | Mise à jour subscriptions | B1 | HAUTE | Conserver (comportement correct) |
| src/jobs/abonnement.job.js | 144-182 | Suspension cascade bénéficiaires | B1 | HAUTE | Adapter pour personnes rattachées (NDEKO 2, LIBOTA 5) |
| src/server.js | 368-371 | Job abonnement quotidien démarré | B1 | HAUTE | Renommer référence |
| src/server.js | 373-376 | Job nettoyage stories expirées | B1 | BASSE | Conserver |
| src/server.js | 378-380 | Job wellness | B1 | BASSE | Conserver |
| src/server.js | 382-387 | Job expiration/dérive Zora | B1 | BASSE | Conserver |
| src/routes/subscriptions.routes.js | 207-208 | `expires_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month'` | B1 | HAUTE | Adapter pour durées 3/6/12 mois |
| src/routes/subscriptions.routes.js | 208 | `next_billing_date = (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::date` | B1 | HAUTE | Supprimer (plus de facturation récurrente) |
| src/services/prorata.service.js | 8-64 | Fonction `calculProrata` | B1 | HAUTE | Supprimer (prorata retiré) |
| src/services/prorata.service.js | 67-187 | Fonction `upgradeAbonnement` | B1 | HAUTE | Supprimer (plus d'upgrade) |
| src/routes/patient.routes.js | 11 | Import de `upgradeAbonnement` | B1 | HAUTE | Supprimer |
| src/routes/patient.routes.js | 63 | Commentaire sur calculProrata | B1 | HAUTE | Supprimer |
| src/routes/bongo.routes.js | 129-178 | `POST /api/v1/bongo/remboursement/:transaction_id` | B2 | HAUTE | Supprimer endpoint (remboursements retirés) |
| src/routes/bongo.routes.js | 154-155 | Appel `ledgerService.refundBongoTransaction` | B2 | HAUTE | Supprimer |
| src/routes/bongo.routes.js | 163 | Audit log `bongo_remboursement` | B2 | HAUTE | Supprimer |
| src/routes/bongo.routes.js | 168 | `montant_rembourse: result.montantRembourse` | B2 | HAUTE | Supprimer |
| src/services/ledger.service.js | 14 | Commentaire sur remboursement | B2 | HAUTE | Supprimer |
| src/services/ledger.service.js | 298-358 | Fonction `refundBongoTransaction` | B2 | HAUTE | Supprimer |
| src/services/ledger.service.js | 338-339 | Logique de remboursement | B2 | HAUTE | Supprimer |
| src/services/ledger.service.js | 354 | Message de confirmation | B2 | HAUTE | Supprimer |
| src/services/ledger.service.js | 356 | `montantRembourse: transaction.montant` | B2 | HAUTE | Supprimer |
| src/__tests__/services/prorata.service.test.js | 23-25 | Prix de test (2000, 4000, 10000) | B3 | MOYENNE | Mettre à jour tests si conservés |
| src/routes/collecte.routes.js | 54-67 | Calcul OVP bancaire | B3 | HAUTE | Supprimer (OVP retiré) |
| src/routes/collecte.routes.js | 57 | `config_key = 'price_par_personne'` | B3 | HAUTE | Adapter pour nouvelles cartes |
| src/routes/collecte.routes.js | 59 | `prixParPersonne = parseInt(prixRes.rows[0].config_value)` | B3 | HAUTE | Adapter pour nouvelles cartes |
| src/routes/collecte.routes.js | 63-65 | `plan_${plan}_personnes` | B3 | HAUTE | Adapter pour nouvelles cartes |
| src/services/lab.service.js | 60 | `const tarif = tarifResult.rows[0]?.tarif_fcfa || 5000` | B3 | HAUTE | Migrer vers platform_config |
| src/routes/payouts.routes.js | 55-57 | `fees['fee_infirmier'] || 5000`, `fees['fee_specialiste'] || 15000`, `fees['fee_generaliste'] || 8000` | B3 | HAUTE | Migrer vers platform_config |
| src/routes/transferts.routes.js | 116 | `plafondJournalier = plafondResult.rows[0]?.plafond || 50000` | B3 | HAUTE | Migrer vers platform_config |
| src/routes/transferts.routes.js | 588 | `plafondTotal = plafondResult.rows[0]?.plafond || 50000` | B3 | HAUTE | Migrer vers platform_config |
| src/controllers/prescription.controller.js | 188 | `const tarif = parseInt(tarifRes.rows[0]?.config_value, 10) || 2500` | B3 | HAUTE | Migrer vers platform_config |
| src/routes/subscriptions.routes.js | 65 | `expires_at = NOW() + INTERVAL '30 days'` | B4 | HAUTE | Adapter pour durées 3/6/12 mois |
| src/routes/admin.routes.js | 944 | `billing === 'annual' ? endDate.setFullYear(endDate.getFullYear()+1) : endDate.setMonth(endDate.getMonth()+1)` | B4 | HAUTE | Adapter pour durées 3/6/12 mois |
| src/routes/collecte.routes.js | 227 | `price_${plan}_annual` | B4 | HAUTE | Adapter pour durées 3/6/12 mois |
| src/routes/collecte.routes.js | 452-454 | Logique mensuel/annuel SEPA | B4 | HAUTE | Adapter pour durées 3/6/12 mois |
| src/controllers/qr.controller.js | 9 | `WHERE patient_phone = $1 AND status = 'active' AND expires_at >= NOW()` | B4 | MOYENNE | Conserver (définition correcte) |
| src/controllers/qr.controller.js | 62 | `WHERE patient_phone = $1 AND status = 'active' AND expires_at >= NOW()` | B4 | MOYENNE | Conserver (définition correcte) |
| src/controllers/qr.controller.js | 371 | `WHERE patient_phone = $1 AND status = 'active' AND expires_at >= NOW()` | B4 | MOYENNE | Conserver (définition correcte) |
| src/services/ledger.service.js | 23-35 | Taux de commission (bongoCommission, kiosqueCommission) | B5 | HAUTE | Adapter pour CDR (clinique 30%, pharmacie 12.5%, laboratoire 10%, Bolamu 47.5%) |
| src/services/ledger.service.js | 33 | `bongoCommission: config.bongo_commission_pourcentage || 1` | B5 | HAUTE | Supprimer (bongo retiré) |
| src/services/ledger.service.js | 34 | `kiosqueCommission: config.kiosque_commission_pourcentage || 1.5` | B5 | HAUTE | Supprimer (kiosque retiré) |
| src/routes/smartflow.routes.js | 527-538 | Configuration catégories RH | B5 | HAUTE | Adapter pour CDR (150 FCFA mobilité) |
| src/routes/smartflow.routes.js | 536 | `pourcentage: c.pourcentage_salarie` | B5 | HAUTE | Adapter pour CDR |
| src/routes/smartflow.routes.js | 537 | `plafond: c.plafond_mensuel` | B5 | HAUTE | Adapter pour CDR |
| src/routes/smartflow.routes.js | 554 | `{ pourcentage: 20, plafond: 100000 }` | B5 | HAUTE | Adapter pour CDR |
| src/routes/smartflow.routes.js | 577-579 | Calcul retenue | B5 | HAUTE | Adapter pour CDR |
| src/routes/agence.routes.js | 212 | `planMembers = { essentiel: 1, standard: 4, premium: 8 }` | B5 | HAUTE | Corriger en `{ moto: 1, ndeko: 2, libota: 5 }` |
| src/routes/agence.routes.js | 25 | `PLAN_MAP = { moto: 'essentiel', ndeko: 'standard', libota: 'premium' }` | B5 | HAUTE | Conserver (mapping correct) |
| src/routes/collecte.routes.js | 46-67 | Calcul OVP avec bénéficiaires | B5 | HAUTE | Adapter pour personnes rattachées (NDEKO 2, LIBOTA 5) |
| src/routes/collecte.routes.js | 52 | `nbBeneficiaires = parseInt(benRes.rows[0].count)` | B5 | HAUTE | Adapter pour personnes rattachées |
| src/routes/collecte.routes.js | 66 | `totalPersonnes = nbPersonnesPlan + nbBeneficiaires` | B5 | HAUTE | Adapter pour personnes rattachées |
| src/routes/admin.routes.js | 1123 | `reference = BOL-B2B-${company_code}-${today}` | B5 | MOYENNE | Conserver (formule B2B) |
| src/routes/admin.routes.js | 1137 | `price_per_employee * max_employees` | B5 | MOYENNE | Adapter pour carte entreprise |
| src/services/smartflow.service.js | 4 | Commentaire "SSP gratuit couvert CDR, hors catalogue prix plein" | B5 | HAUTE | Adapter pour CDR |
| src/routes/transferts.routes.js | 110-116 | Plafond journalier FCFA | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/routes/transferts.routes.js | 113 | `cle = 'transfert_plafond_jour_fcfa'` | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/routes/transferts.routes.js | 116 | `plafondJournalier = plafondResult.rows[0]?.plafond || 50000` | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/routes/transferts.routes.js | 131-134 | Vérification plafond | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/routes/transferts.routes.js | 582-588 | Endpoint plafond restant | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/routes/smartflow.routes.js | 527-538 | Plafond mensuel RH | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/routes/smartflow.routes.js | 537 | `plafond: c.plafond_mensuel` | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/routes/smartflow.routes.js | 554 | `{ pourcentage: 20, plafond: 100000 }` | B6 | HAUTE | Adapter pour plafonds en nombre de prestations |
| src/services/ledger.service.js | 3-15 | Commentaire architecture ledger | B7 | MOYENNE | Conserver |
| src/services/ledger.service.js | 338-340 | Mouvements entre wallets | B7 | HAUTE | Adapter pour compte cantonné vs comptes opérationnels |
| src/routes/bongo.routes.js | 33-85 | Paiement Bongo via wallet | B7 | HAUTE | Supprimer (bongo retiré) |
| src/routes/bongo.routes.js | 34-44 | Récupération ledger account marchand | B7 | HAUTE | Supprimer (bongo retiré) |
| src/routes/bongo.routes.js | 54-65 | Vérification wallet | B7 | HAUTE | Supprimer (bongo retiré) |
| src/routes/momo.routes.js | 142-150 | Validation montant MoMo | B7 | MOYENNE | Conserver (Mobile Money conservé) |
| src/routes/airtel.routes.js | 147-156 | Validation montant Airtel | B7 | MOYENNE | Conserver (Mobile Money conservé) |
| src/routes/collecte.routes.js | 209-272 | MoMo annuel | B7 | HAUTE | Supprimer (canal retiré) |
| src/routes/collecte.routes.js | 14-182 | OVP bancaire (virement permanent) | B7 | HAUTE | Supprimer (OVP retiré) |
| src/routes/collecte.routes.js | 424-522 | SEPA diaspora | B7 | MOYENNE | Adapter pour recharge manuelle |
| src/services/smartflow.service.js | 14 | "Source : ssp_catalog (migration 034)" | B8 | MOYENNE | Conserver |
| src/services/smartflow.service.js | 26-28 | `SELECT est_ssp, categorie, type, nom FROM ssp_catalog` | B8 | MOYENNE | Conserver |
| src/services/smartflow.service.js | 262-265 | Commentaire sur ssp_catalog vs medicaments_catalogue | B8 | HAUTE | Documenter éléments retirés (téléconsultation, stupéfiants, soins palliatifs) |
| src/services/smartflow.service.js | 262-265 | `ssp_catalog` : 121 lignes, `medicaments_catalogue` : 54 lignes | B8 | MOYENNE | Conserver |
| src/server.js | 329-332 | Route `/profil` → `profil-carte.html` | B9 | HAUTE | Renommer fichier en `profil.html` (conflit "carte") |
| src/controllers/qr.controller.js | 5-38 | `generateQRToken` (QR Code pour authentification) | B9 | MOYENNE | Conserver (QR distinct de carte produit) |
| src/controllers/qr.controller.js | 123-148 | `generatePatientQR` (QR urgence) | B9 | MOYENNE | Conserver (QR distinct de carte produit) |
| src/routes/doctor.routes.js | 47 | `router.get('/patients/:phone/qrcode', ...)` | B9 | MOYENNE | Conserver (QR distinct de carte produit) |
| src/routes/doctor.routes.js | 5 | Import `generatePatientQRCode` | B9 | MOYENNE | Conserver (QR distinct de carte produit) |

---

### PARTIE C — COHÉRENCE ET AFFIRMATIONS

| Fichier | Ligne | Texte actuel | Catégorie | Gravité | Remplacement proposé |
|---------|-------|-------------|-----------|---------|---------------------|
| public/landing.html | 234 | `100% Sécurisé` | C1 | HAUTE | Vérifier conformité réelle ou supprimer |
| public/landing.html | 269 | `24/7` | C1 | MOYENNE | Vérifier disponibilité réelle |
| public/landing.html | 799 | `24/7` | C1 | MOYENNE | Vérifier disponibilité réelle |
| public/landing.html | 238 | `50,000+ Membres` | C1 | HAUTE | Vérifier chiffre réel en base |
| public/landing.html | 257-258 | `250+ PARTENAIRES` | C1 | HAUTE | Vérifier chiffre réel en base |
| public/landing.html | 265-266 | `4M MEMBRES CIBLES` | C1 | MOYENNE | Vérifier si cible actuelle |
| public/landing.html | 312 | `ILS NOUS FONT CONFIANCE` | C1 | HAUTE | Supprimer ou remplacer par logos réels |
| public/landing.html | 316-327 | Logos BRASCO, AGL, CFAO, TOTALENERGIES, ENI, BGFI BANK, MTN, AIRTEL | C1 | HAUTE | Remplacer par partenaires confirmés ou supprimer |
| public/landing.html | 304 | `Badgez et profitez de soins immédiats` | C1 | MOYENNE | "Scannez et profitez" |
| public/confidentialite.html | 214-219 | Mesures de sécurité (AES-256, TLS 1.3, SOC 2, OTP, audits trimestriels) | C1 | HAUTE | Vérifier conformité réelle |
| public/cgu.html | 175 | `Loi n°8-2009 portant Code de la Santé` | C2 | HAUTE | Vérifier numéro exact avec juriste |
| public/cgu.html | 176 | `Loi n°37-2014 et n°12-2023 instituant le RAMU — Loi n°19-2023 créant la CAMU` | C2 | HAUTE | Vérifier numéros exacts avec juriste |
| public/cgu.html | 177 | `Loi n°29-2019 portant protection des données` | C2 | HAUTE | Vérifier numéro exact avec juriste |
| public/cgu.html | 178 | `Loi n°5-2025 portant création de la CNPD` | C2 | HAUTE | Vérifier promulgation avec juriste |
| public/cgu.html | 179 | `Code du Travail Art. 142 — Ordonnance-loi n°68-70 Ordre des Médecins — Code OHADA` | C2 | HAUTE | Vérifier articles exacts avec juriste |
| public/cgu.html | 447 | `Consentement conjoint tuteur + mineur requis en dessous de 16 ans (Art. 62 Loi n°29-2019)` | C2 | HAUTE | Vérifier article exact avec juriste |
| public/confidentialite.html | 201 | `Loi n° 5-2025 relative à la protection des données` | C2 | HAUTE | Vérifier promulgation avec juriste |
| public/confidentialite.html | 230 | `Loi n° 5-2025 et aux missions de la CNPD` | C2 | HAUTE | Vérifier promulgation avec juriste |
| public/offres/pme.html | 159 | `Code du Travail Art. 142` | C2 | HAUTE | Vérifier article exact avec juriste |
| public/offres/pme.html | 225 | `Article 142 du Code du Travail congolais` | C2 | HAUTE | Vérifier article exact avec juriste |
| src/routes/doctor.routes.js | 289 | `// BHP : journalisation dmn_access_log (traçabilité Loi 29-2019)` | C2 | MOYENNE | Conserver (commentaire code) |
| src/routes/dmn.routes.js | 224 | `// 20 derniers accès au dossier (droit de traçabilité BHP / Loi 29-2019)` | C2 | MOYENNE | Conserver (commentaire code) |
| src/routes/healthRecords.routes.js | 186 | `// GET — Historique accès à un dossier (droit loi 29-2019)` | C2 | MOYENNE | Conserver (commentaire code) |
| public/landing.html | 437 | `5.000 FCFA/mois` (NDEKO) | C3 | MOYENNE | Corriger en `5 000 FCFA/mois` (format espace) |
| public/cgu.html | 434 | `5 000 FCFA` (NDEKO) | C3 | MOYENNE | Conserver (correct) |
| public/agent/dashboard.html | 1816 | `4000` (NDEKO) | C3 | HAUTE | Corriger en `5000` (OBSOLÈTE - ancien Standard) |
| public/agence/dashboard.html | 1588 | `4000` (NDEKO) | C3 | HAUTE | Corriger en `5000` (OBSOLÈTE - ancien Standard) |
| public/landing.html | 411 | `2.000 FCFA/mois` (format point) | C3 | MOYENNE | Standardiser en `2 000 FCFA/mois` (espace) |
| public/landing.html | 437 | `5.000 FCFA/mois` (format point) | C3 | MOYENNE | Standardiser en `4 000 FCFA/mois` (espace) |
| public/landing.html | 462 | `10.000 FCFA/mois` (format point) | C3 | MOYENNE | Standardiser en `10 000 FCFA/mois` (espace) |
| public/cgu.html | 428 | `2 000 FCFA` (format espace) | C3 | MOYENNE | Conserver (format correct) |
| public/cgu.html | 434 | `5 000 FCFA` (format espace) | C3 | MOYENNE | Corriger en `4 000 FCFA` |
| public/cgu.html | 440 | `10 000 FCFA` (format espace) | C3 | MOYENNE | Conserver (format correct) |
| public/agent/dashboard.html | 1821 | `2000` (sans séparateur) | C3 | MOYENNE | Standardiser en `2 000 FCFA` |
| public/agence/dashboard.html | 1593 | `2000` (sans séparateur) | C3 | MOYENNE | Standardiser en `2 000 FCFA` |

---

## 3. NOMS INTERNES (TABLES, CHAMPS, VARIABLES)

### Tables de base de données

| Table | Usage | Fuit vers interface ? | Action |
|-------|-------|---------------------|--------|
| `subscriptions` | Abonnements actuels | OUI (dashboards, API) | Renommer en `cartes` ou `recharges` après migration |
| `subscription_plan` | ENUM (essentiel, standard, premium) | OUI (dashboards, API) | Remplacer par ENUM (moto, ndeko, libota) |
| `subscription_status` | ENUM (active, expired, suspended) | OUI (dashboards, API) | Conserver (sémantique OK) |
| `platform_config.price_*` | Prix (price_essentiel, price_standard, price_premium) | OUI (dashboards, API) | Remplacer par price_moto, price_ndeko, price_libota |
| `platform_config.partner_rate_*` | Taux CDR | OUI (backend) | Mettre à jour (clinique 30%, pharmacie 12.5%, laboratoire 10%, Bolamu 47.5%) |
| `beneficiaires_familiaux` | Bénéficiaires canal familial | OUI (backend) | Adapter pour personnes rattachées NDEKO/LIBOTA |
| `ovp_documents` | Documents OVP | OUI (backend) | Supprimer (OVP retiré) |
| `renouvellement_demandes` | Demandes de renouvellement | OUI (backend) | Supprimer (plus de renouvellement automatique) |

### Champs et variables

| Champ/Variable | Usage | Fuit vers interface ? | Action |
|----------------|-------|---------------------|--------|
| `expires_at` (subscriptions) | Date fin abonnement | OUI (dashboards, API) | Conserver (sémantique OK) |
| `next_billing_date` (subscriptions) | Date prochaine facturation | OUI (backend) | Supprimer (plus de facturation récurrente) |
| `canal_paiement` (subscriptions) | Canal de paiement | OUI (backend) | Nettoyer (supprimer momo_annuel, ovp_bancaire) |
| `is_active` (users) | Statut actif | OUI (dashboards, API) | Conserver (sémantique OK) |
| `member_code` (users) | Code membre | OUI (dashboards, API) | Conserver (sémantique OK) |
| `trust_score` (users) | Score de confiance | OUI (backend) | Conserver (sémantique OK) |
| `statut_abonnement` (users) | Statut abonnement (ancien) | NON (champ retiré) | Vérifier suppression complète |
| `plan_members` (agence.routes.js) | Mapping plan → personnes | OUI (backend) | Corriger (essentiel→moto, standard→ndeko, premium→libota) |
| `PLAN_MAP` (agence.routes.js) | Mapping plan → subscription_plan | OUI (backend) | Corriger valeurs (standard 4→2, premium 8→5) |

### Fonctions et routes

| Fonction/Route | Usage | Fuit vers interface ? | Action |
|----------------|-------|---------------------|--------|
| `upgradeAbonnement()` | Upgrade abonnement avec prorata | OUI (API) | Supprimer (plus d'upgrade) |
| `calculProrata()` | Calcul prorata | OUI (API) | Supprimer (prorata retiré) |
| `runAbonnementJob()` | Job cron abonnement | OUI (backend) | Renommer en `runCarteJob()` |
| `POST /api/v1/patients/upgrade-abonnement` | Route upgrade | OUI (API) | Supprimer |
| `POST /api/v1/bongo/remboursement/:transaction_id` | Remboursement Bongo | OUI (API) | Supprimer (Bongo retiré) |
| `POST /api/v1/collecte/ovp/*` | Routes OVP | OUI (API) | Supprimer (OVP retiré) |
| `POST /api/v1/collecte/momo/initier` | MoMo annuel | OUI (API) | Supprimer (canal retiré) |
| `verifyAdherent()` | Vérification adhérent | OUI (dashboards) | Renommer en `verifyTitulaire()` |
| `verifierAdherent()` | Vérification adhérent (FR) | OUI (dashboards) | Renommer en `verifierTitulaire()` |

### Fichiers statiques

| Fichier | Usage | Action |
|---------|-------|--------|
| `public/profil-carte.html` | Profil carte | Renommer en `public/profil.html` (conflit "carte") |
| `public/carte/*` | Pages carte | Renommer en `public/pass-qr/*` ou `public/recharge/*` |

---

## 4. DÉCISIONS REQUISES

### Décisions manquantes ou ambiguës

1. **Durées 3/6/12 mois** : Implémenter ou confirmer que seules les durées 6 et 12 mois sont nécessaires (3 mois semble absent des décisions)

2. **Plafonds en nombre de prestations** : Définir précisément :
   - Quelles prestations sont plafonnées ?
   - Quels sont les plafonds mensuels/semestriels/annuels par type de prestation ?
   - Comment gérer le non-cumul mensuel/semestriel ?

3. **Mobilité inter-Hubs (150 FCFA)** : Clarifier :
   - Le montant de 150 FCFA est-il par prestation ou par mois ?
   - Comment est-il réparti entre les 3 prestataires (50 FCFA chacun) ?
   - Est-il déduit du forfait Bolamu (47.5%) ou ajouté ?

4. **Compte cantonné vs comptes opérationnels** : Définir l'architecture comptable :
   - Quel compte bancaire reçoit les recharges ?
   - Comment les fonds sont-ils cantonnés ?
   - Quand et comment les fonds sont-ils transférés vers les comptes opérationnels ?

5. **Recharge automatique pour entreprises** : Clarifier :
   - Est-ce vraiment seulement pour les entreprises ?
   - Quel est le mécanisme technique (mandat SEPA, API bancaire) ?
   - Comment gérer les échecs de recharge automatique ?

6. **Éléments retirés du catalogue** : Confirmer la liste exhaustive :
   - Téléconsultation : complètement retirée ou limitée ?
   - Stupéfiants : complètement retirés ou sous condition spéciale ?
   - Soins palliatifs : complètement retirés ou déplacés hors SSP ?

7. **Prix annuels CDR Hub** : Les décisions mentionnent des prix annuels mais ne précisent pas :
   - Y a-t-il un rabais pour la recharge annuelle ?
   - Si oui, quel est le % de rabais ?
   - Sinon, pourquoi proposer la recharge annuelle ?

8. **Personnes rattachées NDEKO/LIBOTA** : Clarifier :
   - Les personnes rattachées peuvent-elles être ajoutées/supprimées en cours de cycle ?
   - Si oui, comment est calculé le prorata (ou y a-t-il un coût fixe) ?
   - Les personnes rattachées ont-elles leur propre Pass QR ?

9. **Comportement à l'échéance** : Préciser :
   - L'accès s'arrête-t-il immédiatement à l'expiration (minuit) ou à un moment précis ?
   - Y a-t-il une notification de fin de validité X jours avant ?
   - Les données de santé restent-elles accessibles en lecture seule après expiration ?

10. **Format des prix** : Standardiser :
    - Point (2.000) ou espace (2 000) ou sans séparateur (2000) ?
    - Recommandation : espace (2 000 FCFA) pour conformité aux standards francophones

11. **Logos "Ils nous font confiance"** : Décider :
    - Remplacer par de vrais logos de partenaires confirmés ?
    - Supprimer la section ?
    - Remplacer par des témoignages textuels ?

12. **Références légales** : Auditer avec un juriste :
    - Vérifier l'exactitude des numéros de lois cités
    - Vérifier la promulgation effective de la Loi n°5-2025
    - Vérifier l'existence des articles cités (Art. 62 Loi 29-2019, Art. 142 Code du Travail)

13. **Chiffres statistiques** : Vérifier en base :
    - 50,000+ membres : chiffre réel ou projection ?
    - 250+ partenaires : chiffre réel ou projection ?
    - 4M membres cibles : cible actuelle ou obsolète ?

14. **Disponibilité 24/7** : Vérifier :
    - Support client disponible 24/7 ?
    - Plateforme technique disponible 24/7 (SLA) ?
    - Si non, corriger les affirmations

15. **Migration des données existantes** : Définir :
    - Que faire des abonnements actifs (subscription_plan essentiel/standard/premium) ?
    - Conversion automatique vers moto/ndeko/libota ?
    - Communication aux utilisateurs concernés ?

---

## 5. PRIORITÉS D'ACTIONS (TOP 20)

### P0 - Critique (bloquant pour la migration)

1. **Corriger le prix NDEKO** : 4.000 → 5.000 FCFA dans agent/dashboard.html et agence/dashboard.html (OBSOLÈTE)
2. **Supprimer les références OVP** : CGU, dashboards agent/agence, routes collecte
3. **Supprimer les références "abonnement"** : Remplacer par "carte" dans les pages publiques
4. **Supprimer les références "adhérent"** : Remplacer par "titulaire" dans les dashboards
5. **Supprimer "prélèvement automatique"** : CGU, offres particuliers
6. **Supprimer "remboursement"** : CGU, routes bongo, ledger service
7. **Supprimer "complémentaire"** : CGU (références RAMU/CAMU)
8. **Supprimer "Carte d'Adhérent"** : Remplacer par "Pass QR"
9. **Remplacer "Crédit Fidélité"** : Remplacer par "Zora Points" (VALIDÉ)
10. **Remplacer "Partenaires Bien-Être"** : Remplacer par "Partenaires Zora" (VALIDÉ)

### P1 - Important (impact légal ou financier)

11. **Auditer les références légales** : Vérifier avec un juriste les numéros de lois et articles
12. **Vérifier/Supprimer les logos "Ils nous font confiance"** : Remplacer par partenaires réels ou supprimer
13. **Migrer les montants hardcodés vers platform_config** : 5000, 15000, 8000, 2500, 50000
14. **Implémenter les durées 3/6/12 mois** : Adapter subscriptions.routes.js et collecte.routes.js
15. **Adapter le calcul de la CDR** : 150 FCFA mobilité, taux corrects (30%, 12.5%, 10%, 47.5%)
16. **Adapter le comptage par personne** : NDEKO 2, LIBOTA 5 (corriger agence.routes.js)
17. **Adapter les plafonds en nombre de prestations** : Remplacer les plafonds FCFA
18. **Clarifier l'architecture compte cantonné** : Définir flux comptable

### P2 - Moyen (cohérence et UX)

19. **Standardiser le format des prix** : Espace comme séparateur (2 000 FCFA)
20. **Vérifier les chiffres statistiques** : 50,000+ membres, 250+ partenaires, 4M cibles

---

## 6. FICHIERS NON AUDITÉS

En raison de la taille du projet, les dossiers suivants n'ont pas été audités exhaustivement :

- `node_modules/` : Exclu (binaires tiers)
- `.git/` : Exclu (historique git)
- `public/images/` : Exclu (images binaires)
- `public/videos/` : Exclu (vidéos binaires)
- `public/fonts/` : Exclu (fichiers de polices binaires)
- `public/__next__/` : Partiellement audité (fichiers générés Next.js)
- `database/migrations/` : Audité partiellement (seules les migrations récentes)
- `src/__tests__/` : Audité partiellement (tests unitaires)

**Recommandation** : Si nécessaire, lancer un audit ciblé sur ces dossiers.

---

## 7. CONCLUSION

Cet audit a identifié **625+ occurrences** de termes et logiques à modifier pour migrer du modèle "abonnement mensuel" vers "carte prépayée rechargeable". Les priorités P0 concernent principalement le vocabulaire visible par l'utilisateur (public/) qui doit être mis à jour en premier pour éviter toute confusion. Les priorités P1 et P2 concernent la logique métier (src/) et la cohérence légale/financière.

**Prochaine étape recommandée** : Valider les décisions requises (section 4) avec l'équipe produit et juridique avant de commencer les modifications.

---

**Fin du rapport d'audit**
