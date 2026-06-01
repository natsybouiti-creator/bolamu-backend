-- ============================================================
-- BOLAMU — Migration Smart Flow V2
-- Matricule RH, catalogue pharmacie, retenues validées, config catégories
-- ============================================================

-- 1. Matricule et catégorie RH dans company_employees
ALTER TABLE company_employees
  ADD COLUMN IF NOT EXISTS matricule VARCHAR(50),
  ADD COLUMN IF NOT EXISTS categorie_rh VARCHAR(30) DEFAULT 'employe';
-- categorie_rh : 'cadre_direction' | 'cadre' | 'agent_maitrise' | 'employe' | 'ouvrier'

-- 2. Catalogue prix pharmacie (prix propres à chaque partenaire)
CREATE TABLE IF NOT EXISTS catalogue_pharmacie (
  id SERIAL PRIMARY KEY,
  pharmacie_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  medicament_nom VARCHAR(255) NOT NULL,
  medicament_nom_normalise VARCHAR(255),
  prix_unitaire INTEGER NOT NULL DEFAULT 0,
  unite VARCHAR(50) DEFAULT 'comprimé',
  est_ssp BOOLEAN DEFAULT false,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pharmacie_phone, medicament_nom_normalise)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_catalogue_pharmacie_phone ON catalogue_pharmacie(pharmacie_phone);
CREATE INDEX IF NOT EXISTS idx_catalogue_pharmacie_actif ON catalogue_pharmacie(actif) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_catalogue_pharmacie_ssp ON catalogue_pharmacie(est_ssp) WHERE est_ssp = true;

-- 3. Retenues validées mensuelles (snapshot figé après validation RH)
CREATE TABLE IF NOT EXISTS retenues_validees (
  id SERIAL PRIMARY KEY,
  company_contract_id INTEGER NOT NULL REFERENCES company_contracts(id),
  mois VARCHAR(7) NOT NULL, -- format 'YYYY-MM'
  employee_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  nom_complet VARCHAR(255),
  categorie_rh VARCHAR(30),
  salaire_brut INTEGER DEFAULT 0,
  montant_retenue INTEGER DEFAULT 0,
  pourcentage_retenue INTEGER DEFAULT 0,
  nombre_actes INTEGER DEFAULT 0,
  actes_details JSONB, -- [{date, type, montant, medicament, prestataire}]
  valide_par VARCHAR(20) REFERENCES users(phone),
  valide_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_contract_id, mois, employee_phone)
);

-- Index pour requêtes RH
CREATE INDEX IF NOT EXISTS idx_retenues_contract_mois ON retenues_validees(company_contract_id, mois);
CREATE INDEX IF NOT EXISTS idx_retenues_employee ON retenues_validees(employee_phone);

-- 4. Configuration des catégories RH par contrat
CREATE TABLE IF NOT EXISTS config_categories_rh (
  id SERIAL PRIMARY KEY,
  company_contract_id INTEGER NOT NULL REFERENCES company_contracts(id),
  categorie_rh VARCHAR(30) NOT NULL,
  pourcentage_salarie INTEGER NOT NULL DEFAULT 20, -- % retenu sur salaire
  plafond_mensuel INTEGER NOT NULL DEFAULT 100000, -- FCFA max retenu/mois
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_contract_id, categorie_rh)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_config_categories_contract ON config_categories_rh(company_contract_id);

-- 5. Insertion config par défaut pour Brasco (contract_id = 1)
INSERT INTO config_categories_rh (company_contract_id, categorie_rh, pourcentage_salarie, plafond_mensuel)
VALUES 
  (1, 'cadre_direction', 30, 200000),
  (1, 'cadre', 25, 150000),
  (1, 'agent_maitrise', 20, 100000),
  (1, 'employe', 15, 75000),
  (1, 'ouvrier', 10, 50000)
ON CONFLICT (company_contract_id, categorie_rh) DO NOTHING;

-- 6. Trigger pour updated_at sur catalogue_pharmacie
CREATE OR REPLACE FUNCTION update_catalogue_pharmacie_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_catalogue_pharmacie ON catalogue_pharmacie;
CREATE TRIGGER trigger_update_catalogue_pharmacie
  BEFORE UPDATE ON catalogue_pharmacie
  FOR EACH ROW
  EXECUTE FUNCTION update_catalogue_pharmacie_updated_at();

-- 7. Trigger pour updated_at sur config_categories_rh
CREATE OR REPLACE FUNCTION update_config_categories_rh_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_config_categories_rh ON config_categories_rh;
CREATE TRIGGER trigger_update_config_categories_rh
  BEFORE UPDATE ON config_categories_rh
  FOR EACH ROW
  EXECUTE FUNCTION update_config_categories_rh_updated_at();
