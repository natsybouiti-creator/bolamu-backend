-- ============================================================
-- Migration 088 : offres de démonstration multi-catégories
-- Date : 17 juillet 2026
--
-- Décision produit (chantier du 17 juillet 2026) : peupler
-- partner_programs avec des offres de démonstration pour valider la
-- mécanique de bout en bout (catégories, photos, échange Zora) avant
-- signature de vrais partenariats commerciaux. CE NE SONT PAS DE VRAIS
-- PARTENARIATS — noms de commerce fictifs génériques, `description`
-- marque explicitement chaque ligne comme démo pour identification et
-- suppression future facile. `partner_phone = NULL` (cohérent avec les
-- 3 offres santé réelles, qui n'ont elles-mêmes aucun partner_phone).
--
-- Photos : uploadées vers Cloudinary depuis des photos déjà présentes
-- dans public/images/landing/, vérifiées visuellement avant usage pour
-- écarter toute marque réelle visible — SAUF la catégorie Carburant
-- (voir note ci-dessous, décision explicite de l'utilisateur après
-- double confirmation du risque signalé).
--
-- Coûts Zora alignés sur les montants déjà utilisés par catégorie dans
-- le tableau statique A.partners de dashboard.html (Électronique
-- 2500-18000, Voyage ~2000, Télécom 300-500, Hôtels ~2500, Sport
-- ~1200, Beauté ~900, Carburant ~800).
--
-- ATTENTION MARQUE — Carburant : la seule photo "station-service"
-- disponible dans public/images/landing/ (station.png) montre une
-- vraie enseigne TotalEnergies (logo, couleurs, tarifs affichés). Le
-- risque a été signalé explicitement à l'utilisateur à deux reprises
-- (photo alternative générique proposée : illustration vectorielle
-- maison ; alternative : retirer la catégorie) — confirmé malgré tout
-- par l'utilisateur en connaissance de cause. Le nom du commerce reste
-- fictif ("Station AutoPlus"), seule la photo porte ce risque résiduel
-- assumé. À reconsidérer si ce chantier remonte un jour vers une vraie
-- diffusion publique élargie.
-- ============================================================

INSERT INTO partner_programs (name, description, zora_cost, fcfa_value, category, is_active, image_url, partner_phone)
VALUES
  ('Boutique TechZone', 'Écouteurs sans fil Bluetooth, réduction de bruit — Offre de démonstration, partenaire fictif à remplacer par un vrai partenariat.', 4000, 45000, 'Électronique', TRUE, 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317606/bolamu/partner_programs/demo_electronique.png', NULL),
  ('Agence Horizon Voyages', 'Réduction sur un vol régional — Offre de démonstration, partenaire fictif à remplacer par un vrai partenariat.', 3500, 40000, 'Voyage', TRUE, 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317601/bolamu/partner_programs/demo_voyage.png', NULL),
  ('Réseau ConnectPlus', 'Forfait internet mobile 5 Go — Offre de démonstration, partenaire fictif à remplacer par un vrai partenariat.', 600, 5000, 'Télécom', TRUE, 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317602/bolamu/partner_programs/demo_telecom.jpg', NULL),
  ('Hôtel Bord de Mer', 'Nuitée en chambre standard — Offre de démonstration, partenaire fictif à remplacer par un vrai partenariat.', 3000, 35000, 'Hôtels', TRUE, 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317603/bolamu/partner_programs/demo_hotels.jpg', NULL),
  ('Club Forme & Vitalité', 'Abonnement salle de sport, 1 mois accès illimité — Offre de démonstration, partenaire fictif à remplacer par un vrai partenariat.', 1500, 15000, 'Sport', TRUE, 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317604/bolamu/partner_programs/demo_sport.jpg', NULL),
  ('Institut Éclat Beauté', 'Soin visage complet — Offre de démonstration, partenaire fictif à remplacer par un vrai partenariat.', 1000, 10000, 'Beauté', TRUE, 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317605/bolamu/partner_programs/demo_beaute.jpg', NULL),
  ('Station AutoPlus', 'Plein d''essence 30L — Offre de démonstration, partenaire fictif à remplacer par un vrai partenariat.', 800, 15000, 'Carburant', TRUE, 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317607/bolamu/partner_programs/demo_carburant.png', NULL);
