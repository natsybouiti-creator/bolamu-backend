-- ============================================================
-- Migration 063 — Suppression table otps
-- Doublon de otp_codes (système OTP actif).
-- Vérifié avant suppression : 0 ligne en base, 0 appelant dans src/.
-- Colonnes : id, phone, code, expires_at, created_at
-- ============================================================

DROP TABLE IF EXISTS otps;
