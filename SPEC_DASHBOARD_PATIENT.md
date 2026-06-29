# SPEC DASHBOARD PATIENT
# Cahier des charges fonctionnel — Éléments interactifs

**Fichier analysé :** `public/patient/dashboard.html`  
**Date :** 28 juin 2026  
**Portée :** Lecture seule — Aucune modification

---

## TABLEAU DES ÉLÉMENTS INTERACTIFS

### SECTION ACCUEIL

| data-testid / repère | Handler appelé | Route backend (si fetch) | Comportement attendu |
|----------------------|----------------|---------------------------|----------------------|
| nav-accueil | goAccueil | - | Bascule sur la vue Accueil (panel: 'accueil') |
| nav-gagner | goGagner | - | Bascule sur la vue Gagner (panel: 'gagner') |
| nav-suivre | goSuivre | - | Bascule sur la vue Suivre (panel: 'suivre') |
| nav-recompenses | goRecompenses | - | Bascule sur la vue Récompenses (panel: 'reward') |
| btn-profil | openProfile | - | Ouvre le panel Profil (profileOpen: true) |
| openChatReal | openChatReal | GET /api/v1/chat/conversations/1/messages | Ouvre le chat, charge les messages, connecte Socket.io |
| goRecompenses (lien "Tout voir") | goRecompenses | - | Bascule sur la vue Récompenses |
| it.onExchange (récompense) | redeemVoucher | POST /api/v1/vouchers/generate | Génère un voucher, ouvre modal avec QR code |
| participate-{{ev.dbId}} | participate | POST /api/v1/events/{id}/register | Inscrit à l'événement, affiche toast confirmation |
| openEventPanel({{ev.dbId}}) | openEventPanel | GET /api/v1/events/{id} | Ouvre panel détail événement avec participants |
| cancelEventRegistration('{{reg.event_id}}') | cancelEventRegistration | DELETE /api/v1/events/{id}/register | Annule l'inscription à l'événement, recharge la page |
| closeEventPanel | closeEventPanel | - | Ferme le panel détail événement |
| openParticipantPanel | openParticipantPanel | - | Ouvre panel profil participant |
| closeParticipantPanel | closeParticipantPanel | - | Ferme le panel profil participant |
| openClubPanel({{group.id}}) | openClubPanel | GET /api/v1/clubs/{id} | Ouvre panel détail club avec membres |
| closeClubPanel | closeClubPanel | - | Ferme le panel détail club |
| joinClub({{group.id}}) | joinClub | POST /api/v1/clubs/{id}/join | Rejoint le club, affiche toast "Groupe rejoint !" |
| lr.onEncourage | encourageMember | - | Décoratif — toast "Fonctionnalité bientôt disponible" |
| lr.onComment | toggleCommentInput | - | Ouvre/ferme input commentaire pour un membre |
| lr.sendComment | sendComment | - | Décoratif — toast "Fonctionnalité bientôt disponible" |
| toastEncourager | toastEncourager | - | Décoratif — toast "Classement bientôt disponible" |

---

### SECTION GAGNER

| data-testid / repère | Handler appelé | Route backend (si fetch) | Comportement attendu |
|----------------------|----------------|---------------------------|----------------------|
| gagnerSport | gagnerSport | - | Bascule sur l'onglet Sport (gagnerTab: 'sport') |
| tab-sante | gagnerSante | - | Bascule sur l'onglet Santé (gagnerTab: 'sante') |
| toastActivite (boutons "En cours", "Démarrer", "Commencer") | toastActivite | - | Décoratif — toast "Suivi d'activité bientôt disponible" |
| toastSommeil | toastSommeil | - | Décoratif — toast "Suivi du sommeil bientôt disponible" |
| toastNutrition | toastNutrition | - | Décoratif — toast "Suivi nutrition bientôt disponible" |
| toastHydratation | toastHydratation | - | Décoratif — toast "Suivi hydratation bientôt disponible" |
| participate-{{ev.dbId}} (onglet Sport) | participate | POST /api/v1/events/{id}/register | Inscrit à l'événement, affiche toast confirmation |
| openModal | openModal | - | Ouvre modal prise de rendez-vous |
| toastReserver | toastReserver | - | Décoratif — toast "Réservation bientôt disponible" |
| toastPlanifier | toastPlanifier | - | Décoratif — toast "Planification bientôt disponible" |
| toastWhatsapp | toastWhatsapp | - | Décoratif — toast "Parrainage WhatsApp bientôt disponible" |
| filterTout | filterTout | - | Filtre carte "Tout" (mapFilter: 'tout') |
| filterClin | filterClin | - | Filtre carte "Cliniques" (mapFilter: 'cliniques') |
| filterPharm | filterPharm | - | Filtre carte "Pharmacies" (mapFilter: 'pharmacies') |
| filterLabo | filterLabo | - | Filtre carte "Labos" (mapFilter: 'labos') |
| openCreateGroupModal | openCreateGroupModal | - | Ouvre modal création de groupe |
| toastPartenaire (cartes partenaires) | toastPartenaire | - | Décoratif — toast "Bientôt disponible" |

---

### SECTION SUIVRE

| data-testid / repère | Handler appelé | Route backend (si fetch) | Comportement attendu |
|----------------------|----------------|---------------------------|----------------------|
| suivreZora | suivreZora | - | Bascule sur l'onglet Mes Zora (suivreTab: 'zora') |
| btn-dossier-medical | suivreDossier | - | Bascule sur l'onglet Mon dossier médical (suivreTab: 'dossier') |
| toastConvertir | toastConvertir | - | Décoratif — toast "Conversion Zora Cash bientôt disponible" |
| {{v.qrTestid}} (QR voucher) | showQr | - | Ouvre modal QR code du voucher |
| const-edit | openEditConst | - | Ouvre modal édition constantes médicales |
| btn-download-dmn | openDmnPasswordModal | - | Ouvre modal mot de passe DMN |
| openQrUrg | openQrUrg | - | Ouvre modal QR urgence |
| btn-dmn-qr | openDmnQrModal | generateDmnQr | GET /api/v1/dmn/qr-payload | Génère QR médical DMN, ouvre modal |
| {{g.testid}} (jeux) | onPlay | - | Ouvre modal du jeu (scratch/wheel/chest/quiz) |
| goGagner (lien "Pas de partie gratuite") | goGagner | - | Bascule sur la vue Gagner |

---

### SECTION RÉCOMPENSES

| data-testid / repère | Handler appelé | Route backend (si fetch) | Comportement attendu |
|----------------------|----------------|---------------------------|----------------------|
| filterCatTout | filterCatTout | - | Filtre catégorie "Tout" (filterCategorie: 'tout') |
| filterCatElec | filterCatElec | - | Filtre catégorie "Électronique" |
| filterCatVoyage | filterCatVoyage | - | Filtre catégorie "Voyage" |
| filterCatTelecom | filterCatTelecom | - | Filtre catégorie "Télécom" |
| filterCatHotels | filterCatHotels | - | Filtre catégorie "Hôtels" |
| filterCatSport | filterCatSport | - | Filtre catégorie "Sport" |
| filterCatBeaute | filterCatBeaute | - | Filtre catégorie "Beauté" |
| filterCatCarburant | filterCatCarburant | - | Filtre catégorie "Carburant" |
| toastPartenaire (cartes récompenses) | toastPartenaire | - | Décoratif — toast "Bientôt disponible" |
| {{a.onPick}} (option quiz) | onPick | POST /api/v1/zora/games/play | Joue au quiz, affiche résultat + points gagnés |
| wheel-spin | spinWheel | POST /api/v1/zora/games/play | Tourne la roue, affiche résultat + points gagnés |
| {{c.onOpen}} (coffre) | onOpen | POST /api/v1/zora/games/play | Ouvre le coffre, affiche récompense + points |
| close-voucher-modal | closeVoucherModal | - | Ferme modal voucher |
| close-voucher-btn | closeVoucherModal | - | Ferme modal voucher |
| close-voucher-qr-modal | closeVoucherQrModal | - | Ferme modal QR voucher |
| close-voucher-qr-btn | closeVoucherQrModal | - | Ferme modal QR voucher |

---

### SECTION PROFIL

| data-testid / repère | Handler appelé | Route backend (si fetch) | Comportement attendu |
|----------------------|----------------|---------------------------|----------------------|
| close-dmn-password-modal | closeDmnPasswordModal | - | Ferme modal mot de passe DMN |
| confirmDmnPassword | verifyDmnPassword | POST /api/v1/dmn/download/verify | Vérifie mot de passe, charge liste documents |
| close-dmn-docs-modal | closeDmnDocsModal | - | Ferme modal documents DMN |
| {{dd.onDownload}} (télécharger document) | downloadDmnDoc | GET /api/v1/dmn/download/{docId} | Télécharge le document via URL temporaire |
| close-dmn-qr-modal | closeDmnQrModal | - | Ferme modal QR médical |
| close-dmn-qr-btn | closeDmnQrModal | - | Ferme modal QR médical |
| const-poids (input) | constPoids | - | Met à jour state.constForm.poids |
| const-taille (input) | constTaille | - | Met à jour state.constForm.taille |
| const-allergies (input) | constAllergies | - | Met à jour state.constForm.allergies |
| const-maladies (input) | constMaladies | - | Met à jour state.constForm.maladies_chroniques |
| const-antecedents (input) | constAntecedents | - | Met à jour state.constForm.antecedents_medicaux |
| const-traitements (input) | constTraitements | - | Met à jour state.constForm.traitements_en_cours |
| const-contact-nom (input) | constContactNom | - | Met à jour state.constForm.contact_urgence_nom |
| const-contact-phone (input) | constContactPhone | - | Met à jour state.constForm.contact_urgence_phone |
| const-contact-lien (input) | constContactLien | - | Met à jour state.constForm.contact_urgence_lien |
| saveConst | saveConst | POST /api/v1/patients/constantes | Sauvegarde constantes médicales, affiche toast |
| rdvSelectDoctor (select) | rdvSelectDoctor | GET /api/v1/appointments/slots/{doctorId}?date={date} | Charge les créneaux disponibles |
| rdvSelectDate (select) | rdvSelectDate | GET /api/v1/appointments/slots/{doctorId}?date={date} | Charge les créneaux disponibles |
| rdvSelectSlot (select) | rdvSelectSlot | - | Sélectionne le créneau horaire |
| confirmRdv | confirmRdv | POST /api/v1/appointments/book | Confirme le rendez-vous, affiche toast |
| closeModal | closeModal | - | Ferme modal RDV |
| closeEditConst | closeEditConst | - | Ferme modal édition constantes |
| closeQrUrg | closeQrUrg | - | Ferme modal QR urgence |
| closeProfile | closeProfile | - | Ferme panel Profil |
| logout | logout | - | Vide localStorage, redirige vers /login.html |

---

### MODALS & JEUX

| data-testid / repère | Handler appelé | Route backend (si fetch) | Comportement attendu |
|----------------------|----------------|---------------------------|----------------------|
| closeGame | closeGame | - | Ferme modal jeu (scratch/wheel/chest/quiz) |
| play-scratch (canvas) | playScratch | POST /api/v1/zora/games/play | Joue au grattage, affiche points gagnés |
| openCreateClubModal (bouton création) | openCreateGroupModal | - | Décoratif — toast "Création de groupe bientôt disponible" |
| closeCreateClubModal | closeCreateClubModal | - | Ferme modal création club |
| createClub | createClub | POST /api/v1/clubs | Crée un club, recharge la page |
| joinEvent (bouton panel événement) | joinEvent | POST /api/v1/events/{id}/register | Inscrit à l'événement, met à jour bouton |
| toggleFollow | toggleFollow | - | Décoratif — toast "Fonctionnalité bientôt disponible" |
| startChat | startChat | POST /api/v1/chat/conversations | Crée conversation, affiche alert |
| joinClub (bouton panel club) | joinClub | POST /api/v1/clubs/{id}/join | Rejoint le club, met à jour bouton |
| sendChatMessage | sendChatMessage | POST /api/v1/chat/conversations/1/messages | Envoie message chat, émet via Socket.io |
| leaderboardGroupChange (select) | leaderboardGroupChange | GET /api/v1/leaderboard/weekly?group_id={id} | Charge leaderboard filtré par groupe |

---

## BOUTONS DÉCORATIFS (TOAST "BIENTÔT DISPONIBLE")

Ces boutons ne sont PAS des bugs — ils affichent intentionnellement un toast "bientôt disponible" :

1. **toastActivite** — Suivi d'activité (4 boutons : "En cours", "Démarrer", "Commencer", "Démarrer")
2. **toastSommeil** — Suivi du sommeil (2 boutons : "Suivre mon sommeil", "Activer")
3. **toastNutrition** — Suivi nutrition (2 boutons : "Remplir", "M'inscrire")
4. **toastHydratation** — Suivi hydratation (1 bouton : "Suivre")
5. **toastEncourager** — Classement (1 bouton : "Voir tout · Encourager")
6. **toastConvertir** — Conversion Zora Cash (1 bouton)
7. **toastReserver** — Réservation (1 bouton)
8. **toastPlanifier** — Planification (1 bouton)
9. **toastWhatsapp** — Parrainage WhatsApp (1 bouton)
10. **toastPartenaire** — Cartes partenaires (11 boutons)
11. **toastChat** — Chat (1 bouton)
12. **toastPdf** — Téléchargement PDF (1 bouton)
13. **encourageMember** — Encourager membre leaderboard (1 bouton)
14. **sendComment** — Envoyer commentaire leaderboard (1 bouton)
15. **openCreateGroupModal** — Création de groupe (1 bouton)
16. **toggleFollow** — Suivre participant (1 bouton)

**Total boutons décoratifs : 29**

---

## ROUTES BACKEND APPELÉES (liste unique)

### Authentification & Profil
- `GET /api/v1/patients/profil?phone={phone}`
- `GET /api/v1/patients/subscription?phone={phone}`

### Zora & Gamification
- `GET /api/v1/zora/balance`
- `GET /api/v1/zora/balance?phone={phone}`
- `GET /api/v1/zora/ledger?limit=10`
- `GET /api/v1/zora/games/config`
- `POST /api/v1/zora/games/play` (scratch, wheel, chest, quiz)
- `POST /api/v1/zora/redeem`
- `GET /api/v1/streaks/me`

### Événements Elonga
- `GET /api/v1/events`
- `GET /api/v1/events/{id}`
- `GET /api/v1/events/{id}/participants`
- `POST /api/v1/events/{id}/register`
- `DELETE /api/v1/events/{id}/register`
- `GET /api/v1/events/my/registrations`

### Groupes & Clubs
- `GET /api/v1/sport-groups`
- `GET /api/v1/clubs`
- `GET /api/v1/clubs/{id}`
- `GET /api/v1/clubs/{id}/members`
- `POST /api/v1/clubs/{id}/join`
- `POST /api/v1/clubs`

### Leaderboard
- `GET /api/v1/leaderboard/weekly`
- `GET /api/v1/leaderboard/weekly?group_id={id}`

### Récompenses & Vouchers
- `GET /api/v1/zora/rewards`
- `POST /api/v1/vouchers/generate`
- `GET /api/v1/vouchers/my`

### DMN (Dossier Médical Numérique)
- `GET /api/v1/dmn/access-log`
- `POST /api/v1/dmn/download/verify`
- `GET /api/v1/dmn/summary`
- `GET /api/v1/dmn/download/{docId}`
- `GET /api/v1/dmn/qr-payload`

### Constantes médicales
- `GET /api/v1/patients/constantes/{phone}`
- `POST /api/v1/patients/constantes`

### RDV & Médecins
- `GET /api/v1/doctors`
- `GET /api/v1/appointments/slots/{doctorId}?date={date}`
- `POST /api/v1/appointments/book`

### Rapports & Timeline
- `GET /api/v1/reports/patient/{phone}/timeline`
- `GET /api/v1/reports/access-log/{phone}`

### Chat
- `GET /api/v1/chat/conversations/1/messages`
- `POST /api/v1/chat/conversations/1/messages`
- `POST /api/v1/chat/conversations`

### QR Code
- `GET /api/v1/qr/generate`

**Total routes backend uniques : 35**

---

## RÉCAPITULATIF

**Nombre total de boutons recensés : 89**

**Répartition par section :**
- Accueil : 20 boutons
- Gagner : 17 boutons
- Suivre : 8 boutons
- Récompenses : 12 boutons
- Profil : 18 boutons
- Modals & Jeux : 14 boutons

**Boutons décoratifs (toast bientôt disponible) : 29**  
**Boutons fonctionnels (avec backend ou navigation) : 60**  
**Routes backend appelées : 35**
