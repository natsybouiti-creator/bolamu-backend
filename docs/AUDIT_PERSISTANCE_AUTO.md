# Audit persistance automatise — 2026-06-22T04:47:51.205Z

**Compte audite : +242069735418**

**Score : 3/6 actions persistees**

| Action | Avant | Apres | Verdict |
|---|---|---|---|
| Jeu Roue Zora (spinWheel) | `[{"n":0}]` | `[{"n":1}]` | ✅ PERSISTE |
| Jeu Coffre Zora (openChest) | `[{"n":0}]` | `[{"n":1}]` | ✅ PERSISTE |
| Jeu Mayele Quiz (pickQuiz) | `[{"n":0}]` | `[{"n":0}]` | ❌ NON PERSISTE |
| Jeu Grattage Zora (scratch canvas) | `[{"n":0}]` | `[{"n":1}]` | ✅ PERSISTE |
| Inscription evenement Elonga (participate) | `[{"n":0}]` | `[{"n":0}]` | ❌ NON PERSISTE |
| Constantes medicales (saveConst) | `[{"poids":null,"taille":null,"groupe_sanguin":"A-","allergies":null,"maladies_chroniques":null,"antecedents_medicaux":null,"traitements_en_cours":null,"contact_urgence_nom":null,"contact_urgence_phone":null,"contact_urgence_lien":null}]` | `[{"poids":null,"taille":null,"groupe_sanguin":"A-","allergies":null,"maladies_chroniques":null,"antecedents_medicaux":null,"traitements_en_cours":null,"contact_urgence_nom":null,"contact_urgence_phone":null,"contact_urgence_lien":null}]` | ❌ NON PERSISTE |

> Les constantes medicales modifiees pendant l'audit sont restaurees a leur valeur d'origine par le projet `restore` (teardown).
