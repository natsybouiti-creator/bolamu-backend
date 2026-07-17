-- ============================================================
-- Migration 089 : remplace la photo TotalEnergies de l'offre démo Carburant
-- Date : 17 juillet 2026
--
-- migration_088 avait utilisé, pour l'offre de démonstration fictive
-- "Station AutoPlus" (id=19), la seule photo "station-service"
-- disponible dans public/images/landing/ (station.png / zora-station.png)
-- — qui montre une vraie enseigne TotalEnergies (logo, tarifs affichés).
-- Ce choix avait été signalé comme un risque de marque et assumé
-- explicitement par l'utilisateur à l'époque (deux confirmations), mais
-- reconsidéré ensuite : ce risque est éliminé avant tout push, la base
-- étant en production.
--
-- Remplacé par un visuel vectoriel généré (SVG), enregistré dans
-- public/images/landing/zora-carburant-generique.svg — pompe à essence
-- et véhicule stylisés, palette Bolamu (navy #0A2463, primary #003FB1,
-- turquoise #00C9A7), aucun texte ni logo, vérifié visuellement (capture
-- d'écran) avant upload. Uploadé vers Cloudinary
-- (bolamu/partner_programs/demo_carburant_generique.svg).
-- ============================================================

UPDATE partner_programs
SET image_url = 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784319414/bolamu/partner_programs/demo_carburant_generique.svg'
WHERE id = 19;
