-- Migration B7-001: Tables ICP Scores et SmartFlow Reports
-- Pour le calcul de l'Indice de Capital Productif (ICP) des entreprises

CREATE TABLE IF NOT EXISTS icp_scores (
  id              SERIAL PRIMARY KEY,
  contract_id     INTEGER NOT NULL
                  REFERENCES company_contracts(id),
  mois            VARCHAR(7) NOT NULL, -- format YYYY-MM
  nb_employes     INTEGER DEFAULT 0,
  nb_actifs       INTEGER DEFAULT 0,
  taux_activite   NUMERIC(5,2) DEFAULT 0,
  avg_wellness    NUMERIC(5,2) DEFAULT 0,
  nb_consultations INTEGER DEFAULT 0,
  nb_ordonnances  INTEGER DEFAULT 0,
  score_icp       NUMERIC(5,2) DEFAULT 0,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, mois)
);

CREATE TABLE IF NOT EXISTS smartflow_reports (
  id              SERIAL PRIMARY KEY,
  contract_id     INTEGER NOT NULL
                  REFERENCES company_contracts(id),
  mois            VARCHAR(7) NOT NULL,
  report_data     JSONB NOT NULL DEFAULT '{}',
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  UNIQUE(contract_id, mois)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_icp_scores_contract_mois 
  ON icp_scores(contract_id, mois);
CREATE INDEX IF NOT EXISTS idx_icp_scores_mois 
  ON icp_scores(mois DESC);

CREATE INDEX IF NOT EXISTS idx_smartflow_reports_contract_mois 
  ON smartflow_reports(contract_id, mois);
CREATE INDEX IF NOT EXISTS idx_smartflow_reports_mois 
  ON smartflow_reports(mois DESC);
