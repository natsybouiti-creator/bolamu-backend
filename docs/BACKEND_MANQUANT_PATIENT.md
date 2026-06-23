# BACKEND MANQUANT — Dashboard Patient

**Date :** 23 juin 2026  
**Périmètre :** Routes absentes bloquant des fonctionnalités du dashboard patient vanilla

---

## Routes manquantes confirmées

### 1. Tracking activités physiques (Sport & Activité)

| Bouton | Route attendue | Statut |
|--------|----------------|--------|
| 10 000 pas / jour | `POST /api/v1/patients/activities/steps` | ❌ Inexistante |
| Séance sport 30 min | `POST /api/v1/patients/activities/workout` | ❌ Inexistante |
| Méditation 10 min | `POST /api/v1/patients/activities/meditation` | ❌ Inexistante |
| Historique activités | `GET /api/v1/patients/activities` | ❌ Inexistante |

**Impact :** La section "Sport & Activité" n'a aucune persistance. Les boutons "Démarrer / Commencer" sont désactivés avec message "Bientôt dispo".

---

### 2. Tracking sommeil

| Bouton | Route attendue | Statut |
|--------|----------------|--------|
| Suivre mon sommeil | `POST /api/v1/patients/activities/sleep` | ❌ Inexistante |
| Coucher régulier (5j) | `POST /api/v1/patients/activities/sleep-schedule` | ❌ Inexistante |

---

### 3. Journal alimentaire & Hydratation

| Bouton | Route attendue | Statut |
|--------|----------------|--------|
| Remplir journal alimentaire | `POST /api/v1/patients/nutrition/journal` | ❌ Inexistante |
| Suivi hydratation | `POST /api/v1/patients/nutrition/water` | ❌ Inexistante |

---

### 4. Parrainage patient

| Bouton | Route attendue | Statut |
|--------|----------------|--------|
| Inviter via WhatsApp | `POST /api/v1/patients/referral` | ❌ Inexistante |

**Workaround actuel :** Ouvre WhatsApp directement avec un lien texte contenant le bolamu_id du patient. Aucun point Zora n'est crédité car il n'y a pas de tracking de parrainage côté backend.

---

### 5. Téléchargement PDF des résultats

| Bouton | Route attendue | Statut |
|--------|----------------|--------|
| Télécharger le PDF (résultats labo) | `GET /api/v1/reports/patient/:phone/pdf` | ❌ Inexistante |

**Note :** La route `/api/v1/reports/patient/:phone/timeline` existe et retourne l'historique de consultations, mais aucune route de génération PDF n'est exposée.

---

### 6. Conversion Zora en Cash MoMo

| Bouton | Route attendue | Statut |
|--------|----------------|--------|
| Convertir en Zora Cash | `POST /api/v1/zora/cashout` | ❌ Inexistante |

**Note :** Routes disponibles : `/api/v1/zora/balance`, `/api/v1/zora/ledger`, `/api/v1/zora/rewards`, `/api/v1/zora/redeem`. Le cashout vers MoMo Mobile Money n'est pas encore implémenté.

---

### 7. Création de groupe sport

| Bouton | Route attendue | Statut |
|--------|----------------|--------|
| Créer un groupe | `POST /api/v1/sport-groups` | ❌ Inexistante |

**Note :** `GET /api/v1/sport-groups` et `POST /api/v1/sport-groups/:id/join` existent. La création est absente.

---

## Routes existantes et fonctionnelles

Toutes les routes ci-dessous ont été vérifiées dans `src/routes/` et sont câblées dans le dashboard vanilla :

| Fonctionnalité | Route | Méthode |
|----------------|-------|---------|
| Profil patient | `/api/v1/patients/profil?phone=` | GET |
| Abonnement | `/api/v1/patients/subscription?phone=` | GET |
| Constantes (lecture) | `/api/v1/patients/constantes/:phone` | GET |
| Constantes (écriture) | `/api/v1/patients/constantes` | POST |
| Changer mot de passe | `/api/v1/patients/change-password` | POST |
| RDV patient | `/api/v1/appointments/patient/:phone` | GET |
| Créneaux médecin | `/api/v1/appointments/slots/:doctor_id?date=` | GET |
| Réserver RDV | `/api/v1/appointments/book` | POST |
| Liste médecins | `/api/v1/doctors` | GET |
| Balance Zora | `/api/v1/zora/balance` | GET |
| Ledger Zora | `/api/v1/zora/ledger?limit=` | GET |
| Config jeux | `/api/v1/zora/games/config` | GET |
| Jouer | `/api/v1/zora/games/play` | POST |
| Récompenses | `/api/v1/zora/rewards` | GET |
| Échanger récompense | `/api/v1/zora/redeem` | POST |
| Événements | `/api/v1/events` | GET |
| Mes inscriptions | `/api/v1/events/my/registrations` | GET |
| S'inscrire événement | `/api/v1/events/:id/register` | POST |
| Streak | `/api/v1/streaks/me` | GET |
| Classement hebdo | `/api/v1/leaderboard/weekly` | GET |
| QR Code urgence | `/api/v1/qr/generate` | GET |
| Timeline consultations | `/api/v1/reports/patient/:phone/timeline` | GET |
| Accès dossier | `/api/v1/reports/access-log/:phone` | GET |
| Liste groupes sport | `/api/v1/sport-groups` | GET |
| Rejoindre groupe | `/api/v1/sport-groups/:id/join` | POST |
| Messages communauté | `/api/v1/chat/:channel/messages` | GET / POST |
| Messages médecin | `/api/v1/chat/medecin/messages` | GET / POST |
