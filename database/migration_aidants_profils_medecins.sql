-- ============================================================
-- Recréer aidants + profils_medecins si absents
-- (supprimés par migration_suppression_roles.sql)
-- ============================================================

USE hypertension_db;

CREATE TABLE IF NOT EXISTS aidants (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  patient_id            INT NOT NULL,
  aidant_id             INT NOT NULL,
  relation              VARCHAR(100),
  peut_voir_mesures     BOOLEAN DEFAULT TRUE,
  peut_voir_ordonnances BOOLEAN DEFAULT FALSE,
  recoit_alertes        BOOLEAN DEFAULT TRUE,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id),
  FOREIGN KEY (aidant_id)  REFERENCES utilisateurs(id)
);

CREATE TABLE IF NOT EXISTS profils_medecins (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id   INT NOT NULL UNIQUE,
  numero_ordre     VARCHAR(50) NOT NULL UNIQUE,
  specialite       VARCHAR(100),
  hopital          VARCHAR(150),
  horaires         TEXT,
  biographie       TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);
