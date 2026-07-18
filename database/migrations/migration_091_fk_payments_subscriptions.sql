-- Migration 091 — FK manquantes sur payments et subscriptions
--
-- Contexte (audit beta du 17 juillet 2026 + Vague 2/3 dette technique) : payments
-- n'avait AUCUNE contrainte FK (patient_phone, subscription_id, appointment_id
-- tous non vérifiés), et subscriptions n'avait de FK que sur validated_by --
-- patient_phone et activated_by n'étaient pas protégés non plus.
--
-- Nettoyage préalable des orphelins (obligatoire — la contrainte échouerait sinon) :
--   - payments id=9, id=10 : patient_phone malformé (chiffres en trop/manquants),
--     status='pending' depuis avril 2026, jamais finalisées -- supprimées (validé
--     avec l'utilisateur, aucune perte de transaction réelle).
--   - subscriptions id=3 : patient_phone '+24269735418' -- faute de frappe (0
--     manquant après +242), corrigé en '+242069735418' (compte réel déjà connu,
--     abonnement id=3 de toute façon expiré depuis le 22/05/2026).
--
-- subscriptions.activated_by est volontairement EXCLU : la colonne contient aussi
-- des valeurs sentinelles non-téléphone ('momo', 'system' -- 40 lignes), pas
-- seulement des numéros. Une FK vers users(phone) casserait ces cas légitimes.

-- Nettoyage orphelins
DELETE FROM payments WHERE id IN (9, 10);
UPDATE subscriptions SET patient_phone = '+242069735418' WHERE id = 3 AND patient_phone = '+24269735418';

-- FK payments
ALTER TABLE payments
  ADD CONSTRAINT fk_payments_patient_phone
  FOREIGN KEY (patient_phone) REFERENCES users(phone) ON UPDATE CASCADE;

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_subscription_id
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_appointment_id
  FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK subscriptions
ALTER TABLE subscriptions
  ADD CONSTRAINT fk_subscriptions_patient_phone
  FOREIGN KEY (patient_phone) REFERENCES users(phone) ON UPDATE CASCADE;
