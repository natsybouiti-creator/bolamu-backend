# RAPPORT ROBOT PATIENT V2
# Test automatisé du dashboard patient avec timing DCLogic corrigé

**Date :** 2026-06-28T06:03:30.736Z
**URL testée :** https://www.bolamu.co/patient/dashboard.html
**Compte test :** +242069735418
**Screenshot initial :** screenshot-0-initial.png

---

## SECTION 1 : Erreurs au chargement

Aucune erreur au chargement

---

## TABLEAU DES RÉSULTATS

| Bouton (data-testid) | Section | Comportement attendu | Comportement réel | Screenshot | Erreur console | VERDICT |
|----------------------|---------|---------------------|-------------------|------------|----------------|---------|
| nav-accueil | Navigation | Bascule sur la vue Accueil (panel: accueil) | Erreur: locator.click: Error: strict mode violation: locator('[data-testid="nav-accueil"]') resolved to 2 elements:
    1) <button data-dc-tpl="14" data-testid="nav-accueil">…</button> aka getByRole('button', { name: 'home Accueil' })
    2) <button data-dc-tpl="751" data-testid="nav-accueil">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-accueil')

Call log:
[2m  - waiting for locator('[data-testid="nav-accueil"]')[22m
 | N/A | locator.click: Error: strict mode violation: locator('[data-testid="nav-accueil"]') resolved to 2 elements:
    1) <button data-dc-tpl="14" data-testid="nav-accueil">…</button> aka getByRole('button', { name: 'home Accueil' })
    2) <button data-dc-tpl="751" data-testid="nav-accueil">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-accueil')

Call log:
[2m  - waiting for locator('[data-testid="nav-accueil"]')[22m
 | ❌ |
| nav-gagner | Navigation | Bascule sur la vue Gagner (panel: gagner) | Erreur: locator.click: Error: strict mode violation: locator('[data-testid="nav-gagner"]') resolved to 2 elements:
    1) <button data-dc-tpl="18" data-testid="nav-gagner">…</button> aka getByRole('button', { name: 'add_circle Gagner' })
    2) <button data-dc-tpl="754" data-testid="nav-gagner">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-gagner')

Call log:
[2m  - waiting for locator('[data-testid="nav-gagner"]')[22m
 | N/A | locator.click: Error: strict mode violation: locator('[data-testid="nav-gagner"]') resolved to 2 elements:
    1) <button data-dc-tpl="18" data-testid="nav-gagner">…</button> aka getByRole('button', { name: 'add_circle Gagner' })
    2) <button data-dc-tpl="754" data-testid="nav-gagner">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-gagner')

Call log:
[2m  - waiting for locator('[data-testid="nav-gagner"]')[22m
 | ❌ |
| nav-suivre | Navigation | Bascule sur la vue Suivre (panel: suivre) | Erreur: locator.click: Error: strict mode violation: locator('[data-testid="nav-suivre"]') resolved to 2 elements:
    1) <button data-dc-tpl="22" data-testid="nav-suivre">…</button> aka getByRole('button', { name: 'account_balance_wallet Suivre' })
    2) <button data-dc-tpl="757" data-testid="nav-suivre">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-suivre')

Call log:
[2m  - waiting for locator('[data-testid="nav-suivre"]')[22m
 | N/A | locator.click: Error: strict mode violation: locator('[data-testid="nav-suivre"]') resolved to 2 elements:
    1) <button data-dc-tpl="22" data-testid="nav-suivre">…</button> aka getByRole('button', { name: 'account_balance_wallet Suivre' })
    2) <button data-dc-tpl="757" data-testid="nav-suivre">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-suivre')

Call log:
[2m  - waiting for locator('[data-testid="nav-suivre"]')[22m
 | ❌ |
| nav-recompenses | Navigation | Bascule sur la vue Récompenses (panel: reward) | Erreur: locator.click: Error: strict mode violation: locator('[data-testid="nav-recompenses"]') resolved to 2 elements:
    1) <button data-dc-tpl="26" data-testid="nav-recompenses">…</button> aka getByRole('button', { name: 'redeem Récompenses' })
    2) <button data-dc-tpl="760" data-testid="nav-recompenses">…</button> aka getByText('redeemRécomp.')

Call log:
[2m  - waiting for locator('[data-testid="nav-recompenses"]')[22m
 | N/A | locator.click: Error: strict mode violation: locator('[data-testid="nav-recompenses"]') resolved to 2 elements:
    1) <button data-dc-tpl="26" data-testid="nav-recompenses">…</button> aka getByRole('button', { name: 'redeem Récompenses' })
    2) <button data-dc-tpl="760" data-testid="nav-recompenses">…</button> aka getByText('redeemRécomp.')

Call log:
[2m  - waiting for locator('[data-testid="nav-recompenses"]')[22m
 | ❌ |
| btn-profil | Navigation | Ouvre le panel Profil (profileOpen: true) | DOM changé (navigation) | screenshot-1-btn-profil.png | Aucune | ✅ |
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
| openChatReal | Accueil | Ouvre le chat, charge les messages, connecte Socket.io | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| goRecompenses | Accueil | Bascule sur la vue Récompenses | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| gagnerSport | Gagner | Bascule sur l'onglet Sport (gagnerTab: sport) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| tab-sante | Gagner | Bascule sur l'onglet Santé (gagnerTab: sante) | Erreur: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="tab-sante"]')[22m
[2m    - locator resolved to <button data-dc-tpl="208" data-testid="tab-sante">Santé</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    58 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="tab-sante"]')[22m
[2m    - locator resolved to <button data-dc-tpl="208" data-testid="tab-sante">Santé</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    58 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| filterTout | Gagner | Filtre carte 'Tout' (mapFilter: tout) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterClin | Gagner | Filtre carte 'Cliniques' (mapFilter: cliniques) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterPharm | Gagner | Filtre carte 'Pharmacies' (mapFilter: pharmacies) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| filterLabo | Gagner | Filtre carte 'Labos' (mapFilter: labos) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| openCreateGroupModal | Gagner | Ouvre modal création de groupe | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| suivreZora | Suivre | Bascule sur l'onglet Mes Zora (suivreTab: zora) | Élément non trouvé | N/A | Élément non trouvé | 🔴 |
| btn-dossier-medical | Suivre | Bascule sur l'onglet Mon dossier médical (suivreTab: dossier) | Erreur: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-dossier-medical"]')[22m
[2m    - locator resolved to <button data-dc-tpl="409" data-testid="btn-dossier-medical">Mon dossier médical</button>[22m
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
 | N/A | locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-dossier-medical"]')[22m
[2m    - locator resolved to <button data-dc-tpl="409" data-testid="btn-dossier-medical">Mon dossier médical</button>[22m
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
| const-edit | Suivre | Ouvre modal édition constantes médicales | Erreur: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="const-edit"]')[22m
[2m    - locator resolved to <button data-dc-tpl="497" data-testid="const-edit">…</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    58 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | N/A | locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="const-edit"]')[22m
[2m    - locator resolved to <button data-dc-tpl="497" data-testid="const-edit">…</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    58 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
 | ❌ |
| btn-download-dmn | Suivre | Ouvre modal mot de passe DMN | Erreur: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-download-dmn"]')[22m
[2m    - locator resolved to <button data-dc-tpl="528" data-testid="btn-download-dmn">Accéder aux documents</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    39 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
 | N/A | locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-download-dmn"]')[22m
[2m    - locator resolved to <button data-dc-tpl="528" data-testid="btn-download-dmn">Accéder aux documents</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    39 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
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

- ✅ Conformes : 1
- ⚠️ Partiels : 0
- 🔴 Silencieux : 20
- ❌ Crash : 9
- **Total testé :** 30

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
- **nav-accueil** (Navigation): locator.click: Error: strict mode violation: locator('[data-testid="nav-accueil"]') resolved to 2 elements:
    1) <button data-dc-tpl="14" data-testid="nav-accueil">…</button> aka getByRole('button', { name: 'home Accueil' })
    2) <button data-dc-tpl="751" data-testid="nav-accueil">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-accueil')

Call log:
[2m  - waiting for locator('[data-testid="nav-accueil"]')[22m

- **nav-gagner** (Navigation): locator.click: Error: strict mode violation: locator('[data-testid="nav-gagner"]') resolved to 2 elements:
    1) <button data-dc-tpl="18" data-testid="nav-gagner">…</button> aka getByRole('button', { name: 'add_circle Gagner' })
    2) <button data-dc-tpl="754" data-testid="nav-gagner">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-gagner')

Call log:
[2m  - waiting for locator('[data-testid="nav-gagner"]')[22m

- **nav-suivre** (Navigation): locator.click: Error: strict mode violation: locator('[data-testid="nav-suivre"]') resolved to 2 elements:
    1) <button data-dc-tpl="22" data-testid="nav-suivre">…</button> aka getByRole('button', { name: 'account_balance_wallet Suivre' })
    2) <button data-dc-tpl="757" data-testid="nav-suivre">…</button> aka locator('nav').filter({ hasText: 'homeAccueil add_circleGagner account_balance_walletSuivre redeemRécomp.' }).getByTestId('nav-suivre')

Call log:
[2m  - waiting for locator('[data-testid="nav-suivre"]')[22m

- **nav-recompenses** (Navigation): locator.click: Error: strict mode violation: locator('[data-testid="nav-recompenses"]') resolved to 2 elements:
    1) <button data-dc-tpl="26" data-testid="nav-recompenses">…</button> aka getByRole('button', { name: 'redeem Récompenses' })
    2) <button data-dc-tpl="760" data-testid="nav-recompenses">…</button> aka getByText('redeemRécomp.')

Call log:
[2m  - waiting for locator('[data-testid="nav-recompenses"]')[22m

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

- **tab-sante** (Gagner): locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="tab-sante"]')[22m
[2m    - locator resolved to <button data-dc-tpl="208" data-testid="tab-sante">Santé</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    58 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **btn-dossier-medical** (Suivre): locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-dossier-medical"]')[22m
[2m    - locator resolved to <button data-dc-tpl="409" data-testid="btn-dossier-medical">Mon dossier médical</button>[22m
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

- **const-edit** (Suivre): locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="const-edit"]')[22m
[2m    - locator resolved to <button data-dc-tpl="497" data-testid="const-edit">…</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    58 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m

- **btn-download-dmn** (Suivre): locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="btn-download-dmn"]')[22m
[2m    - locator resolved to <button data-dc-tpl="528" data-testid="btn-download-dmn">Accéder aux documents</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    39 × waiting for element to be visible, enabled and stable[22m
[2m       - element is not visible[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m

