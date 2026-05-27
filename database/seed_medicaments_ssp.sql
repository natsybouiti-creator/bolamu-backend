-- ============================================================
-- BOLAMU — Seed médicaments SSP OMS 2023
-- Peuple la table medicaments_catalogue avec 52 médicaments SSP
-- ============================================================

-- Antipaludiques SSP
INSERT INTO medicaments_catalogue 
  (nom_generique, categorie, is_ssp) VALUES
('Artémether + Luméfantrine', 'antipaludique', true),
('Sulfadoxine-Pyriméthamine', 'antipaludique', true),
('Artésunate injectable', 'antipaludique', true),
('TDR Paludisme', 'diagnostic', true),

-- Antibiotiques SSP
('Amoxicilline', 'antibiotique', true),
('Amoxicilline + Acide Clavulanique', 'antibiotique', true),
('Doxycycline', 'antibiotique', true),
('Cotrimoxazole', 'antibiotique', true),
('Métronidazole', 'antibiotique', true),
('Ciprofloxacine', 'antibiotique', true),
('Azithromycine', 'antibiotique', true),
('Érythromycine', 'antibiotique', true),
('Gentamicine injectable', 'antibiotique', true),

-- Antiparasitaires SSP
('Albendazole', 'antiparasitaire', true),
('Mébendazole', 'antiparasitaire', true),
('Fluconazole', 'antifongique', true),
('Griséofulvine', 'antifongique', true),
('Perméthrine crème', 'antiparasitaire', true),
('Ivermectine', 'antiparasitaire', true),

-- Analgésiques SSP
('Paracétamol', 'analgesique', true),
('Ibuprofène', 'analgesique', true),
('Aspirine', 'analgesique', true),
('Tramadol', 'analgesique', true),
('Morphine orale', 'soins_palliatifs', true),

-- Maladies chroniques SSP
('Amlodipine', 'chronique_hta', true),
('Énalapril', 'chronique_hta', true),
('Ramipril', 'chronique_hta', true),
('Hydrochlorothiazide', 'chronique_hta', true),
('Méthyldopa', 'chronique_hta', true),
('Metformine', 'chronique_diabete', true),
('Glibenclamide', 'chronique_diabete', true),
('Insuline humaine régulière', 'chronique_diabete', true),
('Insuline NPH', 'chronique_diabete', true),

-- Respiratoire SSP
('Salbutamol inhalateur', 'respiratoire', true),
('Béclométasone inhalateur', 'respiratoire', true),
('Prednisolone orale', 'respiratoire', true),

-- Santé maternelle SSP
('Sulfate ferreux + Acide folique', 'maternel', true),
('Ocytocine', 'maternel', true),
('Magnésium sulfate', 'maternel', true),
('Vitamine A', 'pediatrique', true),
('Zinc', 'pediatrique', true),
('Sels de Réhydratation Orale', 'pediatrique', true),
('Contraceptifs oraux', 'planification', true),
('Dépo-Provera', 'planification', true),
('Préservatifs masculins', 'planification', true),

-- Dermatologie/ORL SSP
('Hydrocortisone crème', 'dermatologie', true),
('Povidone iodée', 'dermatologie', true),
('Chlorhexidine', 'dermatologie', true),
('Tétracycline pommade ophtalmique', 'ophtalmologie', true),
('Chloramphénicol collyre', 'ophtalmologie', true),

-- Santé mentale SSP
('Diazépam', 'sante_mentale', true),
('Amitriptyline', 'sante_mentale', true),
('Phénobarbital', 'neurologie', true),
('Carbamazépine', 'neurologie', true);
