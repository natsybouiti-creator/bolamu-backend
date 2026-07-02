# PROTOCOL TEST BOLAMU
> Langue commune entre DCLogic et Playwright.
> Tout script robot DOIT lire ce fichier avant de tester.
> Toute nouvelle fonctionnalité ajoutée au dashboard
> doit être ajoutée ici ET dans window.__bolamu_test en même temps.

Version 1.0 — 28 juin 2026

---

## 1. Pourquoi ce protocole

DCLogic et Playwright parlent des langues différentes.
Playwright simule des clics DOM standard que DCLogic
ne capte pas correctement en mode headless.
Ce protocole expose toutes les fonctions du dashboard
dans window.__bolamu_test — la langue commune entre les deux.

---

## 2. Règle obligatoire pour tout script robot

Avant tout test, vérifier que le protocole est disponible :

  const ok = await page.evaluate(() => !!window.__bolamu_test)
  if (!ok) throw new Error('Protocole absent — vérifier le dashboard')

Ne jamais cliquer les boutons de navigation directement.
Toujours passer par window.__bolamu_test.

---

## 3. Navigation entre sections

  await page.evaluate(() => window.__bolamu_test.goAccueil())
  await page.evaluate(() => window.__bolamu_test.goGagner())
  await page.evaluate(() => window.__bolamu_test.goSuivre())
  await page.evaluate(() => window.__bolamu_test.goRecompenses())
  await page.evaluate(() => window.__bolamu_test.openProfile())
  await page.evaluate(() => window.__bolamu_test.closeProfile())

  Après chaque navigation : await page.waitForTimeout(3000)

---

## 4. Sous-onglets

  // Gagner
  await page.evaluate(() => window.__bolamu_test.gagnerSport())
  await page.evaluate(() => window.__bolamu_test.gagnerSante())

  // Suivre
  await page.evaluate(() => window.__bolamu_test.suivreZora())
  await page.evaluate(() => window.__bolamu_test.suivreDossier())

---

## 5. Filtres réseau partenaires

  await page.evaluate(() => window.__bolamu_test.filterTout())
  await page.evaluate(() => window.__bolamu_test.filterClin())
  await page.evaluate(() => window.__bolamu_test.filterPharm())
  await page.evaluate(() => window.__bolamu_test.filterLabo())

---

## 6. Filtres récompenses

  await page.evaluate(() => window.__bolamu_test.filterCatTout())
  await page.evaluate(() => window.__bolamu_test.filterCatElec())
  await page.evaluate(() => window.__bolamu_test.filterCatVoyage())
  await page.evaluate(() => window.__bolamu_test.filterCatTelecom())
  await page.evaluate(() => window.__bolamu_test.filterCatHotels())
  await page.evaluate(() => window.__bolamu_test.filterCatSport())
  await page.evaluate(() => window.__bolamu_test.filterCatBeaute())
  await page.evaluate(() => window.__bolamu_test.filterCatCarburant())

---

## 7. Jeux

  await page.evaluate(() => window.__bolamu_test.openScratch())
  await page.evaluate(() => window.__bolamu_test.openWheel())
  await page.evaluate(() => window.__bolamu_test.openChest())
  await page.evaluate(() => window.__bolamu_test.openQuiz())
  await page.evaluate(() => window.__bolamu_test.closeGame())
  await page.evaluate(() => window.__bolamu_test.spinWheel())
  await page.evaluate(() => window.__bolamu_test.openChest0())
  await page.evaluate(() => window.__bolamu_test.openChest1())
  await page.evaluate(() => window.__bolamu_test.openChest2())
  await page.evaluate(() => window.__bolamu_test.pickQuiz0())
  await page.evaluate(() => window.__bolamu_test.pickQuiz1())
  await page.evaluate(() => window.__bolamu_test.pickQuiz2())
  await page.evaluate(() => window.__bolamu_test.pickQuiz3())
  await page.evaluate(() => window.__bolamu_test.playScratch())

---

## 8. Événements

  await page.evaluate(() => window.__bolamu_test.participate(ID))
  await page.evaluate(() => window.__bolamu_test.openEventPanel(ID))
  await page.evaluate(() => window.__bolamu_test.closeEventPanel())
  await page.evaluate(() => window.__bolamu_test.cancelEventRegistration(ID))

---

## 9. Clubs et groupes sport

  await page.evaluate(() => window.__bolamu_test.openClubPanel(ID))
  await page.evaluate(() => window.__bolamu_test.closeClubPanel())
  await page.evaluate(() => window.__bolamu_test.joinClub(ID))
  // joinGroup appelle l'API directement (pas via this)
  const result = await page.evaluate(async () => 
    window.__bolamu_test.joinGroup(ID)
  )
  await page.evaluate(() => window.__bolamu_test.openCreateGroupModal())
  await page.evaluate(() => window.__bolamu_test.closeCreateGroupModal())

---

## 10. Chat

  await page.evaluate(() => window.__bolamu_test.openChat())
  await page.evaluate(() => window.__bolamu_test.openChatReal())
  await page.evaluate(() => window.__bolamu_test.closeChat())
  await page.evaluate(() => window.__bolamu_test.chatCommunaute())
  await page.evaluate(() => window.__bolamu_test.chatMedecins())
  await page.evaluate(() => window.__bolamu_test.sendChatMessage())

---

## 11. Modals DMN

  await page.evaluate(() => window.__bolamu_test.openDmnPasswordModal())
  await page.evaluate(() => window.__bolamu_test.closeDmnPasswordModal())
  await page.evaluate(() => window.__bolamu_test.confirmDmnPassword())
  await page.evaluate(() => window.__bolamu_test.openDmnQrModal())
  await page.evaluate(() => window.__bolamu_test.closeDmnQrModal())
  await page.evaluate(() => window.__bolamu_test.openDmnDocs())
  await page.evaluate(() => window.__bolamu_test.closeDmnDocsModal())
  await page.evaluate(() => window.__bolamu_test.downloadDmnDoc(ID))

---

## 12. Modal QR urgence

  await page.evaluate(() => window.__bolamu_test.openQrUrg())
  await page.evaluate(() => window.__bolamu_test.closeQrUrg())

---

## 13. Modal résultats labo

  await page.evaluate(() => window.__bolamu_test.openLabRes())
  await page.evaluate(() => window.__bolamu_test.closeLabRes())

---

## 14. Modal RDV

  await page.evaluate(() => window.__bolamu_test.openModal())
  await page.evaluate(() => window.__bolamu_test.closeModal())
  await page.evaluate(() => window.__bolamu_test.rdvSelectDoctor('ID'))
  await page.evaluate(() => window.__bolamu_test.rdvSelectDate('2026-07-01'))
  await page.evaluate(() => window.__bolamu_test.rdvSelectSlot('09:00'))
  await page.evaluate(() => window.__bolamu_test.confirmRdv())

---

## 15. Modal constantes médicales

  await page.evaluate(() => window.__bolamu_test.openEditConst())
  await page.evaluate(() => window.__bolamu_test.closeEditConst())
  await page.evaluate(() => window.__bolamu_test.setConstGroupe('O+'))
  await page.evaluate(() => window.__bolamu_test.setConstPoids('70'))
  await page.evaluate(() => window.__bolamu_test.setConstTaille('175'))
  await page.evaluate(() => window.__bolamu_test.setConstAllergies('Aucune'))
  await page.evaluate(() => window.__bolamu_test.setConstMaladies('Aucune'))
  await page.evaluate(() => window.__bolamu_test.setConstAntecedents('Aucun'))
  await page.evaluate(() => window.__bolamu_test.setConstTraitements('Aucun'))
  await page.evaluate(() => window.__bolamu_test.setConstContactNom('Nom'))
  await page.evaluate(() => window.__bolamu_test.setConstContactPhone('+242'))
  await page.evaluate(() => window.__bolamu_test.setConstContactLien('Père'))
  await page.evaluate(() => window.__bolamu_test.saveConst())

---

## 16. Vouchers

  await page.evaluate(() => window.__bolamu_test.closeVoucherModal())
  await page.evaluate(() => window.__bolamu_test.closeVoucherQrModal())

---

## 17. Leaderboard

  await page.evaluate(() => window.__bolamu_test.encourageMember(PHONE))
  await page.evaluate(() => window.__bolamu_test.toggleCommentInput(PHONE))
  await page.evaluate(() => window.__bolamu_test.updateCommentText(PHONE, 'texte'))
  await page.evaluate(() => window.__bolamu_test.sendComment(PHONE))
  await page.evaluate(() => window.__bolamu_test.leaderboardGroupChange('GROUP_ID'))

---

## 18. Toasts

  await page.evaluate(() => window.__bolamu_test.toastEncourager())
  await page.evaluate(() => window.__bolamu_test.toastActivite())
  await page.evaluate(() => window.__bolamu_test.toastSommeil())
  await page.evaluate(() => window.__bolamu_test.toastNutrition())
  await page.evaluate(() => window.__bolamu_test.toastHydratation())
  await page.evaluate(() => window.__bolamu_test.toastCreerGroupe())
  await page.evaluate(() => window.__bolamu_test.toastChat())
  await page.evaluate(() => window.__bolamu_test.toastConvertir())
  await page.evaluate(() => window.__bolamu_test.toastPdf())
  await page.evaluate(() => window.__bolamu_test.toastPartenaire())
  await page.evaluate(() => window.__bolamu_test.toastReserver())
  await page.evaluate(() => window.__bolamu_test.toastPlanifier())
  await page.evaluate(() => window.__bolamu_test.toastWhatsapp())

---

## 19. Profil

  await page.evaluate(() => window.__bolamu_test.logout())
  await page.evaluate(() => window.__bolamu_test.comingSoon())
  await page.evaluate(() => window.__bolamu_test.stop())

---

## 20. Inspection état (lecture seule)

  await page.evaluate(() => window.__bolamu_test.getState())
  await page.evaluate(() => window.__bolamu_test.getPanel())
  await page.evaluate(() => window.__bolamu_test.getZora())
  await page.evaluate(() => window.__bolamu_test.getEvents())
  await page.evaluate(() => window.__bolamu_test.getLedger())
  await page.evaluate(() => window.__bolamu_test.getConstantes())
  await page.evaluate(() => window.__bolamu_test.getVouchers())
  await page.evaluate(() => window.__bolamu_test.getDmnDocs())
  await page.evaluate(() => window.__bolamu_test.getLeaderboard())

---

## 21. Dashboards équipés

| Dashboard   | Fichier                           | Protocole |
|-------------|-----------------------------------|-----------|
| Patient     | public/patient/dashboard.html     | ✅ v1.0   |
| Médecin     | public/medecin/dashboard.html     | ⏳ à faire |
| Secrétaire  | public/secretaire/dashboard.html  | ⏳ à faire |
| Pharmacie   | public/pharmacie/dashboard.html   | ⏳ à faire |
| Laboratoire | public/laboratoire/dashboard.html | ⏳ à faire |
| Animateur   | public/animateur/dashboard.html   | ⏳ à faire |
| Partenaire  | public/partenaire/dashboard.html  | ⏳ à faire |
| RH          | public/rh/dashboard.html          | ⏳ à faire |
| Admin       | public/admin/dashboard.html       | ⏳ à faire |
| Agence      | public/agence/dashboard.html      | ⏳ à faire |

---

## 22. Règle d'extension

Quand une nouvelle fonctionnalité est ajoutée au dashboard :
1. Ajouter la méthode dans window.__bolamu_test dans le dashboard
2. Ajouter la ligne dans ce fichier
3. Les deux évoluent toujours ensemble
4. Mettre à jour la version (v1.0 → v1.1 etc.)
