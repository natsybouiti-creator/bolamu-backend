---
description: Module Conflits Bolamu (Sprint 3)
---

# BOLAMU — RÈGLES MODULE CONFLITS

## SCHÉMA BASE DE DONNÉES

### Table conflicts
```sql
CREATE TABLE conflicts (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(20) UNIQUE NOT NULL, -- format : CONF-YYYYMMDD-XXXX
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  partner_phone VARCHAR(20) REFERENCES users(phone),
  partner_type VARCHAR(20) CHECK (partner_type IN 
    ('doctor','pharmacy','lab','clinic')),
  sujet VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  statut VARCHAR(30) NOT NULL DEFAULT 'created' CHECK (statut IN (
    'created','pending_review','assigned','investigating',
    'waiting_response','resolved','closed','rejected','archived'
  )),
  priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN 
    ('normale','haute','critique')),
  agent_phone VARCHAR(20) REFERENCES users(phone),
  resolution TEXT,
  escalade_sup_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP
);
```

### Table conflict_messages
```sql
CREATE TABLE conflict_messages (
  id SERIAL PRIMARY KEY,
  conflict_id INTEGER NOT NULL REFERENCES conflicts(id),
  sender_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  sender_role VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  pieces_jointes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table conflict_actions
```sql
CREATE TABLE conflict_actions (
  id SERIAL PRIMARY KEY,
  conflict_id INTEGER NOT NULL REFERENCES conflicts(id),
  action VARCHAR(50) NOT NULL,
  ancien_statut VARCHAR(30),
  nouveau_statut VARCHAR(30),
  acteur_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  acteur_role VARCHAR(20) NOT NULL,
  commentaire TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## MATRICE DE TRANSITIONS DE STATUT

```
created → pending_review, rejected
pending_review → assigned, rejected
assigned → investigating
investigating → waiting_response, resolved
waiting_response → investigating, resolved
resolved → closed
closed → archived
rejected → archived
archived → (terminal)
```

**Note :** Le super_admin peut forcer toute transition.

## ROUTES API

### Routes publiques / patient
- `POST /api/v1/conflicts` — Créer un conflit (patient uniquement)

### Routes authentifiées (tous les rôles)
- `GET /api/v1/conflicts/:id` — Récupérer un conflit (patient voit le sien, admin voit tous)
- `POST /api/v1/conflicts/:id/messages` — Ajouter un message (patient, partenaire, agent, admin)

### Routes admin uniquement
- `GET /api/v1/admin/conflicts` — Lister tous les conflits (avec filtres statut, priorite, page)
- `PATCH /api/v1/conflicts/:id/statut` — Mettre à jour le statut
- `PATCH /api/v1/conflicts/:id/assign` — Assigner un agent
- `PATCH /api/v1/conflicts/:id/escalade` — Escalader au super admin
- `PATCH /api/v1/conflicts/:id/resolve` — Résoudre un conflit
- `PATCH /api/v1/conflicts/:id/close` — Fermer un conflit
- `PATCH /api/v1/conflicts/:id/suspend-partner` — Suspendre un partenaire

## RÈGLES MÉTIER

### Identifiant universel
- `phone` est l'identifiant universel partout (jamais l'id numérique)
- Toutes les références aux utilisateurs se font par phone

### Soft delete
- Jamais de DELETE sur users ou tables partenaires
- Utiliser `is_active = false` pour la désactivation
- `suspendrePartenaire` utilise soft delete uniquement

### Audit log
- `audit_log` est insert-only (jamais UPDATE ni DELETE)
- Toutes les actions critiques doivent être loggées dans audit_log
- Utiliser `.catch(() => {})` pour ne pas bloquer le flux principal en cas d'erreur

### Transactions
- Toutes les transitions de statut doivent être dans BEGIN/COMMIT/ROLLBACK
- `createConflict` utilise une transaction
- `transitionStatut` utilise une transaction
- `assignAgent` utilise une transaction
- `suspendrePartenaire` utilise une transaction

### RBAC strict
- `patient` : peut créer et voir ses propres conflits
- `doctor` : peut voir les conflits où il est partenaire
- `pharmacy` : peut voir les conflits où il est partenaire
- `lab` : peut voir les conflits où il est partenaire
- `admin` : peut voir et gérer tous les conflits
- `super_admin` : peut forcer toute transition de statut

## EXEMPLES DE REQUÊTES SQL

### Créer un conflit
```sql
INSERT INTO conflicts (reference, patient_phone, partner_phone, partner_type, sujet, description, statut, priorite)
VALUES ('CONF-20260520-1234', '+242069735418', '+242060000001', 'doctor', 'Mauvais diagnostic', 'Le médecin a prescrit un traitement inadapté', 'created', 'normale')
RETURNING id, reference, statut, created_at;
```

### Ajouter une action de création
```sql
INSERT INTO conflict_actions (conflict_id, action, ancien_statut, nouveau_statut, acteur_phone, acteur_role, commentaire)
VALUES (1, 'created', NULL, 'created', '+242069735418', 'patient', 'Création du conflit');
```

### Transition de statut
```sql
UPDATE conflicts SET statut = 'pending_review', updated_at = NOW() WHERE id = 1;

INSERT INTO conflict_actions (conflict_id, action, ancien_statut, nouveau_statut, acteur_phone, acteur_role, commentaire)
VALUES (1, 'transition', 'created', 'pending_review', '+242060000099', 'admin', 'Validation de recevabilité');
```

### Ajouter un message
```sql
INSERT INTO conflict_messages (conflict_id, sender_phone, sender_role, message, pieces_jointes)
VALUES (1, '+242069735418', 'patient', 'Je voudrais ajouter des détails sur mon cas', '[]');
```

### Assigner un agent
```sql
UPDATE conflicts SET agent_phone = '+242060000099', updated_at = NOW() WHERE id = 1;

-- Transition automatique vers 'assigned'
UPDATE conflicts SET statut = 'assigned', updated_at = NOW() WHERE id = 1;
```

### Suspendre un partenaire (soft delete)
```sql
UPDATE users SET is_active = FALSE WHERE phone = '+242060000001';

-- Mettre à jour la table spécifique
UPDATE doctors SET is_active = FALSE, status = 'suspended' WHERE phone = '+242060000001';
```

### Escalader au super admin
```sql
UPDATE conflicts SET escalade_sup_admin = TRUE, updated_at = NOW() WHERE id = 1;
```

### Résoudre un conflit
```sql
UPDATE conflicts SET resolution = 'Le médecin a présenté ses excuses et a corrigé le traitement', resolved_at = NOW() WHERE id = 1;

UPDATE conflicts SET statut = 'resolved', updated_at = NOW() WHERE id = 1;
```

### Fermer un conflit
```sql
UPDATE conflicts SET statut = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = 1;
```

### Lister les conflits avec filtres
```sql
SELECT c.*, u_patient.full_name as patient_name, u_partner.full_name as partner_name
FROM conflicts c
LEFT JOIN users u_patient ON u_patient.phone = c.patient_phone
LEFT JOIN users u_partner ON u_partner.phone = c.partner_phone
WHERE c.statut = 'pending_review' AND c.priorite = 'haute'
ORDER BY c.created_at DESC
LIMIT 20 OFFSET 0;
```

### Récupérer un conflit avec messages et actions
```sql
-- Conflit
SELECT c.*, u_patient.full_name as patient_name, u_partner.full_name as partner_name
FROM conflicts c
LEFT JOIN users u_patient ON u_patient.phone = c.patient_phone
LEFT JOIN users u_partner ON u_partner.phone = c.partner_phone
WHERE c.id = 1;

-- Messages
SELECT cm.*, u.full_name as sender_name
FROM conflict_messages cm
LEFT JOIN users u ON u.phone = cm.sender_phone
WHERE cm.conflict_id = 1
ORDER BY cm.created_at ASC;

-- Actions
SELECT ca.*, u.full_name as acteur_name
FROM conflict_actions ca
LEFT JOIN users u ON u.phone = ca.acteur_phone
WHERE ca.conflict_id = 1
ORDER BY ca.created_at DESC;
```
