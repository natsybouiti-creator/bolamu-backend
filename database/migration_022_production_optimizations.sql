-- ============================================================
-- BOLAMU — Migration 022 : Optimisations Production (Sprint 6)
-- ============================================================

-- Index manquants
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_phone);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- Contrainte partielle : une seule subscription active par patient
-- Note : PostgreSQL ne supporte pas directement les contraintes partielles UNIQUE
-- Cette contrainte est gérée au niveau applicatif dans le code

-- Commentaires
COMMENT ON TABLE users IS 'Table principale des utilisateurs (patients, médecins, pharmacies, laboratoires, admins)';
COMMENT ON TABLE subscriptions IS 'Abonnements patients (Essentiel, Standard, Premium)';
COMMENT ON TABLE audit_log IS 'Journal d audit insert-only (jamais UPDATE ou DELETE)';
COMMENT ON TABLE payments IS 'Paiements MTN MoMo et Airtel Money';
