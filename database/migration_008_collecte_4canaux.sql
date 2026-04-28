-- ============================================
-- MIGRATION 008 — SYSTÈME COLLECTE 4 CANAUX
-- ============================================

-- 1. Nouveaux ENUMs
CREATE TYPE canal_paiement_enum AS ENUM (
  'ovp_bancaire', 
  'momo_annuel', 
  'familial', 
  'sepa_diaspora'
);

CREATE TYPE statut_collecte_enum AS ENUM (
  'en_attente',
  'en_attente_ovp',
  'en_attente_sepa', 
  'actif',
  'suspendu',
  'expire'
);

CREATE TYPE canal_transfer_enum AS ENUM (
  'ovp_bancaire',
  'sepa_diaspora'
);

-- 2. Colonnes dans subscriptions
ALTER TABLE subscriptions 
  ADD COLUMN IF NOT EXISTS canal_paiement canal_paiement_enum,
  ADD COLUMN IF NOT EXISTS statut_collecte statut_collecte_enum 
    DEFAULT 'en_attente';

-- 3. Colonnes dans users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS payeur_principal_id INTEGER 
    REFERENCES users(id);

-- 4. Colonnes dans bank_transfer_requests
ALTER TABLE bank_transfer_requests
  ADD COLUMN IF NOT EXISTS canal_type canal_transfer_enum,
  ADD COLUMN IF NOT EXISTS nom_titulaire VARCHAR(200),
  ADD COLUMN IF NOT EXISTS numero_compte_ecobank VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rib_france TEXT,
  ADD COLUMN IF NOT EXISTS frequence VARCHAR(20) 
    CHECK (frequence IN ('mensuel', 'annuel')),
  ADD COLUMN IF NOT EXISTS beneficiaires_phones TEXT[];

-- 5. Colonnes dans company_employees
ALTER TABLE company_employees
  ADD COLUMN IF NOT EXISTS payeur_direct_phone VARCHAR(20) 
    REFERENCES users(phone);

-- 6. Nouvelle table ovp_documents
CREATE TABLE IF NOT EXISTS ovp_documents (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  nom_titulaire VARCHAR(200) NOT NULL,
  banque VARCHAR(100) DEFAULT 'Ecobank Congo',
  numero_compte VARCHAR(100) NOT NULL,
  montant_mensuel INTEGER NOT NULL,
  nombre_beneficiaires INTEGER DEFAULT 0,
  montant_total INTEGER NOT NULL,
  statut VARCHAR(20) DEFAULT 'genere' 
    CHECK (statut IN ('genere', 'envoye', 'signe', 'valide', 'rejete')),
  pdf_url TEXT,
  pdf_public_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  validated_by VARCHAR(20) REFERENCES users(phone)
);

-- 7. Nouvelle table beneficiaires_familiaux
CREATE TABLE IF NOT EXISTS beneficiaires_familiaux (
  id SERIAL PRIMARY KEY,
  payeur_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  beneficiaire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payeur_phone, beneficiaire_phone)
);

-- 8. Nouvelle table cron_logs
CREATE TABLE IF NOT EXISTS cron_logs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  nb_traites INTEGER DEFAULT 0,
  nb_erreurs INTEGER DEFAULT 0,
  details TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Nouvelles clés platform_config pour Canal 4
INSERT INTO platform_config (config_key, config_value, description) 
VALUES
  ('rib_france_qonto', 
   'A_RENSEIGNER', 
   'RIB compte France NBA Gestion pour virements SEPA diaspora'),
  ('sepa_contact_email', 
   'contact@bolamu.co', 
   'Email de confirmation pour adhérents diaspora')
ON CONFLICT (config_key) DO NOTHING;

-- 10. Index de performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_canal 
  ON subscriptions(canal_paiement);
CREATE INDEX IF NOT EXISTS idx_subscriptions_statut_collecte 
  ON subscriptions(statut_collecte);
CREATE INDEX IF NOT EXISTS idx_beneficiaires_payeur 
  ON beneficiaires_familiaux(payeur_phone);
CREATE INDEX IF NOT EXISTS idx_ovp_user 
  ON ovp_documents(user_phone);
