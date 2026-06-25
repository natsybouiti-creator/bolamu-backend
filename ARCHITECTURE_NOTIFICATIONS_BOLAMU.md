# ARCHITECTURE NOTIFICATIONS WHATSAPP — BOLAMU
**Version :** 1.0 — 25 juin 2026  
**Stack :** whatsapp-web.js (actif) → SIM dédiée MTN/Airtel (à venir)  
**Numéro actuel (test) :** +242069735418 (numéro perso Natsy — temporaire)  
**Numéro cible (prod) :** SIM dédiée Bolamu — à acquérir (MTN ou Airtel Congo)

---

## 1. ARCHITECTURE GLOBALE

```
[Événement plateforme]
        ↓
[Backend Node.js — trigger notification]
        ↓
[whatsapp-web.service.js — sendAutoMessage()]
        ↓
[whatsapp-web.js — client connecté SIM dédiée Bolamu]
        ↓
[Destinataire reçoit le message WhatsApp]
        ↓
[INSERT → table notifications (type, canal, sent_at)]
```

### Règle fondamentale
- **Un seul numéro expéditeur** : la SIM dédiée Bolamu (jamais le numéro perso de Natsy)
- **Un seul service d'envoi** : `whatsapp-web.service.js` → fonction `sendAutoMessage(phone, templateName, params)`
- **Fallback** : si client DISCONNECTED → log erreur + INSERT notifications avec sent_at = NULL
- **Magic link pré-rempli** : chaque message d'activation/bienvenue contient un lien `https://bolamu.co/login?u={identifiant}&p={token}` qui pré-remplit les champs login

---

## 2. NUMÉRO DÉDIÉ — PROCÉDURE DE BASCULE

### Quand la SIM est disponible
1. Insérer la SIM dans un téléphone Android (pas iPhone — whatsapp-web.js incompatible avec iOS)
2. Créer un compte WhatsApp classique sur ce numéro
3. Sur le serveur Render, modifier `.env` : `BOLAMU_WA_PHONE=+242XXXXXXXXX`
4. Relancer whatsapp-web.js → scanner le nouveau QR code
5. Supprimer `.wwebjs_auth/` (session ancienne) avant de rescanner
6. Tester avec un envoi vers ton numéro perso — valider réception
7. Le numéro Meta API (+242065207273) reste disponible pour la migration future vers l'API officielle quand une carte corporate NBA Gestion sera disponible

---

## 3. MAGIC LINK PRÉ-REMPLI

### Format du lien
```
https://bolamu.co/login?u={identifiant_encodé}&t={token_one_time}
```
- `u` = identifiant (phone ou email) encodé en base64
- `t` = token one-time 24h (stocké dans `qr_tokens`)
- En cliquant : la page login se charge avec les champs pré-remplis
- Le token expire après 1 utilisation ou 24h

### Implémentation frontend (à faire dans login.html)
```javascript
const params = new URLSearchParams(window.location.search);
if (params.get('u')) {
  document.getElementById('phone').value = atob(params.get('u'));
}
if (params.get('t')) {
  // stocker le token, pré-remplir le champ password avec un placeholder visuel
  document.getElementById('password').setAttribute('data-token', params.get('t'));
  document.getElementById('password').placeholder = '••••••••  (pré-rempli)';
}
```

---

## 4. TEMPLATES PAR RÔLE

### FORMAT STANDARD D'UN TEMPLATE
```javascript
case 'bolamu_NOM_DU_TEMPLATE': {
  message = `[contenu]\n\nL'équipe Bolamu`;
  break;
}
```

---

### 4.1 PATIENTS

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
| `bolamu_partenaire_reduction` | Notification d'une réduction partenaire disponible | `[nom, partenaire, pourcentage, validite]` |
| `bolamu_code_acces` | Premier accès / reset code | `[nom, code_otp]` |

---

### 4.2 MÉDECINS

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_medecin_v4` | Compte médecin créé | `[nom, identifiant, magic_link]` |
| `bolamu_medecin_nouveau_rdv` | Nouveau RDV assigné | `[nom_medecin, nom_patient, date, heure, motif]` |
| `bolamu_medecin_rdv_annule` | Patient annule un RDV | `[nom_medecin, nom_patient, date, heure]` |
| `bolamu_medecin_rdv_rappel` | 1h avant consultation | `[nom_medecin, nom_patient, heure]` |
| `bolamu_medecin_patient_checkin` | Patient arrivé en salle d'attente | `[nom_medecin, nom_patient]` |

---

### 4.3 SECRÉTAIRES

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_secretaire` | Compte secrétaire créé | `[nom, identifiant, magic_link]` |
| `bolamu_secretaire_nouveau_rdv` | RDV créé par patient (à traiter) | `[nom_secretaire, nom_patient, date, heure, medecin]` |
| `bolamu_secretaire_patient_arrive` | Patient se présente (check-in physique) | `[nom_secretaire, nom_patient, heure]` |

---

### 4.4 PHARMACIES

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_pharmacie` | Compte pharmacie créé | `[nom, identifiant, magic_link]` |
| `bolamu_pharmacie_ordonnance` | Ordonnance transmise par médecin | `[nom_pharmacie, nom_patient, medecin, date]` |
| `bolamu_pharmacie_validee` | Pharmacie validée dans le réseau | `[nom_pharmacie]` |

---

### 4.5 LABORATOIRES

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_laboratoire` | Compte labo créé | `[nom, identifiant, magic_link]` |
| `bolamu_labo_analyse_prescrite` | Analyse prescrite par médecin | `[nom_labo, nom_patient, type_analyse, medecin]` |
| `bolamu_labo_validee` | Laboratoire validé dans le réseau | `[nom_labo]` |

---

### 4.6 ANIMATEURS ELONGA

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_animateur` | Compte animateur créé | `[nom, identifiant, magic_link]` |
| `bolamu_animateur_event_cree` | Événement créé et soumis à validation admin | `[nom_animateur, titre_event, date]` |
| `bolamu_animateur_event_valide` | Admin valide l'événement | `[nom_animateur, titre_event, date, lieu]` |
| `bolamu_animateur_event_refuse` | Admin refuse l'événement | `[nom_animateur, titre_event, raison]` |
| `bolamu_animateur_rappel_event` | 2h avant l'événement | `[nom_animateur, titre_event, participants_count, lieu]` |
| `bolamu_animateur_checkins` | Fin d'événement — récap participants | `[nom_animateur, titre_event, checkins_count, zora_distribues]` |

---

### 4.7 AGENTS COMMERCIAUX (company_rh / agent)

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_agent` | Compte agent créé | `[nom, identifiant, magic_link]` |
| `bolamu_agent_souscription` | Nouvel adhérent souscrit via l'agent | `[nom_agent, nom_patient, tier]` |
| `bolamu_agent_objectif_atteint` | Seuil de souscriptions atteint | `[nom_agent, count, periode]` |

---

### 4.8 RH ENTREPRISE (SmartFlow B2B)

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_bienvenue_rh` | Compte RH créé | `[nom, entreprise, identifiant, magic_link]` |
| `bolamu_rh_rapport_mensuel` | Rapport ICP mensuel disponible | `[nom_rh, entreprise, periode, url_rapport]` |
| `bolamu_rh_employe_inscrit` | Employé souscrit via lien entreprise | `[nom_rh, nom_employe, tier]` |

---

### 4.9 ADMIN BOLAMU

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_admin_nouveau_partenaire` | Nouveau partenaire inscrit en attente de validation | `[nom_admin, nom_partenaire, type]` |
| `bolamu_admin_event_soumis` | Animateur soumet un événement | `[nom_admin, titre_event, animateur, date]` |
| `bolamu_admin_alerte_zora` | Anomalie détectée dans les transactions Zora | `[nom_admin, details]` |

---

## 5. TEMPLATES ZORA (transversaux)

Ces templates s'appliquent à tous les rôles concernés par la gamification.

| Code template | Déclencheur | Params |
|---------------|-------------|--------|
| `bolamu_zora_attribues` | Crédit Zora (check-in, soin, action) | `[nom, montant, solde, raison]` |
| `bolamu_zora_depense` | Utilisation Zora chez partenaire | `[nom, montant, partenaire, solde_restant]` |
| `bolamu_zora_expiration` | J-30 avant expiration | `[nom, montant_expiration, date_expiration]` |
| `bolamu_zora_cadeau_recu` | Zora reçus via programme parrainage | `[nom, montant, parrain]` |

---

## 6. NOUVEAUX TEMPLATES À CRÉER

Ces templates n'existent pas encore et doivent être ajoutés dans `whatsapp-web.service.js` :

| Code template | Priorité | Boucle |
|---------------|----------|--------|
| `bolamu_animateur_event_valide` | HAUTE | Boucle 3 |
| `bolamu_animateur_checkins` | HAUTE | Boucle 3 |
| `bolamu_checkin_confirme` | HAUTE | Boucle 3 |
| `bolamu_event_inscription` | HAUTE | Boucle 3 |
| `bolamu_event_rappel` | MOYENNE | Boucle 3 |
| `bolamu_rh_rapport_mensuel` | HAUTE | Boucle 4 (SmartFlow) |
| `bolamu_partenaire_reduction` | MOYENNE | Boucle 5 |
| `bolamu_zora_cadeau_recu` | MOYENNE | Boucle 5 |
| `bolamu_admin_alerte_zora` | BASSE | Boucle 6 |

---

## 7. IMPLÉMENTATION — RÈGLES POUR CASCADE

### Structure dans whatsapp-web.service.js
```javascript
async function sendAutoMessage(phone, templateName, params) {
  let message = '';
  
  switch (templateName) {
    
    case 'bolamu_bienvenue_patient_v4':
      message = `Bienvenue sur Bolamu, ${params[0]} ! 🎉\n`
        + `Votre compte patient est activé.\n\n`
        + `Connectez-vous ici (lien valide 24h) :\n${params[2]}\n\n`
        + `Identifiant : ${params[1]}\n\n`
        + `L'équipe Bolamu`;
      break;

    case 'bolamu_rdv_confirme':
      message = `Bonjour ${params[0]},\n`
        + `Votre RDV Bolamu est confirmé ✅\n\n`
        + `📅 ${params[1]} à ${params[2]}\n`
        + `👨‍⚕️ ${params[3]}\n`
        + `📍 ${params[4]}\n\n`
        + `L'équipe Bolamu`;
      break;

    case 'bolamu_zora_attribues':
      message = `Bonne nouvelle ${params[0]} ! ⭐\n`
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

  await sendWhatsAppMessage(phone, message);
}
```

### Règle d'appel depuis le backend
```javascript
// Toujours appeler sendAutoMessage depuis whatsapp-web.service.js
// JAMAIS appeler directement client.sendMessage()
// TOUJOURS passer par sendAutoMessage(phone, templateName, params)

const { sendAutoMessage } = require('../services/whatsapp-web.service');

// Exemple dans auth.controller.js après création patient :
await sendAutoMessage(
  patient.phone,
  'bolamu_bienvenue_patient_v4',
  [patient.nom, patient.phone, magicLink]
);
```

---

## 8. TABLE NOTIFICATIONS — RÉFÉRENCE

```sql
INSERT INTO notifications 
  (user_phone, type, canal, content, sent_at, created_at)
VALUES 
  ($1, 'whatsapp_message', 'whatsapp', $2, NOW(), NOW());
```

- `type` accepté : `whatsapp_message` (contrainte CHECK en place depuis migration_043)
- `canal` : `whatsapp`
- `content` : texte du message envoyé (pour audit)
- `sent_at` : NULL si échec d'envoi

---

## 9. CHECKLIST BASCULE SIM DÉDIÉE

- [ ] SIM MTN ou Airtel achetée (numéro jamais utilisé)
- [ ] Compte WhatsApp créé sur ce numéro (via téléphone Android)
- [ ] `.env` mis à jour : `BOLAMU_WA_PHONE=+242XXXXXXXXX`
- [ ] `.wwebjs_auth/` supprimé sur le serveur
- [ ] QR code scanné et session validée
- [ ] Test envoi vers numéro perso Natsy — réception confirmée
- [ ] Ancien numéro retiré de la config
- [ ] Commit + push : "chore: bascule SIM dédiée Bolamu WhatsApp"
