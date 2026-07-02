-- Migration 050 : Ajouter le type encouragement à la contrainte CHECK de notifications
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'rdv_confirme','rdv_rappel','rdv_annule',
  'paiement_recu','abonnement_expire','abonnement_renouvele',
  'conflit_update','message_recu','alerte_systeme',
  'whatsapp_message','encouragement'
));
