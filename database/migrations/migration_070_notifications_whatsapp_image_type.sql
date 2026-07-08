-- Migration 070 : Ajoute 'whatsapp_image' à notifications_type_check
-- Date : 9 juillet 2026
-- Description : sendImageMessage() (whatsapp.service.js, Chantier 3 — carte cadeau
--              Bon Zora) insère des notifications avec type='whatsapp_image', distinct
--              de 'whatsapp_message' (texte) pour l'observabilité future. La contrainte
--              existante ne l'autorisait pas — découvert via test d'intégration réel
--              (INSERT rejeté par notifications_type_check).

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type::text = ANY (ARRAY[
    'rdv_confirme','rdv_rappel','rdv_annule','paiement_recu','abonnement_expire',
    'abonnement_renouvele','conflit_update','message_recu','alerte_systeme',
    'whatsapp_message','whatsapp_image','encouragement','new_like','new_comment',
    'new_follower','follow_request','follow_request_accepted'
  ]::text[]));
