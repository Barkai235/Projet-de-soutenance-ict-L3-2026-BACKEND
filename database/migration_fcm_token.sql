-- ============================================================
-- MIGRATION : Colonne fcm_token dans utilisateurs
-- Exécuter dans : hypertension_db
-- ============================================================

USE hypertension_db;

ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500) NULL DEFAULT NULL;
