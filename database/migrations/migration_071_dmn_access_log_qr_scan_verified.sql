-- Migration 071 : Ajoute 'qr_scan_verified' à dmn_access_log_access_type_check
-- Date : 10 juillet 2026
-- Description : GET /api/v1/dmn/verify (Chantier DMN/BUG-013 — scan QR dossier par
--              un professionnel de santé authentifié) insère un log avec
--              access_type='qr_scan_verified', distinct de 'qr_scan' (généré par le
--              patient lui-même côté GET /dmn/qr-payload). La contrainte existante ne
--              l'autorisait pas — découvert via test d'intégration réel (INSERT rejeté
--              par dmn_access_log_access_type_check, avalé silencieusement par le
--              .catch() de logAccess()). Distinction conservée : traçabilité BHP /
--              Loi 29-2019 exige de savoir qui a réellement consulté le dossier, pas
--              seulement qui l'a généré.

ALTER TABLE dmn_access_log DROP CONSTRAINT dmn_access_log_access_type_check;

ALTER TABLE dmn_access_log ADD CONSTRAINT dmn_access_log_access_type_check
  CHECK (access_type::text = ANY (ARRAY[
    'qr_scan','download','consultation','update','qr_scan_verified'
  ]::text[]));
