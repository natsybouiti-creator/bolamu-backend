-- Migration 061: consultations.appointment_id remplace consultations.rdv_id
-- Contexte (ARCHITECTURE_SOINS_BOLAMU.md §1, dette technique confirmée) :
-- consultations.rdv_id référence par FK réelle rendez_vous(id), table jamais
-- peuplée par le code applicatif (4 lignes de test QA seulement). Le frontend
-- medecin/dashboard.html envoie en réalité un appointments.id comme rdv_id —
-- la FK n'était satisfaite que par coïncidence numérique entre les deux
-- séquences SERIAL. Dès qu'un appointments.id ne correspond à aucune des 4
-- lignes rendez_vous, POST /consultations/open échoue en violation de FK.
-- prescriptions.appointment_id reçoit déjà la même valeur (currentRdv.rdvId)
-- que consultations.rdv_id — patient.routes.js les joint déjà comme
-- équivalents. Cette migration aligne le schéma sur la sémantique réelle.
-- Additive : ajoute la colonne, copie les valeurs, supprime l'ancienne
-- colonne et son ancienne FK. Aucune perte de données (rdv_id ne référençait
-- de toute façon jamais une ligne rendez_vous sémantiquement correcte).

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS appointment_id INTEGER REFERENCES appointments(id);

UPDATE consultations SET appointment_id = rdv_id WHERE rdv_id IS NOT NULL AND appointment_id IS NULL;

ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_rdv_id_fkey;
ALTER TABLE consultations DROP COLUMN IF EXISTS rdv_id;
