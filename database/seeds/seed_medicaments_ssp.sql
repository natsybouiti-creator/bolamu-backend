-- ============================================================
-- BOLAMU — Seed Medicaments SSP OMS 2023 (Sprint 10)
-- 52 médicaments SSP pour catalogue hors catalogue
-- ============================================================

-- Antipaludiques (4)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Artémether+Luméfantrine', 'Coartem', 'paludisme', true, 'OMS_2023', true),
('Sulfadoxine-Pyriméthamine', 'Fansidar', 'paludisme', true, 'OMS_2023', true),
('Artésunate injectable', 'Artesun', 'paludisme', true, 'OMS_2023', true),
('TDR Paludisme', 'SD Bioline', 'diagnostic', true, 'OMS_2023', true);

-- Antibiotiques (9)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Amoxicilline', 'Amoxil', 'antibiotique', true, 'OMS_2023', true),
('Amoxicilline+Acide Clavulanique', 'Augmentin', 'antibiotique', true, 'OMS_2023', true),
('Doxycycline', 'Vibramycin', 'antibiotique', true, 'OMS_2023', true),
('Cotrimoxazole', 'Bactrim', 'antibiotique', true, 'OMS_2023', true),
('Métronidazole', 'Flagyl', 'antibiotique', true, 'OMS_2023', true),
('Ciprofloxacine', 'Cipro', 'antibiotique', true, 'OMS_2023', true),
('Azithromycine', 'Zithromax', 'antibiotique', true, 'OMS_2023', true),
('Érythromycine', 'Erythro', 'antibiotique', true, 'OMS_2023', true),
('Gentamicine injectable', 'Gentalline', 'antibiotique', true, 'OMS_2023', true);

-- Antiparasitaires (6)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Albendazole', 'Zentel', 'antiparasitaire', true, 'OMS_2023', true),
('Mébendazole', 'Vermox', 'antiparasitaire', true, 'OMS_2023', true),
('Fluconazole', 'Diflucan', 'antifongique', true, 'OMS_2023', true),
('Griséofulvine', 'Grisefuline', 'antifongique', true, 'OMS_2023', true),
('Perméthrine crème', 'Kwellada', 'antiparasitaire', true, 'OMS_2023', true),
('Ivermectine', 'Mectizan', 'antiparasitaire', true, 'OMS_2023', true);

-- Analgésiques (5)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Paracétamol', 'Doliprane', 'analgésique', true, 'OMS_2023', true),
('Ibuprofène', 'Advil', 'analgésique', true, 'OMS_2023', true),
('Aspirine', 'Aspirine', 'analgésique', true, 'OMS_2023', true),
('Tramadol', 'Tramal', 'analgésique', true, 'OMS_2023', true),
('Morphine orale', 'Sevredol', 'analgésique', true, 'OMS_2023', true);

-- Chroniques HTA (5)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Amlodipine', 'Norvasc', 'hta', true, 'OMS_2023', true),
('Énalapril', 'Renitec', 'hta', true, 'OMS_2023', true),
('Ramipril', 'Tritace', 'hta', true, 'OMS_2023', true),
('Hydrochlorothiazide', 'Esidrex', 'hta', true, 'OMS_2023', true),
('Méthyldopa', 'Aldomet', 'hta', true, 'OMS_2023', true);

-- Chroniques Diabète (4)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Metformine', 'Glucophage', 'diabète', true, 'OMS_2023', true),
('Glibenclamide', 'Daonil', 'diabète', true, 'OMS_2023', true),
('Insuline humaine régulière', 'Actrapid', 'diabète', true, 'OMS_2023', true),
('Insuline NPH', 'Insulatard', 'diabète', true, 'OMS_2023', true);

-- Respiratoire (3)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Salbutamol inhalateur', 'Ventolin', 'respiratoire', true, 'OMS_2023', true),
('Béclométasone inhalateur', 'Becotide', 'respiratoire', true, 'OMS_2023', true),
('Prednisolone orale', 'Cortancyl', 'respiratoire', true, 'OMS_2023', true);

-- Maternel (9)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Sulfate ferreux+Acide folique', 'Ferfolate', 'maternel', true, 'OMS_2023', true),
('Ocytocine', 'Syntocinon', 'maternel', true, 'OMS_2023', true),
('Magnésium sulfate', 'Magnésie', 'maternel', true, 'OMS_2023', true),
('Vitamine A', 'Vitamine A', 'maternel', true, 'OMS_2023', true),
('Zinc', 'Zinc', 'maternel', true, 'OMS_2023', true),
('SRO', 'SRO', 'maternel', true, 'OMS_2023', true),
('Contraceptifs oraux', 'Microgynon', 'maternel', true, 'OMS_2023', true),
('Dépo-Provera', 'Dépo-Provera', 'maternel', true, 'OMS_2023', true),
('Préservatifs masculins', 'Préservatifs', 'maternel', true, 'OMS_2023', true);

-- Dermatologie/ORL (6)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Hydrocortisone crème', 'Hydrocortisone', 'dermatologie', true, 'OMS_2023', true),
('Povidone iodée', 'Bétadine', 'dermatologie', true, 'OMS_2023', true),
('Chlorhexidine', 'Hibitane', 'dermatologie', true, 'OMS_2023', true),
('Tétracycline pommade ophtalmique', 'Tétracycline', 'ophtalmologie', true, 'OMS_2023', true),
('Chloramphénicol collyre', 'Chloramphénicol', 'ophtalmologie', true, 'OMS_2023', true),
('Nitrofurazone', 'Furacine', 'dermatologie', true, 'OMS_2023', true);

-- Santé mentale (4)
INSERT INTO medicaments_catalogue (nom_generique, nom_commercial, categorie, is_ssp, source_oms, is_active) VALUES
('Diazépam', 'Valium', 'santé mentale', true, 'OMS_2023', true),
('Amitriptyline', 'Laroxyl', 'santé mentale', true, 'OMS_2023', true),
('Phénobarbital', 'Gardénal', 'santé mentale', true, 'OMS_2023', true),
('Carbamazépine', 'Tégrétol', 'santé mentale', true, 'OMS_2023', true);

-- Total : 52 médicaments SSP OMS 2023
