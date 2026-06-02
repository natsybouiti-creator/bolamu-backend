-- ============================================================
-- BOLAMU — Migration 029 : Catalogue SSP unifié (ssp_catalog)
-- Médicaments + examens biologiques + actes de soins primaires
-- Source de vérité pour la détermination SSP vs hors catalogue
-- Branché à smartflow.service.js isSSP()
-- ============================================================

CREATE TABLE IF NOT EXISTS ssp_catalog (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('medicament','examen','acte')),
  nom VARCHAR(255) NOT NULL,
  categorie VARCHAR(100),
  est_ssp BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (type, nom)
);

CREATE INDEX IF NOT EXISTS idx_ssp_catalog_type ON ssp_catalog(type);
CREATE INDEX IF NOT EXISTS idx_ssp_catalog_ssp ON ssp_catalog(est_ssp) WHERE est_ssp = true;
CREATE INDEX IF NOT EXISTS idx_ssp_catalog_nom ON ssp_catalog(lower(nom));

COMMENT ON TABLE ssp_catalog IS 'Catalogue SSP unifié : médicaments, examens et actes couverts (gratuits) ou hors catalogue';

-- ============================================================
-- 1) MÉDICAMENTS SSP
-- ============================================================

-- Antipaludiques
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Artémether+Luméfantrine', 'paludisme', true, 'Coartem — paludisme simple, 1re ligne — SSP OMS 2023'),
('medicament', 'Artésunate-Amodiaquine', 'paludisme', true, 'ASAQ — paludisme simple, alternative — SSP OMS 2023'),
('medicament', 'Artésunate injectable', 'paludisme', true, 'Artesun — paludisme grave — SSP OMS 2023'),
('medicament', 'Quinine', 'paludisme', true, 'Comprimé/injectable — paludisme grave, grossesse — SSP OMS 2023'),
('medicament', 'Sulfadoxine-Pyriméthamine', 'paludisme', true, 'Fansidar — TPI grossesse — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Antibiotiques
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Amoxicilline', 'antibiotique', true, 'Amoxil — SSP OMS 2023'),
('medicament', 'Amoxicilline+Acide Clavulanique', 'antibiotique', true, 'Augmentin — SSP OMS 2023'),
('medicament', 'Phénoxyméthylpénicilline', 'antibiotique', true, 'Pénicilline V orale — SSP OMS 2023'),
('medicament', 'Benzylpénicilline', 'antibiotique', true, 'Pénicilline G injectable — SSP OMS 2023'),
('medicament', 'Cloxacilline', 'antibiotique', true, 'Infections cutanées à staphylocoque — SSP OMS 2023'),
('medicament', 'Ceftriaxone', 'antibiotique', true, 'Rocéphine — injectable — SSP OMS 2023'),
('medicament', 'Céfixime', 'antibiotique', true, 'Oroken — SSP OMS 2023'),
('medicament', 'Doxycycline', 'antibiotique', true, 'Vibramycin — SSP OMS 2023'),
('medicament', 'Cotrimoxazole', 'antibiotique', true, 'Bactrim — SSP OMS 2023'),
('medicament', 'Métronidazole', 'antibiotique', true, 'Flagyl — SSP OMS 2023'),
('medicament', 'Ciprofloxacine', 'antibiotique', true, 'Cipro — SSP OMS 2023'),
('medicament', 'Azithromycine', 'antibiotique', true, 'Zithromax — SSP OMS 2023'),
('medicament', 'Érythromycine', 'antibiotique', true, 'Erythro — SSP OMS 2023'),
('medicament', 'Gentamicine injectable', 'antibiotique', true, 'Gentalline — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Antiparasitaires / antifongiques
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Albendazole', 'antiparasitaire', true, 'Zentel — déparasitage — SSP OMS 2023'),
('medicament', 'Mébendazole', 'antiparasitaire', true, 'Vermox — déparasitage — SSP OMS 2023'),
('medicament', 'Ivermectine', 'antiparasitaire', true, 'Mectizan — SSP OMS 2023'),
('medicament', 'Perméthrine crème', 'antiparasitaire', true, 'Kwellada — gale — SSP OMS 2023'),
('medicament', 'Benzoate de benzyle', 'antiparasitaire', true, 'Ascabiol — gale — SSP OMS 2023'),
('medicament', 'Fluconazole', 'antifongique', true, 'Diflucan — SSP OMS 2023'),
('medicament', 'Griséofulvine', 'antifongique', true, 'Grisefuline — SSP OMS 2023'),
('medicament', 'Miconazole', 'antifongique', true, 'Daktarin — mycose cutanée — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Analgésiques / antipyrétiques
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Paracétamol', 'analgésique', true, 'Doliprane — SSP OMS 2023'),
('medicament', 'Ibuprofène', 'analgésique', true, 'Advil — SSP OMS 2023'),
('medicament', 'Aspirine', 'analgésique', true, 'Acide acétylsalicylique — SSP OMS 2023'),
('medicament', 'Tramadol', 'analgésique', true, 'Tramal — SSP OMS 2023'),
('medicament', 'Morphine orale', 'analgésique', true, 'Sevredol — soins palliatifs — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Maladies chroniques — HTA / cardiovasculaire
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Amlodipine', 'hta', true, 'Norvasc — SSP OMS 2023'),
('medicament', 'Énalapril', 'hta', true, 'Renitec — SSP OMS 2023'),
('medicament', 'Ramipril', 'hta', true, 'Tritace — SSP OMS 2023'),
('medicament', 'Hydrochlorothiazide', 'hta', true, 'Esidrex — SSP OMS 2023'),
('medicament', 'Furosémide', 'hta', true, 'Lasilix — diurétique — SSP OMS 2023'),
('medicament', 'Aténolol', 'hta', true, 'Ténormine — bêtabloquant — SSP OMS 2023'),
('medicament', 'Méthyldopa', 'hta', true, 'Aldomet — HTA grossesse — SSP OMS 2023'),
('medicament', 'Atorvastatine', 'chronique', true, 'Tahor — dyslipidémie — SSP OMS 2023'),
('medicament', 'Oméprazole', 'chronique', true, 'Mopral — IPP — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Maladies chroniques — Diabète
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Metformine', 'diabète', true, 'Glucophage — SSP OMS 2023'),
('medicament', 'Glibenclamide', 'diabète', true, 'Daonil — SSP OMS 2023'),
('medicament', 'Insuline humaine régulière', 'diabète', true, 'Actrapid — SSP OMS 2023'),
('medicament', 'Insuline NPH', 'diabète', true, 'Insulatard — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Respiratoire
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Salbutamol inhalateur', 'respiratoire', true, 'Ventolin — asthme — SSP OMS 2023'),
('medicament', 'Béclométasone inhalateur', 'respiratoire', true, 'Becotide — asthme — SSP OMS 2023'),
('medicament', 'Prednisolone orale', 'respiratoire', true, 'Cortancyl — corticoïde — SSP OMS 2023'),
('medicament', 'Aminophylline', 'respiratoire', true, 'Bronchodilatateur — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Maternité / santé reproductive / nutrition
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Sulfate ferreux+Acide folique', 'maternel', true, 'Ferfolate — anémie grossesse — SSP OMS 2023'),
('medicament', 'Acide folique', 'maternel', true, 'Prévention anomalies du tube neural — SSP OMS 2023'),
('medicament', 'Ocytocine', 'maternel', true, 'Syntocinon — hémorragie du post-partum — SSP OMS 2023'),
('medicament', 'Misoprostol', 'maternel', true, 'Prévention/traitement HPP — SSP OMS 2023'),
('medicament', 'Magnésium sulfate', 'maternel', true, 'Pré-éclampsie/éclampsie — SSP OMS 2023'),
('medicament', 'Calcium', 'maternel', true, 'Supplémentation grossesse — SSP OMS 2023'),
('medicament', 'Vitamine A', 'maternel', true, 'Supplémentation — SSP OMS 2023'),
('medicament', 'Zinc', 'maternel', true, 'Diarrhée de l''enfant — SSP OMS 2023'),
('medicament', 'SRO', 'maternel', true, 'Sels de réhydratation orale — SSP OMS 2023'),
('medicament', 'Contraceptifs oraux', 'maternel', true, 'Microgynon — planning familial — SSP OMS 2023'),
('medicament', 'Dépo-Provera', 'maternel', true, 'Contraceptif injectable — SSP OMS 2023'),
('medicament', 'Préservatifs masculins', 'maternel', true, 'Planning familial / prévention IST — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Dermatologie / ophtalmologie / antiseptiques
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Hydrocortisone crème', 'dermatologie', true, 'Dermocorticoïde — SSP OMS 2023'),
('medicament', 'Violet de gentiane', 'dermatologie', true, 'Antiseptique cutané — SSP OMS 2023'),
('medicament', 'Aciclovir crème', 'dermatologie', true, 'Herpès cutané — SSP OMS 2023'),
('medicament', 'Povidone iodée', 'dermatologie', true, 'Bétadine — antiseptique — SSP OMS 2023'),
('medicament', 'Chlorhexidine', 'dermatologie', true, 'Hibitane — antiseptique — SSP OMS 2023'),
('medicament', 'Nitrofurazone', 'dermatologie', true, 'Furacine — soins de plaie — SSP OMS 2023'),
('medicament', 'Tétracycline pommade ophtalmique', 'ophtalmologie', true, 'Conjonctivite — SSP OMS 2023'),
('medicament', 'Chloramphénicol collyre', 'ophtalmologie', true, 'Conjonctivite bactérienne — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- Santé mentale / neurologie
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('medicament', 'Diazépam', 'santé mentale', true, 'Valium — anxiolytique/anticonvulsivant — SSP OMS 2023'),
('medicament', 'Amitriptyline', 'santé mentale', true, 'Laroxyl — dépression — SSP OMS 2023'),
('medicament', 'Fluoxétine', 'santé mentale', true, 'Prozac — dépression — SSP OMS 2023'),
('medicament', 'Halopéridol', 'santé mentale', true, 'Haldol — psychose — SSP OMS 2023'),
('medicament', 'Chlorpromazine', 'santé mentale', true, 'Largactil — psychose — SSP OMS 2023'),
('medicament', 'Phénobarbital', 'santé mentale', true, 'Gardénal — épilepsie — SSP OMS 2023'),
('medicament', 'Carbamazépine', 'santé mentale', true, 'Tégrétol — épilepsie — SSP OMS 2023'),
('medicament', 'Acide valproïque', 'santé mentale', true, 'Dépakine — épilepsie — SSP OMS 2023')
ON CONFLICT (type, nom) DO NOTHING;

-- ============================================================
-- 2) EXAMENS BIOLOGIQUES SSP
-- ============================================================
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('examen', 'TDR Paludisme', 'diagnostic', true, 'Test de diagnostic rapide du paludisme'),
('examen', 'Goutte épaisse', 'biologie', true, 'Recherche et densité parasitaire du paludisme'),
('examen', 'Frottis sanguin', 'biologie', true, 'Identification de l''espèce plasmodiale'),
('examen', 'Hémogramme (NFS)', 'biologie', true, 'Numération formule sanguine'),
('examen', 'Taux d''hémoglobine', 'biologie', true, 'Dépistage de l''anémie'),
('examen', 'Glycémie', 'biologie', true, 'Dosage de la glycémie'),
('examen', 'Groupe sanguin Rhésus', 'biologie', true, 'Détermination groupe ABO et Rhésus'),
('examen', 'Test VIH', 'depistage', true, 'Dépistage rapide de l''infection à VIH'),
('examen', 'Test de grossesse urinaire', 'depistage', true, 'Détection béta-HCG urinaire'),
('examen', 'Sérologie hépatite B (AgHBs)', 'depistage', true, 'Dépistage de l''antigène HBs'),
('examen', 'Sérologie syphilis (VDRL/TPHA)', 'depistage', true, 'Dépistage de la syphilis'),
('examen', 'ECBU', 'biologie', true, 'Examen cytobactériologique des urines'),
('examen', 'Bandelette urinaire', 'biologie', true, 'Dépistage protéinurie, glycosurie, leucocytes'),
('examen', 'Examen parasitologique des selles (KAOP)', 'biologie', true, 'Recherche de parasites intestinaux'),
('examen', 'Recherche de BAAR (crachat)', 'diagnostic', true, 'Dépistage de la tuberculose pulmonaire'),
('examen', 'Test d''Emmel', 'biologie', true, 'Dépistage de la drépanocytose'),
('examen', 'Créatininémie', 'biologie', true, 'Évaluation de la fonction rénale'),
('examen', 'Transaminases (ASAT/ALAT)', 'biologie', true, 'Bilan hépatique'),
('examen', 'CRP', 'biologie', true, 'Protéine C réactive — marqueur d''inflammation')
ON CONFLICT (type, nom) DO NOTHING;

-- ============================================================
-- 3) ACTES DE SOINS PRIMAIRES SSP
-- ============================================================
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description) VALUES
('acte', 'Consultation médicale générale', 'soins primaires', true, 'Consultation de premier recours'),
('acte', 'Consultation prénatale (CPN)', 'maternite', true, 'Suivi de grossesse'),
('acte', 'Consultation postnatale', 'maternite', true, 'Suivi mère et nouveau-né après accouchement'),
('acte', 'Accouchement eutocique', 'maternite', true, 'Accouchement normal assisté'),
('acte', 'Planning familial', 'maternite', true, 'Conseil et pose de contraception'),
('acte', 'Vaccination PEV', 'prevention', true, 'Programme élargi de vaccination de l''enfant'),
('acte', 'Vaccination antitétanique (VAT)', 'prevention', true, 'VAT de la femme enceinte et en âge de procréer'),
('acte', 'Prise des constantes', 'soins primaires', true, 'Mesure des paramètres vitaux'),
('acte', 'Injection (IM/IV/SC)', 'soins primaires', true, 'Administration d''un traitement injectable'),
('acte', 'Pose de perfusion', 'soins primaires', true, 'Réhydratation/traitement par voie intraveineuse'),
('acte', 'Pansement simple', 'soins primaires', true, 'Soin de plaie non compliquée'),
('acte', 'Soins d''ulcère ou plaie chronique', 'soins primaires', true, 'Réfection de pansement de plaie chronique'),
('acte', 'Suture de plaie', 'soins primaires', true, 'Fermeture de plaie par points de suture'),
('acte', 'Incision d''abcès', 'soins primaires', true, 'Petite chirurgie — drainage d''abcès'),
('acte', 'Réhydratation orale (SRO)', 'soins primaires', true, 'Prise en charge de la diarrhée par SRO'),
('acte', 'Déparasitage', 'prevention', true, 'Déparasitage systématique de l''enfant'),
('acte', 'Dépistage de la malnutrition', 'prevention', true, 'Mesure du périmètre brachial / poids-taille'),
('acte', 'Surveillance de la croissance', 'prevention', true, 'Suivi de la courbe de croissance de l''enfant'),
('acte', 'Dépistage et conseil VIH', 'prevention', true, 'Counseling et test VIH volontaire'),
('acte', 'Éducation sanitaire', 'prevention', true, 'Information et sensibilisation à la santé')
ON CONFLICT (type, nom) DO NOTHING;

-- ============================================================
-- 4) Reprise des médicaments du catalogue existant (sécurité)
--    Tout médicament déjà présent dans medicaments_catalogue mais
--    non couvert ci-dessus est repris pour préserver isSSP().
-- ============================================================
INSERT INTO ssp_catalog (type, nom, categorie, est_ssp, description)
SELECT 'medicament', mc.nom_generique, mc.categorie, mc.is_ssp,
       COALESCE(mc.nom_commercial, '') || ' — ' || COALESCE(mc.source_oms, 'OMS')
FROM medicaments_catalogue mc
WHERE mc.is_active = true
ON CONFLICT (type, nom) DO NOTHING;
