# RAPPORT ROBOT V8 PATIENT
> Test complet avec protocole window.__bolamu_test
> Date: 2026-06-28T13:11:55.396Z
> Compte: +242069735418

---

## SECTION 1 — IDs récupérés

- EVENT_ID: ev59
- VOUCHER_ID: N/A
- MEMBER_PHONE: N/A
- CLUB_ID: N/A
- DMN_DOC_ID: N/A
- RDV_DOCTOR_ID: N/A

---

## SECTION 2 — Violations contrat API

- ❌ https://api.bolamu.co/api/v1/auth/login — data absent
- ❌ https://api.bolamu.co/api/v1/streaks/me — data absent
- ❌ https://api.bolamu.co/api/v1/leaderboard/weekly — data absent
- ❌ https://api.bolamu.co/api/v1/zora/games/play — error.code absent
- ❌ https://api.bolamu.co/api/v1/zora/games/play — error.code absent
- ❌ https://api.bolamu.co/api/v1/zora/games/play — error.code absent
- ❌ https://api.bolamu.co/api/v1/zora/games/play — error.code absent
- ❌ https://api.bolamu.co/api/v1/zora/games/play — error.code absent
- ❌ https://api.bolamu.co/api/v1/zora/games/play — error.code absent
- ❌ https://api.bolamu.co/api/v1/events/ev59 — error.code absent

---

## SECTION 3 — Récapitulatif UI

- ✅ Conformes: 78
- ⚠️ Partiels: 2
- 🔴 Silencieux: 0
- ❌ Crash: 0
- **Total: 80**

---

## SECTION 4 — Récapitulatif API

- ✅ Conformes: Partiel
- ❌ Violations: 10

---

## SECTION 5 — Liste des ❌ et 🔴 par criticité

✅ Aucun échec critique détecté

---

## TABLEAU 1 — Tests UI détaillés

| Bloc | Action | Comportement réel | Screenshot | VERDICT |
|------|--------|-------------------|------------|---------|
| BLOC 1 | goAccueil | Navigation accueil | v8-00-nav-accueil.png | ✅ |
| BLOC 1 | goGagner | Navigation gagner | v8-01-nav-gagner.png | ✅ |
| BLOC 1 | goSuivre | Navigation suivre | v8-02-nav-suivre.png | ✅ |
| BLOC 1 | goRecompenses | Navigation récompenses | v8-03-nav-recompenses.png | ✅ |
| BLOC 1 | openProfile | Ouverture profil | v8-04-open-profile.png | ✅ |
| BLOC 1 | closeProfile | Fermeture profil | N/A | ✅ |
| BLOC 2 | gagnerSport | Onglet sport | v8-05-gagner-sport.png | ✅ |
| BLOC 2 | gagnerSante | Onglet santé | v8-06-gagner-sante.png | ✅ |
| BLOC 3 | filterTout | Filtre tout | v8-07-filter-tout.png | ✅ |
| BLOC 3 | filterClin | Filtre cliniques | v8-08-filter-clin.png | ✅ |
| BLOC 3 | filterPharm | Filtre pharmacies | v8-09-filter-pharm.png | ✅ |
| BLOC 3 | filterLabo | Filtre labos | v8-10-filter-labo.png | ✅ |
| BLOC 4 | suivreZora | Onglet Zora | v8-11-suivre-zora.png | ✅ |
| BLOC 4 | suivreDossier | Onglet dossier | v8-12-suivre-dossier.png | ✅ |
| BLOC 5 | filterCatTout | Filtre cat tout | v8-13-filter-cat-tout.png | ✅ |
| BLOC 5 | filterCatElec | Filtre cat élec | v8-14-filter-cat-elec.png | ✅ |
| BLOC 5 | filterCatVoyage | Filtre cat voyage | v8-15-filter-cat-voyage.png | ✅ |
| BLOC 5 | filterCatTelecom | Filtre cat telecom | v8-16-filter-cat-telecom.png | ✅ |
| BLOC 5 | filterCatHotels | Filtre cat hotels | v8-17-filter-cat-hotels.png | ✅ |
| BLOC 5 | filterCatSport | Filtre cat sport | v8-18-filter-cat-sport.png | ✅ |
| BLOC 5 | filterCatBeaute | Filtre cat beauté | v8-19-filter-cat-beaute.png | ✅ |
| BLOC 5 | filterCatCarburant | Filtre cat carburant | v8-20-filter-cat-carburant.png | ✅ |
| BLOC 6 | openScratch | Ouverture scratch | v8-21-open-scratch.png | ✅ |
| BLOC 6 | playScratch | Jeu scratch | v8-22-play-scratch.png | ✅ |
| BLOC 6 | closeGame | Fermeture jeu | N/A | ✅ |
| BLOC 6 | openWheel | Ouverture roue | v8-23-open-wheel.png | ✅ |
| BLOC 6 | spinWheel | Spin roue | v8-24-spin-wheel.png | ✅ |
| BLOC 6 | closeGame | Fermeture jeu | N/A | ✅ |
| BLOC 6 | openChest | Ouverture coffre | v8-25-open-chest.png | ✅ |
| BLOC 6 | openChest0 | Coffre 0 | v8-26-open-chest-0.png | ✅ |
| BLOC 6 | openChest1 | Coffre 1 | v8-27-open-chest-1.png | ✅ |
| BLOC 6 | openChest2 | Coffre 2 | v8-28-open-chest-2.png | ✅ |
| BLOC 6 | closeGame | Fermeture jeu | N/A | ✅ |
| BLOC 6 | openQuiz | Ouverture quiz | v8-29-open-quiz.png | ✅ |
| BLOC 6 | pickQuiz0 | Quiz option 0 | v8-30-pick-quiz-0.png | ✅ |
| BLOC 6 | closeGame | Fermeture jeu | N/A | ✅ |
| BLOC 7 | openEventPanel | Ouverture panel événement | v8-31-open-event-panel.png | ✅ |
| BLOC 7 | closeEventPanel | Fermeture panel événement | N/A | ✅ |
| BLOC 7 | participate | Participation événement | v8-32-participate-event.png | ✅ |
| BLOC 7 | cancelEventRegistration | Annulation événement | v8-33-cancel-event.png | ✅ |
| BLOC 8 | openCreateGroupModal | Modal création groupe | v8-36-open-create-group-modal.png | ✅ |
| BLOC 8 | closeCreateGroupModal | Fermeture modal création | N/A | ✅ |
| BLOC 9 | openEditConst | Ouverture constantes | v8-37-open-edit-const.png | ✅ |
| BLOC 9 | saveConst | Sauvegarde constantes | v8-38-save-const.png | ✅ |
| BLOC 9 | closeEditConst | Fermeture constantes | N/A | ✅ |
| BLOC 10 | openDmnPasswordModal | Ouverture modal DMN | v8-39-open-dmn-password-modal.png | ✅ |
| BLOC 10 | confirmDmnPassword | Confirmation mot de passe DMN | v8-40-confirm-dmn-password.png | ✅ |
| BLOC 10 | closeDmnPasswordModal | Fermeture modal DMN | N/A | ✅ |
| BLOC 10 | openDmnQrModal | Ouverture QR DMN | v8-41-open-dmn-qr-modal.png | ✅ |
| BLOC 10 | closeDmnQrModal | Fermeture QR DMN | N/A | ✅ |
| BLOC 10 | openDmnDocs | Ouverture documents DMN | v8-42-open-dmn-docs.png | ✅ |
| BLOC 10 | closeDmnDocsModal | Fermeture documents DMN | N/A | ✅ |
| BLOC 11 | openQrUrg | Ouverture QR urgence | v8-44-open-qr-urg.png | ✅ |
| BLOC 11 | closeQrUrg | Fermeture QR urgence | N/A | ✅ |
| BLOC 12 | openLabRes | Ouverture résultats labo | v8-45-open-lab-res.png | ✅ |
| BLOC 12 | closeLabRes | Fermeture résultats labo | N/A | ✅ |
| BLOC 13 | openModal | Ouverture modal RDV | v8-46-open-modal-rdv.png | ✅ |
| BLOC 13 | closeModal | Fermeture modal RDV | v8-51-close-modal-rdv.png | ✅ |
| BLOC 14 | openChat | Ouverture chat | v8-52-open-chat.png | ✅ |
| BLOC 14 | chatCommunaute | Onglet communauté | v8-53-chat-communaute.png | ✅ |
| BLOC 14 | chatMedecins | Onglet médecins | v8-54-chat-medecins.png | ✅ |
| BLOC 14 | closeChat | Fermeture chat | N/A | ✅ |
| BLOC 15 | Leaderboard | Pas de membre disponible | N/A | ⚠️ |
| BLOC 16 | Vouchers | Pas de voucher actif | N/A | ⚠️ |
| BLOC 17 | toastActivite | Toast activité | v8-61-toast-activite.png | ✅ |
| BLOC 17 | toastSommeil | Toast sommeil | v8-62-toast-sommeil.png | ✅ |
| BLOC 17 | toastNutrition | Toast nutrition | v8-63-toast-nutrition.png | ✅ |
| BLOC 17 | toastHydratation | Toast hydratation | v8-64-toast-hydratation.png | ✅ |
| BLOC 17 | toastConvertir | Toast convertir | v8-65-toast-convertir.png | ✅ |
| BLOC 17 | toastPdf | Toast PDF | v8-66-toast-pdf.png | ✅ |
| BLOC 17 | toastEncourager | Toast encourager | v8-67-toast-encourager.png | ✅ |
| BLOC 17 | toastChat | Toast chat | v8-68-toast-chat.png | ✅ |
| BLOC 17 | toastPartenaire | Toast partenaire | v8-69-toast-partenaire.png | ✅ |
| BLOC 17 | toastReserver | Toast réserver | v8-70-toast-reserver.png | ✅ |
| BLOC 17 | toastPlanifier | Toast planifier | v8-71-toast-planifier.png | ✅ |
| BLOC 17 | toastWhatsapp | Toast WhatsApp | v8-72-toast-whatsapp.png | ✅ |
| BLOC 17 | toastCreerGroupe | Toast créer groupe | v8-73-toast-creer-groupe.png | ✅ |
| BLOC 17 | comingSoon | Toast coming soon | v8-74-coming-soon.png | ✅ |
| BLOC 18 | openProfile | Ouverture profil final | v8-75-open-profile-final.png | ✅ |
| BLOC 18 | closeProfile | Fermeture profil final | N/A | ✅ |
---

## TABLEAU 2 — Conformité contrat API

| Route appelée | success ✓ | data ✓ | error.code ✓ | VERDICT |
|---------------|-----------|--------|--------------|---------|
| https://api.bolamu.co/api/v1/auth/login | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/streaks/me | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/leaderboard/weekly | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/zora/games/play | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/zora/games/play | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/zora/games/play | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/zora/games/play | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/zora/games/play | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/zora/games/play | ❌ | ❌ | ❌ | ❌ |
| https://api.bolamu.co/api/v1/events/ev59 | ❌ | ❌ | ❌ | ❌ |
---

## Logs d'exécution

```
=== Navigation vers login ===
=== Remplissage formulaire login ===
CONTRAT_FAIL: data absent — https://api.bolamu.co/api/v1/auth/login
=== Navigation vers dashboard ===
CONTRAT_FAIL: data absent — https://api.bolamu.co/api/v1/streaks/me
CONTRAT_FAIL: data absent — https://api.bolamu.co/api/v1/leaderboard/weekly
=== ÉTAPE 0 — Vérification protocole ===
✅ Protocole window.__bolamu_test disponible
=== ÉTAPE 1 — Récupération IDs ===
EVENT_ID: ev59
VOUCHER_ID: null
MEMBER_PHONE: undefined
CLUB_ID: null
DMN_DOC_ID: null
RDV_DOCTOR_ID: null
=== BLOC 1 — Navigation sections ===
📸 Screenshot: v8-00-nav-accueil.png
📸 Screenshot: v8-01-nav-gagner.png
📸 Screenshot: v8-02-nav-suivre.png
📸 Screenshot: v8-03-nav-recompenses.png
📸 Screenshot: v8-04-open-profile.png
=== BLOC 2 — Sous-onglets Gagner ===
📸 Screenshot: v8-05-gagner-sport.png
📸 Screenshot: v8-06-gagner-sante.png
=== BLOC 3 — Filtres partenaires ===
📸 Screenshot: v8-07-filter-tout.png
📸 Screenshot: v8-08-filter-clin.png
📸 Screenshot: v8-09-filter-pharm.png
📸 Screenshot: v8-10-filter-labo.png
=== BLOC 4 — Sous-onglets Suivre ===
📸 Screenshot: v8-11-suivre-zora.png
📸 Screenshot: v8-12-suivre-dossier.png
=== BLOC 5 — Filtres récompenses ===
📸 Screenshot: v8-13-filter-cat-tout.png
📸 Screenshot: v8-14-filter-cat-elec.png
📸 Screenshot: v8-15-filter-cat-voyage.png
📸 Screenshot: v8-16-filter-cat-telecom.png
📸 Screenshot: v8-17-filter-cat-hotels.png
📸 Screenshot: v8-18-filter-cat-sport.png
📸 Screenshot: v8-19-filter-cat-beaute.png
📸 Screenshot: v8-20-filter-cat-carburant.png
=== BLOC 6 — Jeux ===
📸 Screenshot: v8-21-open-scratch.png
CONTRAT_FAIL: error.code absent — https://api.bolamu.co/api/v1/zora/games/play
📸 Screenshot: v8-22-play-scratch.png
📸 Screenshot: v8-23-open-wheel.png
CONTRAT_FAIL: error.code absent — https://api.bolamu.co/api/v1/zora/games/play
📸 Screenshot: v8-24-spin-wheel.png
📸 Screenshot: v8-25-open-chest.png
CONTRAT_FAIL: error.code absent — https://api.bolamu.co/api/v1/zora/games/play
📸 Screenshot: v8-26-open-chest-0.png
CONTRAT_FAIL: error.code absent — https://api.bolamu.co/api/v1/zora/games/play
📸 Screenshot: v8-27-open-chest-1.png
CONTRAT_FAIL: error.code absent — https://api.bolamu.co/api/v1/zora/games/play
📸 Screenshot: v8-28-open-chest-2.png
📸 Screenshot: v8-29-open-quiz.png
CONTRAT_FAIL: error.code absent — https://api.bolamu.co/api/v1/zora/games/play
📸 Screenshot: v8-30-pick-quiz-0.png
=== BLOC 7 — Événements ===
Testing with EVENT_ID: ev59
CONTRAT_FAIL: error.code absent — https://api.bolamu.co/api/v1/events/ev59
📸 Screenshot: v8-31-open-event-panel.png
📸 Screenshot: v8-32-participate-event.png
📸 Screenshot: v8-33-cancel-event.png
=== BLOC 8 — Clubs et groupes ===
⚠️ Pas de club disponible
📸 Screenshot: v8-34-open-create-group-modal.png
=== BLOC 9 — Constantes médicales ===
📸 Screenshot: v8-35-open-edit-const.png
📸 Screenshot: v8-36-save-const.png
=== BLOC 10 — DMN ===
📸 Screenshot: v8-37-open-dmn-password-modal.png
📸 Screenshot: v8-38-confirm-dmn-password.png
📸 Screenshot: v8-39-open-dmn-qr-modal.png
📸 Screenshot: v8-40-open-dmn-docs.png
⚠️ Pas de document DMN disponible
=== BLOC 11 — QR urgence ===
📸 Screenshot: v8-41-open-qr-urg.png
=== BLOC 12 — Résultats labo ===
📸 Screenshot: v8-42-open-lab-res.png
=== BLOC 13 — Modal RDV ===
📸 Screenshot: v8-43-open-modal-rdv.png
⚠️ Pas de médecin disponible pour RDV
📸 Screenshot: v8-44-close-modal-rdv.png
=== BLOC 14 — Chat ===
📸 Screenshot: v8-45-open-chat.png
📸 Screenshot: v8-46-chat-communaute.png
📸 Screenshot: v8-47-chat-medecins.png
=== BLOC 15 — Leaderboard ===
⚠️ Pas de membre dans le leaderboard
=== BLOC 16 — Vouchers ===
⚠️ Pas de voucher actif
=== BLOC 17 — Toasts ===
📸 Screenshot: v8-48-toast-activite.png
📸 Screenshot: v8-49-toast-sommeil.png
📸 Screenshot: v8-50-toast-nutrition.png
📸 Screenshot: v8-51-toast-hydratation.png
📸 Screenshot: v8-52-toast-convertir.png
📸 Screenshot: v8-53-toast-pdf.png
📸 Screenshot: v8-54-toast-encourager.png
📸 Screenshot: v8-55-toast-chat.png
📸 Screenshot: v8-56-toast-partenaire.png
📸 Screenshot: v8-57-toast-reserver.png
📸 Screenshot: v8-58-toast-planifier.png
📸 Screenshot: v8-59-toast-whatsapp.png
📸 Screenshot: v8-60-toast-creer-groupe.png
📸 Screenshot: v8-61-coming-soon.png
=== BLOC 18 — Profil ===
📸 Screenshot: v8-62-open-profile-final.png
=== Génération rapport ===
```
