# RAPPORT ROBOT PATIENT V4
# Test automatisé du dashboard patient avec navigation séquentielle par section

**Date :** 2026-06-28T06:26:05.785Z
**URL testée :** https://www.bolamu.co/patient/dashboard.html
**Compte test :** +242069735418

---

## SECTION 1 : Erreurs au chargement

Aucune erreur au chargement

---

## TABLEAU DES RÉSULTATS

| Bouton (data-testid) | Section | Comportement attendu | Comportement réel | Screenshot | Erreur console | VERDICT |
|----------------------|---------|---------------------|-------------------|------------|----------------|---------|
| nav-accueil | Navigation | Navigation | DOM changé (navigation) | screenshot-1-nav-accueil.png | Aucune | ✅ |
| nav-accueil | Navigation | Navigation | Erreur: elementHandle.click: Timeout 30000ms exceeded.
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
| nav-gagner | Navigation | Navigation | DOM changé (navigation) | screenshot-2-nav-gagner.png | Invalid LatLng object: (NaN, NaN) | ⚠️ |
| nav-gagner | Navigation | Navigation | Erreur: elementHandle.click: Timeout 30000ms exceeded.
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
| nav-suivre | Navigation | Navigation | DOM changé (navigation) | screenshot-3-nav-suivre.png | Aucune | ✅ |
| nav-suivre | Navigation | Navigation | Erreur: elementHandle.click: Timeout 30000ms exceeded.
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
| nav-recompenses | Navigation | Navigation | DOM changé (navigation) | screenshot-4-nav-recompenses.png | Aucune | ✅ |
| nav-recompenses | Navigation | Navigation | Erreur: elementHandle.click: Timeout 30000ms exceeded.
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
| btn-profil | Navigation | Navigation | DOM changé (navigation) | screenshot-5-btn-profil.png | Aucune | ✅ |
| btn-profil | Navigation | Navigation | Erreur: elementHandle.click: Timeout 30000ms exceeded.
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
| openChatReal | Accueil | Ouvre le chat, charge les messages, connecte Socket.io | Section active mais élément absent | screenshot-6-openChatReal-not-visible.png | Élément non visible après 5s | 🔴 |
| goRecompenses | Accueil | Bascule sur la vue Récompenses | Section active mais élément absent | screenshot-7-goRecompenses-not-visible.png | Élément non visible après 5s | 🔴 |
| gagnerSport | Gagner | Bascule sur l'onglet Sport (gagnerTab: sport) | Section active mais élément absent | screenshot-8-gagnerSport-not-visible.png | Élément non visible après 5s | 🔴 |
| tab-sante | Gagner | Bascule sur l'onglet Santé (gagnerTab: sante) | Action exécutée | screenshot-9-tab-sante.png | Aucune | ✅ |
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
| filterTout | Gagner | Filtre carte 'Tout' (mapFilter: tout) | Section active mais élément absent | screenshot-10-filterTout-not-visible.png | Élément non visible après 5s | 🔴 |
| filterClin | Gagner | Filtre carte 'Cliniques' (mapFilter: cliniques) | Section active mais élément absent | screenshot-11-filterClin-not-visible.png | Élément non visible après 5s | 🔴 |
| filterPharm | Gagner | Filtre carte 'Pharmacies' (mapFilter: pharmacies) | Section active mais élément absent | screenshot-12-filterPharm-not-visible.png | Élément non visible après 5s | 🔴 |
| filterLabo | Gagner | Filtre carte 'Labos' (mapFilter: labos) | Section active mais élément absent | screenshot-13-filterLabo-not-visible.png | Élément non visible après 5s | 🔴 |
| openCreateGroupModal | Gagner | Ouvre modal création de groupe | Section active mais élément absent | screenshot-14-openCreateGroupModal-not-visible.png | Élément non visible après 5s | 🔴 |
| suivreZora | Suivre | Bascule sur l'onglet Mes Zora (suivreTab: zora) | Section active mais élément absent | screenshot-15-suivreZora-not-visible.png | Élément non visible après 5s | 🔴 |
| btn-dossier-medical | Suivre | Bascule sur l'onglet Mon dossier médical (suivreTab: dossier) | Action exécutée | screenshot-16-btn-dossier-medical.png | Aucune | ✅ |
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
| const-edit | Suivre | Ouvre modal édition constantes médicales | Action exécutée | screenshot-17-const-edit.png | Aucune | ✅ |
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
[2m    53 × waiting for element to be visible, enabled and stable[22m
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
[2m    53 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
 | ❌ |
| btn-download-dmn | Suivre | Ouvre modal mot de passe DMN | Erreur: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-download-dmn"]').first()[22m
[2m    - locator resolved to <button data-dc-tpl="528" data-testid="btn-download-dmn">Accéder aux documents</button>[22m
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
[2m    54 × waiting for element to be visible, enabled and stable[22m
[2m       - element is visible, enabled and stable[22m
[2m       - scrolling into view if needed[22m
[2m       - done scrolling[22m
[2m       - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-download-dmn"]').first()[22m
[2m    - locator resolved to <button data-dc-tpl="528" data-testid="btn-download-dmn">Accéder aux documents</button>[22m
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
[2m    54 × waiting for element to be visible, enabled and stable[22m
[2m       - element is visible, enabled and stable[22m
[2m       - scrolling into view if needed[22m
[2m       - done scrolling[22m
[2m       - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| openQrUrg | Suivre | Ouvre modal QR urgence | Section active mais élément absent | screenshot-18-openQrUrg-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatTout | Récompenses | Filtre catégorie 'Tout' (filterCategorie: tout) | Section active mais élément absent | screenshot-19-filterCatTout-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatElec | Récompenses | Filtre catégorie 'Électronique' | Section active mais élément absent | screenshot-20-filterCatElec-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatVoyage | Récompenses | Filtre catégorie 'Voyage' | Section active mais élément absent | screenshot-21-filterCatVoyage-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatTelecom | Récompenses | Filtre catégorie 'Télécom' | Section active mais élément absent | screenshot-22-filterCatTelecom-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatHotels | Récompenses | Filtre catégorie 'Hôtels' | Section active mais élément absent | screenshot-23-filterCatHotels-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatSport | Récompenses | Filtre catégorie 'Sport' | Section active mais élément absent | screenshot-24-filterCatSport-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatBeaute | Récompenses | Filtre catégorie 'Beauté' | Section active mais élément absent | screenshot-25-filterCatBeaute-not-visible.png | Élément non visible après 5s | 🔴 |
| filterCatCarburant | Récompenses | Filtre catégorie 'Carburant' | Section active mais élément absent | screenshot-26-filterCatCarburant-not-visible.png | Élément non visible après 5s | 🔴 |
| closeProfile | Profil | Ferme panel Profil | Section active mais élément absent | screenshot-27-closeProfile-not-visible.png | Élément non visible après 5s | 🔴 |
| logout | Profil | Vide localStorage, redirige vers /login.html | Section active mais élément absent | screenshot-28-logout-not-visible.png | Élément non visible après 5s | 🔴 |

---

## SECTION 2 : Récapitulatif chiffré

- ✅ Conformes : 7
- ⚠️ Partiels : 1
- 🔴 Silencieux : 20
- ❌ Crash : 9
- **Total testé :** 37

---

## SECTION 3 : 🔴 et ❌ classés par criticité

### 🔴 Silencieux (élément non trouvé ou absent)
- **openChatReal** (Accueil): Section active mais élément absent
- **goRecompenses** (Accueil): Section active mais élément absent
- **gagnerSport** (Gagner): Section active mais élément absent
- **filterTout** (Gagner): Section active mais élément absent
- **filterClin** (Gagner): Section active mais élément absent
- **filterPharm** (Gagner): Section active mais élément absent
- **filterLabo** (Gagner): Section active mais élément absent
- **openCreateGroupModal** (Gagner): Section active mais élément absent
- **suivreZora** (Suivre): Section active mais élément absent
- **openQrUrg** (Suivre): Section active mais élément absent
- **filterCatTout** (Récompenses): Section active mais élément absent
- **filterCatElec** (Récompenses): Section active mais élément absent
- **filterCatVoyage** (Récompenses): Section active mais élément absent
- **filterCatTelecom** (Récompenses): Section active mais élément absent
- **filterCatHotels** (Récompenses): Section active mais élément absent
- **filterCatSport** (Récompenses): Section active mais élément absent
- **filterCatBeaute** (Récompenses): Section active mais élément absent
- **filterCatCarburant** (Récompenses): Section active mais élément absent
- **closeProfile** (Profil): Section active mais élément absent
- **logout** (Profil): Section active mais élément absent

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
[2m    55 × waiting for element to be visible, enabled and stable[22m
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
[2m    57 × waiting for element to be visible, enabled and stable[22m
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
[2m    56 × waiting for element to be visible, enabled and stable[22m
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
[2m    57 × waiting for element to be visible, enabled and stable[22m
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
[2m    55 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

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
[2m    57 × waiting for element to be visible, enabled and stable[22m
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
[2m    53 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m

- **btn-download-dmn** (Suivre): locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-download-dmn"]').first()[22m
[2m    - locator resolved to <button data-dc-tpl="528" data-testid="btn-download-dmn">Accéder aux documents</button>[22m
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
[2m    54 × waiting for element to be visible, enabled and stable[22m
[2m       - element is visible, enabled and stable[22m
[2m       - scrolling into view if needed[22m
[2m       - done scrolling[22m
[2m       - <div data-dc-tpl="845">…</div> intercepts pointer events[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

