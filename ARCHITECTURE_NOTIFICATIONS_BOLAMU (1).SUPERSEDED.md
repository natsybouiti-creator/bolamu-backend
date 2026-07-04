# ARCHITECTURE NOTIFICATIONS WHATSAPP — BOLAMU

> **SUPERSEDED — Contenu fusionné dans `docs/ARCHITECTURE_NOTIFICATIONS.md` (schéma d'architecture, infrastructure WAHA, procédure bascule SIM, schéma SQL table notifications). Voir ce document pour toute référence à jour.**

**Version :** 2.0 — 26 juin 2026  
**Stack :** WAHA (WhatsApp HTTP API) — moteur GOWS — hébergé sur Render  
**Numéro actuel (test) :** +242069735418 (numéro perso Natsy — temporaire)  
**Numéro cible (prod) :** SIM dédiée Bolamu — à acquérir (MTN ou Airtel Congo)

---

## 1. ARCHITECTURE GLOBALE

```
[Événement plateforme]
        ↓
[Backend Node.js — trigger notification]
        ↓
[whatsapp-web.service.js — sendAutoMessage(phone, templateName, params)]
        ↓
[POST https://waha-bolamu.onrender.com/api/sendText]
   Header: X-Api-Key: WAHA_API_KEY
        ↓
[WAHA — moteur GOWS — session "default" — SIM dédiée Bolamu]
        ↓
[Destinataire reçoit le message WhatsApp]
        ↓
[INSERT → table notifications (user_phone, type, titre, message, canal, sent_at)]
```

### Règles fondamentales
- **Un seul numéro expéditeur** : la SIM dédiée Bolamu (jamais le numéro perso de Natsy)
- **Un seul service d'envoi** : `whatsapp-web.service.js` → `sendAutoMessage(phone, templateName, params)`
- **Un seul appel HTTP** : `POST /api/sendText` vers WAHA avec `X-Api-Key`
- **Fallback** : si WAHA répond erreur → log erreur + INSERT notifications avec `sent_at = NULL`
- **Moteur GOWS** : pas de Chrome/Puppeteer — aucun crash "Execution context destroyed"
- **Session persistée** : disque Render `/app/.sessions` — pas de QR à rescanner après redémarrage
- **Magic link pré-rempli** : chaque message d'activation contient `https://bolamu.co/login?u={identifiant}&t={token}`

---

## 2. INFRASTRUCTURE WAHA

### Déploiement Render
- **Service** : `waha-bolamu` (Web Service Docker)
- **Image** : `docker.io/devlikeapro/waha`
- **Moteur** : `WHATSAPP_DEFAULT_ENGINE=GOWS` (pas WEBJS — pas de Chrome)
- **Instance** : Standard (2 Go RAM, 1 CPU) — suffisant sans Chrome
- **Disque persistant** : `/app/.sessions` — 1 GB — session survit aux redémarrages
- **URL** : `https://waha-bolamu.onrender.com`
- **Session** : `default`

### Variables d'environnement (Render + .env local)
```
WAHA_API_KEY=<clé secrète — ne jamais committer>
WAHA_BASE_URL=https://waha-bolamu.onrender.com
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=<mot de passe fort>
WHATSAPP_RESTART_ALL_SESSIONS=True
WHATSAPP_DEFAULT_ENGINE=GOWS
```

### Dashboard WAHA
- URL : `https://waha-bolamu.onrender.com/dashboard`
- Login : `WAHA_DASHBOARD_USERNAME` / `WAHA_DASHBOARD_PASSWORD`
- Permet de voir l'état de la session, le numéro connecté, l'historique

---

## 3. PROCÉDURE DE BASCULE — SIM DÉDIÉE

### Quand la SIM est disponible (~500 FCFA MTN ou Airtel)
1. Insérer la SIM dans un téléphone Android (pas iPhone — incompatible)
2. Créer un compte WhatsApp classique sur ce numéro
3. Ouvrir le dashboard WAHA → `https://waha-bolamu.onrender.com/dashboard`
4. Arrêter la session `default` → supprimer → recréer
5. Scanner le nouveau QR code avec le téléphone Android SIM dédiée
6. Mettre à jour `.env` : `BOLAMU_WA_PHONE=+242XXXXXXXXX`
7. Tester un envoi vers le numéro perso Natsy — confirmer réception
8. Commit : `chore: bascule SIM dédiée Bolamu WhatsApp`

> Le numéro Meta API (+242065207273) reste disponible pour migration future vers l'API officielle quand une carte corporate NBA Gestion sera disponible.

---

## 4. MAGIC LINK PRÉ-REMPLI

### Format
```
https://bolamu.co/login?u={identifiant_encodé_base64}&t={token_one_time}
```
- `u` = identifiant (phone) encodé en base64
- `t` = token one-time 24h stocké dans `qr_tokens`
- Expire après 1 utilisation ou 24h

### Implémentation frontend (login.html)
```javascript
const params = new URLSearchParams(window.location.search);
if (params.get('u')) {
  document.getElementById('phone').value = atob(params.get('u'));
}
if (params.get('t')) {
  document.getElementById('password').setAttribute('data-token', params.get('t'));
  document.getElementById('password').placeholder = '••••••••  (pré-rempli)';
}
```

---

## 5. TEMPLATES PAR RÔLE

### FORMAT STANDARD
```javascript
case 'bolamu_NOM_DU_TEMPLATE': {
  message = `[contenu]\n\nL'équipe Bolamu`;
  break;
}
```

---

### 5.1 PATIENTS

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_patient_v4` | Inscription via agence ou self-registration | `[nom, identifiant, magic_link]` |
| `bolamu_magic_link` | Demande de connexion rapide | `[nom, magic_link]` |
| `bolamu_rdv_confirme` | RDV créé (patient ou secrétaire) | `[nom, date, heure, praticien, lieu]` |
| `bolamu_rdv_rappel` | 24h avant le RDV | `[nom, date, heure, praticien]` |
| `bolamu_rdv_annule` | Annulation RDV | `[nom, date, heure]` |
| `bolamu_resultat_disponible` | Lab ou pharmacie uploade un résultat | `[nom, type_resultat]` |
| `bolamu_ordonnance_prete` | Médecin valide ordonnance | `[nom, pharmacie]` |
| `bolamu_renouvellement_abonnement` | J-7 avant expiration abonnement | `[nom, date_expiration, tier]` |
| `bolamu_zora_attribues` | Points Zora crédités | `[nom, montant_zora, solde_total, raison]` |
| `bolamu_zora_expiration` | J-30 avant expiration des Zora | `[nom, montant_expiration, date_expiration]` |
| `bolamu_event_inscription` | Patient inscrit à un événement Elonga | `[nom, titre_event, date, lieu]` |
| `bolamu_event_rappel` | 24h avant un événement Elonga | `[nom, titre_event, date, heure, lieu]` |
| `bolamu_event_annule` | Événement annulé par animateur | `[nom, titre_event, date]` |
| `bolamu_checkin_confirme` | QR check-in validé à un événement | `[nom, titre_event, points_zora]` |
| `bolamu_partenaire_reduction` | Réduction partenaire disponible | `[nom, partenaire, pourcentage, validite]` |
| `bolamu_code_acces` | Premier accès / reset code | `[nom, code_otp]` |

---

### 5.2 MÉDECINS

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_medecin_v4` | Compte médecin créé | `[nom, identifiant, magic_link]` |
| `bolamu_medecin_nouveau_rdv` | Nouveau RDV assigné | `[nom_medecin, nom_patient, date, heure, motif]` |
| `bolamu_medecin_rdv_annule` | Patient annule un RDV | `[nom_medecin, nom_patient, date, heure]` |
| `bolamu_medecin_rdv_rappel` | 1h avant consultation | `[nom_medecin, nom_patient, heure]` |
| `bolamu_medecin_patient_checkin` | Patient arrivé en salle d'attente | `[nom_medecin, nom_patient]` |

---

### 5.3 SECRÉTAIRES

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_secretaire` | Compte secrétaire créé | `[nom, identifiant, magic_link]` |
| `bolamu_secretaire_nouveau_rdv` | RDV créé par patient (à traiter) | `[nom_secretaire, nom_patient, date, heure, medecin]` |
| `bolamu_secretaire_patient_arrive` | Patient se présente (check-in physique) | `[nom_secretaire, nom_patient, heure]` |

---

### 5.4 PHARMACIES

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_pharmacie` | Compte pharmacie créé | `[nom, identifiant, magic_link]` |
| `bolamu_pharmacie_ordonnance` | Ordonnance transmise par médecin | `[nom_pharmacie, nom_patient, medecin, date]` |
| `bolamu_pharmacie_validee` | Pharmacie validée dans le réseau | `[nom_pharmacie]` |

---

### 5.5 LABORATOIRES

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_laboratoire` | Compte labo créé | `[nom, identifiant, magic_link]` |
| `bolamu_labo_analyse_prescrite` | Analyse prescrite par médecin | `[nom_labo, nom_patient, type_analyse, medecin]` |
| `bolamu_labo_validee` | Laboratoire validé dans le réseau | `[nom_labo]` |

---

### 5.6 ANIMATEURS ELONGA

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_animateur` | Compte animateur créé | `[nom, identifiant, magic_link]` |
| `bolamu_animateur_event_cree` | Événement créé et soumis à validation admin | `[nom_animateur, titre_event, date]` |
| `bolamu_animateur_event_valide` | Admin valide l'événement | `[nom_animateur, titre_event, date, lieu]` |
| `bolamu_animateur_event_refuse` | Admin refuse l'événement | `[nom_animateur, titre_event, raison]` |
| `bolamu_animateur_rappel_event` | 2h avant l'événement | `[nom_animateur, titre_event, participants_count, lieu]` |
| `bolamu_animateur_checkins` | Fin d'événement — récap participants | `[nom_animateur, titre_event, checkins_count, zora_distribues]` |

---

### 5.7 AGENTS COMMERCIAUX

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_agent` | Compte agent créé | `[nom, identifiant, magic_link]` |
| `bolamu_agent_souscription` | Nouvel adhérent souscrit via l'agent | `[nom_agent, nom_patient, tier]` |
| `bolamu_agent_objectif_atteint` | Seuil de souscriptions atteint | `[nom_agent, count, periode]` |

---

### 5.8 RH ENTREPRISE (SmartFlow B2B)

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_rh` | Compte RH créé | `[nom, entreprise, identifiant, magic_link]` |
| `bolamu_rh_rapport_mensuel` | Rapport ICP mensuel disponible | `[nom_rh, entreprise, periode, url_rapport]` |
| `bolamu_rh_employe_inscrit` | Employé souscrit via lien entreprise | `[nom_rh, nom_employe, tier]` |

---

### 5.9 ADMIN BOLAMU

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_admin_nouveau_partenaire` | Nouveau partenaire inscrit en attente | `[nom_admin, nom_partenaire, type]` |
| `bolamu_admin_event_soumis` | Animateur soumet un événement | `[nom_admin, titre_event, animateur, date]` |
| `bolamu_admin_alerte_zora` | Anomalie détectée dans les transactions Zora | `[nom_admin, details]` |

---

## 6. TEMPLATES ZORA (transversaux)

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_zora_attribues` | Crédit Zora (check-in, soin, action) | `[nom, montant, solde, raison]` |
| `bolamu_zora_depense` | Utilisation Zora chez partenaire | `[nom, montant, partenaire, solde_restant]` |
| `bolamu_zora_expiration` | J-30 avant expiration | `[nom, montant_expiration, date_expiration]` |
| `bolamu_zora_cadeau_recu` | Zora reçus via parrainage | `[nom, montant, parrain]` |

---

## 7. TEMPLATES À CRÉER (non encore implémentés)

| Code template | Priorité | Boucle |
|---------------|----------|--------|
| `bolamu_animateur_event_valide` | HAUTE | B3 |
| `bolamu_animateur_checkins` | HAUTE | B3 |
| `bolamu_checkin_confirme` | HAUTE | B3 |
| `bolamu_event_inscription` | HAUTE | B3 |
| `bolamu_event_rappel` | MOYENNE | B3 |
| `bolamu_rh_rapport_mensuel` | HAUTE | B7 |
| `bolamu_partenaire_reduction` | MOYENNE | B5 |
| `bolamu_zora_cadeau_recu` | MOYENNE | B5 |
| `bolamu_admin_alerte_zora` | BASSE | B6 |

---

## 8. IMPLÉMENTATION — RÈGLES POUR CASCADE

### Structure whatsapp-web.service.js (appel HTTP WAHA)
```javascript
const fetch = require('node-fetch');
const { normalizePhone } = require('../utils/phone');

async function sendAutoMessage(phone, templateName, params) {
  const normalizedPhone = normalizePhone(phone);
  let message = '';

  switch (templateName) {

    case 'bolamu_bienvenue_patient_v4':
      message = `Bienvenue sur Bolamu, ${params[0]} !\n`
        + `Votre compte patient est activé.\n\n`
        + `Connectez-vous ici (lien valide 24h) :\n${params[2]}\n\n`
        + `Identifiant : ${params[1]}\n\n`
        + `L'équipe Bolamu`;
      break;

    case 'bolamu_rdv_confirme':
      message = `Bonjour ${params[0]},\n`
        + `Votre RDV Bolamu est confirmé.\n\n`
        + `Date : ${params[1]} à ${params[2]}\n`
        + `Praticien : ${params[3]}\n`
        + `Lieu : ${params[4]}\n\n`
        + `L'équipe Bolamu`;
      break;

    case 'bolamu_zora_attribues':
      message = `Bonne nouvelle ${params[0]} !\n`
        + `Vous venez de recevoir ${params[1]} Zora.\n`
        + `Solde total : ${params[2]} Zora\n`
        + `Raison : ${params[3]}\n\n`
        + `Utilisez vos Zora sur bolamu.co\n\n`
        + `L'équipe Bolamu`;
      break;

    // ... autres cases

    default:
      message = params.join(' ');
  }

  // Appel HTTP vers WAHA
  const res = await fetch(`${process.env.WAHA_BASE_URL}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.WAHA_API_KEY
    },
    body: JSON.stringify({
      chatId: `${normalizedPhone.replace('+', '')}@c.us`,
      text: message,
      session: 'default'
    })
  });

  const sent_at = res.ok ? new Date() : null;

  // Log en base
  await pool.query(
    `INSERT INTO notifications (user_phone, type, titre, message, canal, sent_at, created_at)
     VALUES ($1, 'whatsapp_message', $2, $3, 'whatsapp', $4, NOW())`,
    [normalizedPhone, templateName, message, sent_at]
  );

  if (!res.ok) throw new Error(`WAHA error: ${res.status}`);
}

module.exports = { sendAutoMessage };
```

### Règle d'appel depuis le backend
```javascript
// TOUJOURS appeler via sendAutoMessage — jamais d'appel HTTP WAHA direct
const { sendAutoMessage } = require('../services/whatsapp-web.service');

// Exemple après création patient :
await sendAutoMessage(
  patient.phone,
  'bolamu_bienvenue_patient_v4',
  [patient.nom, patient.phone, magicLink]
);
```

---

## 9. TABLE NOTIFICATIONS — SCHÉMA RÉEL

```sql
-- Schéma actuel (migration_023 + corrections session)
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  type VARCHAR(50) NOT NULL CHECK (type IN ('whatsapp_message', ...)),
  titre VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  canal VARCHAR(20) DEFAULT 'push',
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert type correct (PAS content — la colonne n'existe pas)
INSERT INTO notifications (user_phone, type, titre, message, canal, sent_at, created_at)
VALUES ($1, 'whatsapp_message', $2, $3, 'whatsapp', NOW(), NOW());
```

---

## 10. CHECKLIST BASCULE SIM DÉDIÉE (procédure WAHA)

- [ ] SIM MTN ou Airtel achetée (~500 FCFA, numéro jamais utilisé WhatsApp)
- [ ] Compte WhatsApp créé sur ce numéro (téléphone Android)
- [ ] Dashboard WAHA ouvert : `https://waha-bolamu.onrender.com/dashboard`
- [ ] Session `default` arrêtée et supprimée
- [ ] Nouvelle session créée → QR scanné avec le téléphone SIM dédiée
- [ ] Statut session = WORKING dans le dashboard
- [ ] `.env` mis à jour : `BOLAMU_WA_PHONE=+242XXXXXXXXX`
- [ ] Test envoi vers numéro perso Natsy — réception confirmée
- [ ] Commit : `chore: bascule SIM dédiée Bolamu WhatsApp (WAHA)`
