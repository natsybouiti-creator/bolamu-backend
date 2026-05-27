-- Migration 016 : Contrainte UNIQUE sur subscriptions pour éviter les doublons de race condition
-- Date : 20 mai 2026
-- Vulnérabilité corrigée : CVSS 9.8 - Race condition sur les paiements MTN MoMo

-- Ajout d'une contrainte UNIQUE sur (patient_phone, started_at) pour éviter
-- qu'un patient puisse avoir deux abonnements créés simultanément pour la même date
-- Cela empêche les race conditions lors du traitement des paiements

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_patient_started_unique
UNIQUE (patient_phone, started_at);

-- Index pour optimiser les requêtes de vérification
CREATE INDEX IF NOT EXISTS idx_subscriptions_patient_started
ON subscriptions (patient_phone, started_at);

COMMENT ON CONSTRAINT subscriptions_patient_started_unique ON subscriptions IS
'Empêche les doublons d''abonnement pour un patient à une date donnée (anti race condition)';
