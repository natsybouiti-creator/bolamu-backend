-- Migration 068 : Extension notifications_type_check pour les demandes de suivi
-- Date : 7 juillet 2026
-- Description : notifyLite() échouait silencieusement pour les types 'follow_request'
--              et 'follow_request_accepted' (utilisés par follows.controller.js), absents
--              de la contrainte CHECK notifications_type_check. Aucune notification n'était
--              jamais créée lors d'une demande de suivi ou de son acceptation.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'rdv_confirme','rdv_rappel','rdv_annule','paiement_recu','abonnement_expire',
    'abonnement_renouvele','conflit_update','message_recu','alerte_systeme',
    'whatsapp_message','encouragement','new_like','new_comment','new_follower',
    'follow_request','follow_request_accepted'
  ));
