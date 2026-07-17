-- ============================================================
-- MIGRATION : Table rendez_vous (télémédecine)
-- Exécuter dans : hypertension_db
-- ============================================================

USE hypertension_db;

CREATE TABLE IF NOT EXISTS rendez_vous (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  patient_id    INT NOT NULL,
  medecin_id    INT NOT NULL,
  date_rdv      DATETIME NOT NULL,
  statut        ENUM('en_attente','confirme','annule','termine') DEFAULT 'en_attente',
  type          ENUM('video','telephonique','cabinet') DEFAULT 'video',
  motif         TEXT,
  lien_video    VARCHAR(500) NULL,
  compte_rendu  TEXT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (medecin_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,

  INDEX idx_patient (patient_id),
  INDEX idx_medecin (medecin_id),
  INDEX idx_statut  (statut),
  INDEX idx_date    (date_rdv)
);
