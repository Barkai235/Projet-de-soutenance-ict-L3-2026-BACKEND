-- ============================================================
-- Recréer tele_expertises si absente (ex. après migration_suppression_roles)
-- Exécuter : mysql -u ... hypertension_db < database/migration_tele_expertises.sql
-- ou via : node database/run_migrations.js
-- ============================================================

USE hypertension_db;

CREATE TABLE IF NOT EXISTS tele_expertises (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT NOT NULL,
  medecin_id       INT NOT NULL,
  cardiologue_id   INT NULL,
  motif            TEXT,
  statut           ENUM('demande','en_cours','cloturee') DEFAULT 'demande',
  avis_cardiologue TEXT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)     REFERENCES utilisateurs(id),
  FOREIGN KEY (medecin_id)     REFERENCES utilisateurs(id),
  FOREIGN KEY (cardiologue_id) REFERENCES utilisateurs(id)
);
