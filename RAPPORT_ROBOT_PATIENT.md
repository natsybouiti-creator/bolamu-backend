# RAPPORT ROBOT PATIENT
# Test automatisé du dashboard patient

**Date :** 2026-06-28T05:54:58.984Z
**URL testée :** https://www.bolamu.co/patient/dashboard.html
**Compte test :** +242069735418

---

## SECTION 1 : Erreurs au chargement

Aucune erreur au chargement

---

## TABLEAU DES RÉSULTATS

| Bouton (data-testid) | Section | Comportement attendu | Comportement réel | Screenshot | Erreur console | VERDICT |
|----------------------|---------|---------------------|-------------------|------------|----------------|---------|
| nav-accueil | Navigation | Bascule sur la vue Accueil (panel: accueil) | DOM changé (navigation) | screenshot-1-nav-accueil.png | Aucune | ✅ |
| nav-accueil | Navigation | Bascule sur la vue Accueil (panel: accueil) | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    54 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    54 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| nav-gagner | Navigation | Bascule sur la vue Gagner (panel: gagner) | DOM changé (navigation) | screenshot-2-nav-gagner.png | Invalid LatLng object: (NaN, NaN) | ⚠️ |
| nav-gagner | Navigation | Bascule sur la vue Gagner (panel: gagner) | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    57 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    57 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| nav-suivre | Navigation | Bascule sur la vue Suivre (panel: suivre) | DOM changé (navigation) | screenshot-3-nav-suivre.png | Aucune | ✅ |
| nav-suivre | Navigation | Bascule sur la vue Suivre (panel: suivre) | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    52 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    52 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| nav-recompenses | Navigation | Bascule sur la vue Récompenses (panel: reward) | DOM changé (navigation) | screenshot-4-nav-recompenses.png | Aucune | ✅ |
| nav-recompenses | Navigation | Bascule sur la vue Récompenses (panel: reward) | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    57 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    57 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| btn-profil | Navigation | Ouvre le panel Profil (profileOpen: true) | DOM changé (navigation) | screenshot-5-btn-profil.png | Aucune | ✅ |
| btn-profil | Navigation | Ouvre le panel Profil (profileOpen: true) | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    56 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    56 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| openChatReal | Accueil | Ouvre le chat, charge les messages, connecte Socket.io | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| goRecompenses | Accueil | Bascule sur la vue Récompenses | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| gagnerSport | Gagner | Bascule sur l'onglet Sport (gagnerTab: sport) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| tab-sante | Gagner | Bascule sur l'onglet Santé (gagnerTab: sante) | Action exécutée | screenshot-6-tab-sante.png | Aucune | ✅ |
| tab-sante | Gagner | Bascule sur l'onglet Santé (gagnerTab: sante) | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    56 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    56 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
 | ❌ |
| filterTout | Gagner | Filtre carte 'Tout' (mapFilter: tout) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterClin | Gagner | Filtre carte 'Cliniques' (mapFilter: cliniques) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterPharm | Gagner | Filtre carte 'Pharmacies' (mapFilter: pharmacies) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterLabo | Gagner | Filtre carte 'Labos' (mapFilter: labos) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| openCreateGroupModal | Gagner | Ouvre modal création de groupe | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| suivreZora | Suivre | Bascule sur l'onglet Mes Zora (suivreTab: zora) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| btn-dossier-medical | Suivre | Bascule sur l'onglet Mon dossier médical (suivreTab: dossier) | Action exécutée | screenshot-7-btn-dossier-medical.png | Aucune | ✅ |
| btn-dossier-medical | Suivre | Bascule sur l'onglet Mon dossier médical (suivreTab: dossier) | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    55 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    55 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| const-edit | Suivre | Ouvre modal édition constantes médicales | Action exécutée | screenshot-8-const-edit.png | Aucune | ✅ |
| const-edit | Suivre | Ouvre modal édition constantes médicales | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    50 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    50 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| btn-download-dmn | Suivre | Ouvre modal mot de passe DMN | Erreur: elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    47 × waiting for element to be visible, enabled and stable[22m
[2m       - element is visible, enabled and stable[22m
[2m       - scrolling into view if needed[22m
[2m       - done scrolling[22m
[2m       - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    47 × waiting for element to be visible, enabled and stable[22m
[2m       - element is visible, enabled and stable[22m
[2m       - scrolling into view if needed[22m
[2m       - done scrolling[22m
[2m       - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| openQrUrg | Suivre | Ouvre modal QR urgence | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatTout | Récompenses | Filtre catégorie 'Tout' (filterCategorie: tout) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatElec | Récompenses | Filtre catégorie 'Électronique' | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatVoyage | Récompenses | Filtre catégorie 'Voyage' | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatTelecom | Récompenses | Filtre catégorie 'Télécom' | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatHotels | Récompenses | Filtre catégorie 'Hôtels' | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatSport | Récompenses | Filtre catégorie 'Sport' | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatBeaute | Récompenses | Filtre catégorie 'Beauté' | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterCatCarburant | Récompenses | Filtre catégorie 'Carburant' | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| closeProfile | Profil | Ferme panel Profil | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| logout | Profil | Vide localStorage, redirige vers /login.html | Élément non trouvé | N/A | Élément non trouvé | 🔴 |

---

## SECTION 2 : Récapitulatif chiffré

- ✅ Conformes : 7
- ⚠️ Partiels : 1
- 🔴 Silencieux : 20
- ❌ Crash : 9
- **Total testé :** 37

---

## SECTION 3 : 🔴 et ❌ classés par criticité

### 🔴 Silencieux (élément non trouvé)
- **openChatReal** (Accueil): Élément non trouvé
- **goRecompenses** (Accueil): Élément non trouvé
- **gagnerSport** (Gagner): Élément non trouvé
- **filterTout** (Gagner): Élément non trouvé
- **filterClin** (Gagner): Élément non trouvé
- **filterPharm** (Gagner): Élément non trouvé
- **filterLabo** (Gagner): Élément non trouvé
- **openCreateGroupModal** (Gagner): Élément non trouvé
- **suivreZora** (Suivre): Élément non trouvé
- **openQrUrg** (Suivre): Élément non trouvé
- **filterCatTout** (Récompenses): Élément non trouvé
- **filterCatElec** (Récompenses): Élément non trouvé
- **filterCatVoyage** (Récompenses): Élément non trouvé
- **filterCatTelecom** (Récompenses): Élément non trouvé
- **filterCatHotels** (Récompenses): Élément non trouvé
- **filterCatSport** (Récompenses): Élément non trouvé
- **filterCatBeaute** (Récompenses): Élément non trouvé
- **filterCatCarburant** (Récompenses): Élément non trouvé
- **closeProfile** (Profil): Élément non trouvé
- **logout** (Profil): Élément non trouvé

### ❌ Crash (erreur critique)
- **nav-accueil** (Navigation): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    54 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **nav-gagner** (Navigation): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    57 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **nav-suivre** (Navigation): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    52 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **nav-recompenses** (Navigation): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    57 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **btn-profil** (Navigation): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    56 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **tab-sante** (Gagner): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    56 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m

- **btn-dossier-medical** (Suivre): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    55 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **const-edit** (Suivre): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    50 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **btn-download-dmn** (Suivre): elementHandle.click: Timeout 30000ms exceeded.
Call log:
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    47 × waiting for element to be visible, enabled and stable[22m
[2m       - element is visible, enabled and stable[22m
[2m       - scrolling into view if needed[22m
[2m       - done scrolling[22m
[2m       - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

