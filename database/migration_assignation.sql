-- ============================================================
-- MIGRATION : Flux d'assignation Patient → Cardiologue
-- ============================================================

-- Table profils_cardiologues
CREATE TABLE IF NOT EXISTS profils_cardiologues (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id  INT NOT NULL UNIQUE,
  specialite      VARCHAR(100) DEFAULT 'Cardiologie',
  hopital         VARCHAR(200),
  ville           VARCHAR(100),
  biography       TEXT,
  quota_patients  INT DEFAULT 50,
  note_moyenne    DECIMAL(3,1) DEFAULT 0.0,
  accepte_nouvelles_demandes BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Créer automatiquement un profil pour chaque cardiologue existant
INSERT IGNORE INTO profils_cardiologues (utilisateur_id)
SELECT u.id FROM utilisateurs u
JOIN roles r ON u.role_id = r.id
WHERE r.nom = 'cardiologue' AND u.est_actif = TRUE;

-- Table demandes_assignation
CREATE TABLE IF NOT EXISTS demandes_assignation (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT NOT NULL,
  medecin_id      INT NOT NULL,
  motif           TEXT NOT NULL,
  urgence         ENUM('routine','moderee','urgente') DEFAULT 'routine',
  antecedents     TEXT,
  statut          ENUM('en_attente','acceptee','refusee','annulee') DEFAULT 'en_attente',
  motif_refus     VARCHAR(150),
  message_refus   TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (medecin_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  -- Plus d’UNIQUE sur statut : plusieurs cycles suivi (acceptee) possibles après fin de suivi.
  -- Une seule demande « en attente » par couple est imposée dans AssignationModel.creerDemande.
  INDEX idx_demande_patient_medecin (patient_id, medecin_id)
);

-- Bases déjà créées sans cette colonne (MySQL ignore l’erreur si elle existe déjà — voir run_migrations.js)
ALTER TABLE profils_cardiologues
  ADD COLUMN accepte_nouvelles_demandes BOOLEAN NOT NULL DEFAULT TRUE;
