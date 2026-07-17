-- ============================================================
-- MIGRATION : Champs étendus pour inscription complète
-- Compatible MySQL 5.7+ et MySQL 8.0+ / 9.x
-- Exécuter via : node database/run_migration.js
-- ============================================================

-- Nouveaux champs dans utilisateurs
ALTER TABLE utilisateurs
  ADD COLUMN nationalite VARCHAR(100),
  ADD COLUMN ville       VARCHAR(100),
  ADD COLUMN quartier    VARCHAR(100),
  ADD COLUMN situation_maritale ENUM('celibataire','marie','divorce','veuf');

-- Nouveaux champs dans profils_patients
ALTER TABLE profils_patients
  ADD COLUMN antecedents_familiaux TEXT,
  ADD COLUMN traitements_cours     TEXT,
  ADD COLUMN activite_physique     ENUM('sedentaire','leger','modere','tres_actif'),
  ADD COLUMN tabac                 ENUM('non_fumeur','ancien_fumeur','fumeur'),
  ADD COLUMN alcool                ENUM('jamais','occasionnel','regulier'),
  ADD COLUMN contact_urgence_nom   VARCHAR(200),
  ADD COLUMN contact_urgence_lien  VARCHAR(50),
  ADD COLUMN contact_urgence_tel   VARCHAR(20);

-- Nouveaux champs dans profils_cardiologues
ALTER TABLE profils_cardiologues
  ADD COLUMN ordre_medical         VARCHAR(50),
  ADD COLUMN titre                 VARCHAR(100),
  ADD COLUMN annees_experience     INT,
  ADD COLUMN structure_nom         VARCHAR(200),
  ADD COLUMN structure_type        ENUM('hopital_public','clinique_privee','cabinet_liberal','centre_sante'),
  ADD COLUMN departement           VARCHAR(100),
  ADD COLUMN langues               VARCHAR(200),
  ADD COLUMN tarif_fcfa            INT,
  ADD COLUMN accepte_video         BOOLEAN DEFAULT TRUE,
  ADD COLUMN jours_consultation    VARCHAR(100),
  ADD COLUMN heure_debut           TIME,
  ADD COLUMN heure_fin             TIME,
  ADD COLUMN duree_consultation    INT DEFAULT 30,
  ADD COLUMN max_patients_jour     INT DEFAULT 10,
  ADD COLUMN statut_validation     ENUM('en_attente','validee','rejetee') DEFAULT 'en_attente';
