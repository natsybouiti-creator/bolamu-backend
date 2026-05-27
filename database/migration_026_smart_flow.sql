-- ============================================================
-- BOLAMU — Migration 026 : Smart Flow Grands Comptes (Sprint 10)
-- Module hors catalogue SSP pour Brasco et grandes entreprises
-- Principe : SSP gratuit couvert CDR, hors catalogue prix plein
-- ============================================================

-- Table principale hors catalogue
CREATE TABLE IF NOT EXISTS hors_catalogue_transactions (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  prestataire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  prestataire_type VARCHAR(20) NOT NULL CHECK (
    prestataire_type IN ('pharmacie','laboratoire','doctor')),
  libelle VARCHAR(255) NOT NULL,
  prix_plein NUMERIC(12,2) NOT NULL CHECK (prix_plein > 0),
  company_contract_id INTEGER REFERENCES company_contracts(id),
  -- NULL si patient individuel, renseigné si salarié grand compte
  statut VARCHAR(20) DEFAULT 'notifie' CHECK (statut IN (
    'notifie','acquitte','retenue_salaire','prise_en_charge')),
  -- notifie = patient informé, montant à régler au prestataire
  -- acquitte = patient a payé cash
  -- retenue_salaire = Brasco paie, retenue générée
  -- prise_en_charge = Brasco assume sans retenue
  ssp_reference_id INTEGER,
  -- référence ordonnance ou consultation SSP liée si mixte
  ssp_reference_type VARCHAR(20) CHECK (
    ssp_reference_type IN ('prescription','appointment','lab')),
  notifie_patient_at TIMESTAMP,
  notifie_rh_at TIMESTAMP,
  acquitte_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table tagging médicaments SSP vs hors catalogue
CREATE TABLE IF NOT EXISTS medicaments_catalogue (
  id SERIAL PRIMARY KEY,
  nom_generique VARCHAR(255) NOT NULL,
  nom_commercial VARCHAR(255),
  categorie VARCHAR(100),
  -- paludisme, antibiotique, chronique, maternel, etc.
  is_ssp BOOLEAN DEFAULT true,
  -- true = SSP gratuit, false = hors catalogue prix plein
  source_oms VARCHAR(50) DEFAULT 'OMS_2023',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rôle RH grand compte
-- Ajouter company_rh aux rôles si pas déjà présent
-- (vérifier contrainte CHECK sur users.role avant)

-- Export paie mensuel
CREATE TABLE IF NOT EXISTS export_paie_mensuel (
  id SERIAL PRIMARY KEY,
  company_contract_id INTEGER NOT NULL 
    REFERENCES company_contracts(id),
  mois VARCHAR(7) NOT NULL, -- format YYYY-MM
  nb_employes_actifs INTEGER DEFAULT 0,
  nb_actes_ssp INTEGER DEFAULT 0,
  montant_ssp NUMERIC(12,2) DEFAULT 0,
  -- toujours 0 — couvert CDR
  nb_actes_hors_catalogue INTEGER DEFAULT 0,
  montant_hors_catalogue NUMERIC(12,2) DEFAULT 0,
  details_json JSONB DEFAULT '[]',
  -- [{employee_phone, libelle, montant, statut}]
  statut VARCHAR(20) DEFAULT 'brouillon' CHECK (statut IN (
    'brouillon','finalise','exporte')),
  exporte_at TIMESTAMP,
  exporte_par VARCHAR(20) REFERENCES users(phone),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index performance
CREATE INDEX IF NOT EXISTS idx_hors_cat_patient 
  ON hors_catalogue_transactions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_hors_cat_prestataire 
  ON hors_catalogue_transactions(prestataire_phone);
CREATE INDEX IF NOT EXISTS idx_hors_cat_contract 
  ON hors_catalogue_transactions(company_contract_id);
CREATE INDEX IF NOT EXISTS idx_hors_cat_statut 
  ON hors_catalogue_transactions(statut);
CREATE INDEX IF NOT EXISTS idx_hors_cat_created 
  ON hors_catalogue_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medicaments_ssp 
  ON medicaments_catalogue(is_ssp, is_active);
CREATE INDEX IF NOT EXISTS idx_export_paie_contract 
  ON export_paie_mensuel(company_contract_id, mois);

-- Commentaires
COMMENT ON TABLE hors_catalogue_transactions IS 'Transactions hors catalogue SSP pour grands comptes';
COMMENT ON TABLE medicaments_catalogue IS 'Catalogue médicaments SSP OMS 2023';
COMMENT ON TABLE export_paie_mensuel IS 'Exports paie mensuels pour grands comptes';
