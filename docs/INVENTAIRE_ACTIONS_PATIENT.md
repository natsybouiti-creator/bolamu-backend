# INVENTAIRE DES ACTIONS PATIENT — DASHBOARD V3

**Fichier analysé :** `public/patient/dashboard-v3-design.html`  
**Date de l'inventaire :** 25 avril 2026  
**Version dashboard :** V3 Design (gamification Zora)

---

## LÉGENDE

- **Endpoint API** : URL de l'endpoint appelé (si visible dans le code)
- **Persistance** : `DB` = écriture en base de données, `LOCAL` = état local uniquement, `VISUEL` = effet visuel temporaire
- **Notification** : `TOAST` = notification in-app, `WHATSAPP` = notification WhatsApp, `AUCUNE` = pas de notification
- **À VÉRIFIER** : l'endpoint ou l'effet n'est pas visible dans le code frontend et nécessite une vérification backend

---

## TABLEAU DES ACTIONS

| # | Action | Location (Tab > Section) | Endpoint API | Persistance | Notification | Notes |
|---|--------|---------------------------|--------------|-------------|--------------|-------|
| **NAVIGATION** |
| 1 | `goAccueil` | Header > Navigation bouton Accueil | Aucune | LOCAL | AUCUNE | Change state.panel = 'accueil', scroll top |
| 2 | `goGagner` | Header > Navigation bouton Gagner | Aucune | LOCAL | AUCUNE | Change state.panel = 'gagner', init maps |
| 3 | `goSuivre` | Header > Navigation bouton Suivre | Aucune | LOCAL | AUCUNE | Change state.panel = 'suivre', render QR dossier |
| 4 | `goRecompenses` | Header > Navigation bouton Récompenses | Aucune | LOCAL | AUCUNE | Change state.panel = 'reward', init scratch |
| 5 | `closeProfile` | Profil > Bouton Retour | Aucune | LOCAL | AUCUNE | Change state.profileOpen = false |
| **HEADER** |
| 6 | `openChat` | Header > Icône forum | Aucune | LOCAL | AUCUNE | Change state.chatOpen = true |
| 7 | `openProfile` | Header > Avatar patient | Aucune | LOCAL | AUCUNE | Change state.profileOpen = true |
| **ACCUEIL** |
| 8 | `goRecompenses` (reward band) | Accueil > Hero > Bande récompenses | Aucune | LOCAL | AUCUNE | Même action que #4, appelée depuis reward band |
| 9 | `participate(id)` | Accueil > Événements > Bouton Participer | À VÉRIFIER | LOCAL | TOAST | Met à jour events.registered = true, toast "Inscription confirmée · +50 Zora après participation" |
| 10 | `focusEvent(id)` | Accueil > Carte événements > Focus sur marker | Aucune | VISUEL | AUCUNE | Zoom map sur marker événement |
| **GAGNER > SPORT** |
| 11 | `gagnerSport` | Gagner > Sous-onglet Sport & Activité | Aucune | LOCAL | AUCUNE | Change state.gagnerTab = 'sport', init events map |
| 12 | `gagnerSante` | Gagner > Sous-onglet Santé | Aucune | LOCAL | AUCUNE | Change state.gagnerTab = 'sante', init reseau map |
| 13 | Bouton "En cours" (10 000 pas) | Gagner > Sport > Carte 10 000 pas | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 14 | Bouton "Démarrer" (Séance sport) | Gagner > Sport > Carte Séance sport | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 15 | Bouton "Commencer" (Méditation) | Gagner > Sport > Carte Méditation | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 16 | Bouton "Démarrer" (Atelier respiration) | Gagner > Sport > Carte Atelier respiration | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 17 | Bouton "Suivre mon sommeil" | Gagner > Sommeil > Carte Dormir 7h+ | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 18 | Bouton "Activer" (Heure coucher) | Gagner > Sommeil > Carte Heure coucher | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 19 | Bouton "Remplir" (Journal alimentaire) | Gagner > Nutrition > Carte Journal alimentaire | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 20 | Bouton "Suivre" (Hydratation) | Gagner > Nutrition > Carte Hydratation | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 21 | Bouton "M'inscrire" (Atelier nutrition) | Gagner > Nutrition > Carte Atelier nutrition | Aucune | VISUEL | AUCUNE | Bouton statique, pas d'action visible |
| 22 | `participate(id)` (événements sport) | Gagner > Sport > Événements > Bouton Participer | À VÉRIFIER | LOCAL | TOAST | Même action que #9 |
| 23 | `focusEvent(id)` (carte événements) | Gagner > Sport > Carte événements > Focus | Aucune | VISUEL | AUCUNE | Même action que #10 |
| **GAGNER > SANTÉ** |
| 24 | Bouton "Prendre RDV" (Consultation) | Gagner > Santé > Carte Consultation médicale | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| 25 | Bouton "Réserver" (Analyse labo) | Gagner > Santé > Carte Analyse laboratoire | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| 26 | Bouton "Planifier" (Bilan annuel) | Gagner > Santé > Carte Bilan annuel complet | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| 27 | Bouton "Inviter via WhatsApp" (Parrainage) | Gagner > Santé > Carte Parrainer un ami | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| 28 | `filterTout` | Gagner > Santé > Réseau partenaires > Filtre Tout | Aucune | LOCAL | AUCUNE | Change state.mapFilter = 'tout', applique filtre map |
| 29 | `filterClin` | Gagner > Santé > Réseau partenaires > Filtre Cliniques | Aucune | LOCAL | AUCUNE | Change state.mapFilter = 'cliniques' |
| 30 | `filterPharm` | Gagner > Santé > Réseau partenaires > Filtre Pharmacies | Aucune | LOCAL | AUCUNE | Change state.mapFilter = 'pharmacies' |
| 31 | `filterLabo` | Gagner > Santé > Réseau partenaires > Filtre Labos | Aucune | LOCAL | AUCUNE | Change state.mapFilter = 'labos' |
| 32 | `focusReseau(id)` | Gagner > Santé > Réseau partenaires > Focus marker | Aucune | VISUEL | AUCUNE | Zoom map sur marker partenaire |
| **SUIVRE > ZORA** |
| 33 | `suivreZora` | Suivre > Sous-onglet Mes Zora | Aucune | LOCAL | AUCUNE | Change state.suivreTab = 'zora' |
| 34 | Bouton "Convertir en Zora Cash (MoMo)" | Suivre > Zora > Historique points | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| **SUIVRE > DOSSIER MÉDICAL** |
| 35 | `suivreDossier` | Suivre > Sous-onglet Mon dossier médical | Aucune | LOCAL | AUCUNE | Change state.suivreTab = 'dossier', render QR dossier |
| 36 | `openEditConst` | Suivre > Dossier > Constantes médicales > Modifier | Aucune | LOCAL | AUCUNE | Change state.editConst = true, ouvre modal |
| 37 | `saveConst` | Modal Constantes > Bouton Enregistrer | À VÉRIFIER | LOCAL | TOAST | Change state.editConst = false, toast "Constantes mises à jour" - API non visible |
| 38 | `openQrUrg` | Suivre > Dossier > QR urgence > Générer | Aucune | LOCAL | AUCUNE | Change state.qrUrg = true, render QR urgence |
| 39 | `openLabRes` | Suivre > Dossier > Consultation > Résultats labo > Voir | Aucune | LOCAL | AUCUNE | Change state.labRes = true, ouvre modal résultats |
| 40 | Bouton "Télécharger le PDF" | Modal Résultats labo > Télécharger | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| **RÉCOMPENSES** |
| 41 | `onExchange` (reward band) | Récompenses > Bande récompenses > Échanger | Aucune | LOCAL | AUCUNE | Navigate vers onglet reward (goRecompenses) |
| 42 | `onPlay` (jeu scratch) | Récompenses > Salle de jeux > Grattage Zora > Jouer | Aucune | LOCAL | TOAST | Ouvre modal scratch, décrémente freeGames, crédite Zora localement |
| 43 | `onPlay` (jeu wheel) | Récompenses > Salle de jeux > Roue Zora > Jouer | Aucune | LOCAL | TOAST | Ouvre modal wheel, décrémente freeGames, crédite Zora localement |
| 44 | `onPlay` (jeu chest) | Récompenses > Salle de jeux > Coffre Zora > Jouer | Aucune | LOCAL | TOAST | Ouvre modal chest, décrémente freeGames, crédite Zora localement |
| 45 | `onPlay` (jeu quiz) | Récompenses > Salle de jeux > Mayele Quiz > Jouer | Aucune | LOCAL | TOAST | Ouvre modal quiz, décrémente freeGames, crédite Zora localement |
| 46 | `goGagner` (pas de partie gratuite) | Récompenses > Lien "Pas de partie gratuite ?" | Aucune | LOCAL | AUCUNE | Même action que #2 |
| 47 | Filtres catégorie (Tout, Électronique, etc.) | Récompenses > Filtres catalogue | Aucune | VISUEL | AUCUNE | Boutons statiques, pas d'action visible |
| **JEUX ZORA** |
| 48 | `closeGame` | Modal jeux > Bouton fermer | Aucune | LOCAL | AUCUNE | Change state.game = null |
| 49 | `spinWheel` | Modal Roue > Bouton "Tourner la roue" | Aucune | LOCAL | TOAST | Simule rotation, crédite Zora localement, toast "+X Zora gagnés" |
| 50 | `openChest(i)` | Modal Coffre > Clic sur coffre | Aucune | LOCAL | TOAST | Révèle récompense, crédite Zora localement, toast "+X Zora trouvés" |
| 51 | `pickQuiz(i)` | Modal Quiz > Clic sur réponse | Aucune | LOCAL | TOAST | Vérifie réponse, crédite Zora si correct, toast "+25 Zora · bonne réponse !" |
| 52 | Grattage canvas (scratch) | Modal Grattage > Gratter canvas | Aucune | LOCAL | TOAST | Canvas interaction, crédite 100 Zora après 55% gratté, toast "+100 Zora gagnés" |
| **CHAT** |
| 53 | `closeChat` | Chat drawer > Bouton fermer | Aucune | LOCAL | AUCUNE | Change state.chatOpen = false |
| 54 | `chatCommunaute` | Chat > Onglet Communauté | Aucune | LOCAL | AUCUNE | Change state.chatTab = 'communaute' |
| 55 | `chatMedecins` | Chat > Onglet Médecins | Aucune | LOCAL | AUCUNE | Change state.chatTab = 'medecins' |
| 56 | Bouton "Commenter" | Chat > Message communauté > Commenter | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| 57 | Bouton "Suivre" | Chat > Message groupe > Suivre | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Bouton statique dans HTML, action non visible dans JS |
| 58 | Input message + bouton send | Chat > Input message + Send | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Input statique dans HTML, action non visible dans JS |
| **MODAL RDV** |
| 59 | `openModal` | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Fonction définie mais jamais appelée dans le code visible |
| 60 | `closeModal` | Modal RDV > Bouton Annuler | Aucune | LOCAL | AUCUNE | Change state.modal = false |
| 61 | `closeModal` | Modal RDV > Bouton Confirmer | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Appelle closeModal mais pas d'action de soumission visible |
| **MODAL CONSTANTES** |
| 62 | `closeEditConst` | Modal Constantes > Bouton Annuler | Aucune | LOCAL | AUCUNE | Change state.editConst = false |
| 63 | `saveConst` | Modal Constantes > Bouton Enregistrer | À VÉRIFIER | LOCAL | TOAST | Voir #37 |
| **MODAL QR URGENCE** |
| 64 | `closeQrUrg` | Modal QR urgence > Bouton fermer | Aucune | LOCAL | AUCUNE | Change state.qrUrg = false |
| **MODAL RÉSULTATS LABO** |
| 65 | `closeLabRes` | Modal Résultats labo > Bouton fermer | Aucune | LOCAL | AUCUNE | Change state.labRes = false |
| **PROFIL** |
| 66 | SettingRow "Mes informations" | Profil > Mes informations | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Composant statique, pas d'action visible |
| 67 | SettingRow "Notifications" | Profil > Notifications | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Composant statique, pas d'action visible |
| 68 | SettingRow "Confidentialité & données" | Profil > Confidentialité | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Composant statique, pas d'action visible |
| 69 | SettingRow "Moyens de paiement (MoMo)" | Profil > Moyens de paiement | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Composant statique, pas d'action visible |
| 70 | SettingRow "Langue (FR / Lingala)" | Profil > Langue | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Composant statique, pas d'action visible |
| 71 | SettingRow "Déconnexion" | Profil > Déconnexion | À VÉRIFIER | À VÉRIFIER | À VÉRIFIER | Composant statique avec danger=true, pas d'action visible |

---

## APPELS API AUTOMATIQUES (componentDidMount)

| # | Endpoint | Méthode | Persistance | Notification | Notes |
|---|----------|---------|-------------|--------------|-------|
| 72 | `/api/v1/patients/profil?phone=...` | GET | LOCAL (lecture) | AUCUNE | Charge profil patient, stocke dans variables locales |
| 73 | `/api/v1/zora/balance` | GET | LOCAL (lecture) | AUCUNE | Charge solde Zora, animation compteur |
| 74 | `/api/v1/streaks/me` | GET | LOCAL (lecture) | AUCUNE | Charge streak actuel et record |
| 75 | `/api/v1/events` | GET | LOCAL (lecture) | AUCUNE | Charge événements Elonga (max 5) |
| 76 | `/api/v1/leaderboard/weekly` | GET | LOCAL (lecture) | AUCUNE | Charge leaderboard hebdo (top 5) |
| 77 | `/api/v1/zora/balance?phone=...` | GET | LOCAL (lecture) | AUCUNE | Charge palier Zora (tier, next_tier, points_to_next) |
| 78 | `/api/v1/sport-groups` | GET | LOCAL (lecture) | AUCUNE | Charge groupes de sport |
| 79 | `/api/v1/zora/ledger?limit=10` | GET | LOCAL (lecture) | AUCUNE | Charge historique Zora (10 derniers) |
| 80 | `/api/v1/patients/subscription?phone=...` | GET | LOCAL (lecture) | AUCUNE | Charge abonnement patient |
| 81 | `/api/v1/patients/constantes/...` | GET | LOCAL (lecture) | AUCUNE | Charge constantes médicales |
| 82 | `/api/v1/reports/patient/.../timeline` | GET | LOCAL (lecture) | AUCUNE | Charge timeline consultations |
| 83 | `/api/v1/reports/access-log/...` | GET | LOCAL (lecture) | AUCUNE | Charge historique accès dossier |
| 84 | `/api/v1/zora/games/config` | GET | LOCAL (lecture) | AUCUNE | Charge configuration jeux Zora |
| 85 | `/api/v1/qr/generate` | GET | LOCAL (lecture) | AUCUNE | Génère QR identification, rotation 60s via interval |

---

## ACTIONS SANS API VISIBLE (À VÉRIFIER BACKEND)

Les actions suivantes ont un bouton dans l'interface mais aucune logique JavaScript visible dans le fichier frontend. Elles nécessitent une vérification du code backend pour déterminer l'endpoint et l'effet de persistance :

- **#24** : Prendre RDV (consultation médicale)
- **#25** : Réserver (analyse laboratoire)
- **#26** : Planifier (bilan annuel)
- **#27** : Inviter via WhatsApp (parrainage)
- **#34** : Convertir en Zora Cash (MoMo)
- **#37** : Enregistrer constantes médicales
- **#40** : Télécharger PDF résultats labo
- **#59** : openModal (jamais appelée)
- **#61** : Confirmer RDV (modal)
- **#66-71** : SettingRow (profil)

---

## OBSERVATIONS IMPORTANTES

1. **Jeux Zora (#42-52)** : Tous les jeux (grattage, roue, coffre, quiz) n'ont PAS d'appel API visible. Les points sont crédités localement dans l'état frontend (`addZora()`) sans persistance backend visible. **Ceci est un problème critique** - les gains ne sont probablement pas sauvegardés en base de données.

2. **Participer événement (#9, #22)** : La fonction `participate(id)` met à jour l'état local (`registered: true`) et affiche un toast, mais aucun appel API n'est visible. L'inscription aux événements Elonga n'est probablement pas persistée.

3. **Constantes médicales (#37)** : La fonction `saveConst()` ferme simplement la modal et affiche un toast, sans appel API visible. Les modifications ne sont probablement pas sauvegardées.

4. **Actions statiques** : De nombreux boutons dans l'interface (défis sport, santé, filtres catalogue) sont purement visuels sans aucune logique JavaScript attachée.

5. **Endpoints de lecture uniquement** : Tous les appels API visibles dans `componentDidMount` sont des GET en lecture seule. Aucun POST/PUT/PATCH n'est visible pour les actions d'écriture.

---

## RECOMMANDATIONS POUR TESTS PLAYWRIGHT

1. **Priorité CRITIQUE** : Tester les jeux Zora pour vérifier si les gains sont persistés en base de données malgré l'absence d'API visible (possibilité d'API cachée ou effet side-effect).

2. **Priorité HAUTE** : Tester l'inscription aux événements Elonga pour vérifier la persistance backend.

3. **Priorité HAUTE** : Tester la modification des constantes médicales pour vérifier la sauvegarde backend.

4. **Priorité MOYENNE** : Tester les boutons statiques (RDV, labo, parrainage) pour déterminer s'ils ont un effet backend non visible dans le frontend.

5. **Priorité BASSE** : Tester la navigation et les actions purement visuelles (filtres, focus map).

---

**Fin de l'inventaire — 85 actions répertoriées**
