-- Table des créneaux de disponibilité (cardiologue = utilisateurs.id)
CREATE TABLE IF NOT EXISTS disponibilites_medecin (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  medecin_id     INT NOT NULL,
  jour_semaine   TINYINT NOT NULL COMMENT '1=Lun … 7=Dim',
  heure_debut    TIME NOT NULL,
  heure_fin      TIME NOT NULL,
  est_actif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (medecin_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  KEY idx_dispo_med_jour (medecin_id, jour_semaine)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
