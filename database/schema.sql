-- ============================================================
-- PROJET : Plateforme de Suivi Médical — Hypertension Artérielle
-- BASE DE DONNÉES : hypertension_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS hypertension_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hypertension_db;

-- ============================================================
-- TABLE : roles
-- ============================================================
CREATE TABLE roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (nom, description) VALUES
  ('patient',       'Patient hypertendu, utilisateur principal de l\'app mobile'),
  ('medecin',       'Médecin traitant, suit ses patients à distance'),
  ('cardiologue',   'Spécialiste intervenant en télé-expertise'),
  ('infirmier',     'Assiste le médecin et effectue des visites à domicile'),
  ('pharmacien',    'Consulte les ordonnances et vérifie les médicaments'),
  ('administrateur','Gère la plateforme et les comptes utilisateurs'),
  ('aidant',        'Proche/aidant familial du patient');

-- ============================================================
-- TABLE : utilisateurs
-- ============================================================
CREATE TABLE utilisateurs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  uuid             VARCHAR(36) NOT NULL UNIQUE,
  nom              VARCHAR(100) NOT NULL,
  prenom           VARCHAR(100) NOT NULL,
  email            VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe     VARCHAR(255) NOT NULL,
  telephone        VARCHAR(20),
  date_naissance   DATE,
  sexe             ENUM('M','F','Autre'),
  adresse          TEXT,
  photo_profil     VARCHAR(255),
  role_id          INT NOT NULL,
  est_actif        BOOLEAN DEFAULT TRUE,
  email_verifie    BOOLEAN DEFAULT FALSE,
  token_reset      VARCHAR(255),
  token_expiration DATETIME,
  derniere_connexion DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ============================================================
-- TABLE : profils_patients
-- ============================================================
CREATE TABLE profils_patients (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id        INT NOT NULL UNIQUE,
  numero_dossier        VARCHAR(30) NOT NULL UNIQUE,
  groupe_sanguin        ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-'),
  taille_cm             DECIMAL(5,2),
  poids_kg              DECIMAL(5,2),
  antecedents_medicaux  TEXT,
  allergies             TEXT,
  niveau_risque         ENUM('faible','modere','eleve','tres_eleve') DEFAULT 'modere',
  medecin_id            INT,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (medecin_id)     REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE : profils_medecins
-- ============================================================
CREATE TABLE profils_medecins (
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

-- ============================================================
-- TABLE : mesures_tension
-- ============================================================
CREATE TABLE mesures_tension (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  patient_id        INT NOT NULL,
  prise_par         INT,
  systolique        INT NOT NULL,
  diastolique       INT NOT NULL,
  pouls             INT,
  bras              ENUM('gauche','droit') DEFAULT 'gauche',
  position          ENUM('assis','debout','couche') DEFAULT 'assis',
  contexte          ENUM('repos','apres_effort','stress','reveil','autre') DEFAULT 'repos',
  statut            ENUM('normal','pre_hypertension','hypertension_1','hypertension_2','crise') DEFAULT 'normal',
  note              TEXT,
  date_mesure       DATETIME NOT NULL,
  source            ENUM('manuel','iot','infirmier') DEFAULT 'manuel',
  appareil_id       VARCHAR(100),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (prise_par)  REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE : medicaments
-- ============================================================
CREATE TABLE medicaments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(150) NOT NULL,
  dci          VARCHAR(150),
  classe       VARCHAR(100),
  forme        VARCHAR(100),
  dosage       VARCHAR(100),
  description  TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE : ordonnances
-- ============================================================
CREATE TABLE ordonnances (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  uuid           VARCHAR(36) NOT NULL UNIQUE,
  patient_id     INT NOT NULL,
  medecin_id     INT NOT NULL,
  date_emission  DATE NOT NULL,
  date_expiration DATE,
  instructions   TEXT,
  statut         ENUM('active','expiree','annulee') DEFAULT 'active',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id),
  FOREIGN KEY (medecin_id) REFERENCES utilisateurs(id)
);

-- ============================================================
-- TABLE : ordonnances_medicaments (ligne d'ordonnance)
-- ============================================================
CREATE TABLE ordonnances_medicaments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  ordonnance_id   INT NOT NULL,
  medicament_id   INT NOT NULL,
  dose            VARCHAR(100),
  frequence       VARCHAR(100),
  duree           VARCHAR(100),
  instructions    TEXT,
  FOREIGN KEY (ordonnance_id) REFERENCES ordonnances(id) ON DELETE CASCADE,
  FOREIGN KEY (medicament_id) REFERENCES medicaments(id)
);

-- ============================================================
-- TABLE : rappels_medicaments
-- ============================================================
CREATE TABLE rappels_medicaments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT NOT NULL,
  medicament_id   INT NOT NULL,
  ordonnance_id   INT,
  heure_rappel    TIME NOT NULL,
  jours_semaine   VARCHAR(20),
  est_actif       BOOLEAN DEFAULT TRUE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)    REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
  FOREIGN KEY (ordonnance_id) REFERENCES ordonnances(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE : prises_medicaments (journal de prise)
-- ============================================================
CREATE TABLE prises_medicaments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  rappel_id     INT NOT NULL,
  patient_id    INT NOT NULL,
  date_prise    DATETIME NOT NULL,
  statut        ENUM('pris','oublie','reporte') DEFAULT 'pris',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rappel_id)  REFERENCES rappels_medicaments(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : messages
-- ============================================================
CREATE TABLE messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  expediteur_id INT NOT NULL,
  destinataire_id INT NOT NULL,
  contenu      TEXT NOT NULL,
  est_lu       BOOLEAN DEFAULT FALSE,
  piece_jointe VARCHAR(255),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expediteur_id)   REFERENCES utilisateurs(id),
  FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id)
);

-- ============================================================
-- TABLE : notifications
-- ============================================================
CREATE TABLE notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  titre        VARCHAR(200) NOT NULL,
  contenu      TEXT,
  type         ENUM('alerte','rappel','message','info','critique') DEFAULT 'info',
  est_lu       BOOLEAN DEFAULT FALSE,
  lien         VARCHAR(255),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : alertes_tension
-- ============================================================
CREATE TABLE alertes_tension (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  mesure_id     INT NOT NULL,
  patient_id    INT NOT NULL,
  type_alerte   ENUM('hypertension_2','crise_hypertensive','hypotension') NOT NULL,
  niveau        ENUM('warning','danger','critique') DEFAULT 'warning',
  notifie       BOOLEAN DEFAULT FALSE,
  resolu        BOOLEAN DEFAULT FALSE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mesure_id)  REFERENCES mesures_tension(id),
  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id)
);

-- ============================================================
-- TABLE : aidants (lien patient-aidant)
-- ============================================================
CREATE TABLE aidants (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT NOT NULL,
  aidant_id   INT NOT NULL,
  relation    VARCHAR(100),
  peut_voir_mesures   BOOLEAN DEFAULT TRUE,
  peut_voir_ordonnances BOOLEAN DEFAULT FALSE,
  recoit_alertes      BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES utilisateurs(id),
  FOREIGN KEY (aidant_id)  REFERENCES utilisateurs(id)
);

-- ============================================================
-- TABLE : tele_expertises
-- ============================================================
CREATE TABLE tele_expertises (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT NOT NULL,
  medecin_id      INT NOT NULL,
  cardiologue_id  INT,
  motif           TEXT,
  statut          ENUM('demande','en_cours','cloturee') DEFAULT 'demande',
  avis_cardiologue TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)     REFERENCES utilisateurs(id),
  FOREIGN KEY (medecin_id)     REFERENCES utilisateurs(id),
  FOREIGN KEY (cardiologue_id) REFERENCES utilisateurs(id)
);

-- ============================================================
-- TABLE : parametres_systeme
-- ============================================================
CREATE TABLE parametres_systeme (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  cle     VARCHAR(100) NOT NULL UNIQUE,
  valeur  TEXT,
  groupe  VARCHAR(100),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO parametres_systeme (cle, valeur, groupe) VALUES
  ('app_nom',              'HyperTrack',   'general'),
  ('app_version',          '1.0.0',        'general'),
  ('langue_defaut',        'fr',           'general'),
  ('email_support',        'support@hypertrack.com', 'contact'),
  ('seuil_systolique_alerte', '180',       'seuil'),
  ('seuil_diastolique_alerte','120',       'seuil'),
  ('seuil_systolique_warning','160',       'seuil'),
  ('seuil_diastolique_warning','100',      'seuil');

-- ============================================================
-- TABLE : parametres_utilisateurs
-- ============================================================
CREATE TABLE parametres_utilisateurs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id   INT NOT NULL UNIQUE,
  langue           VARCHAR(10) DEFAULT 'fr',
  theme            ENUM('clair','sombre','systeme') DEFAULT 'systeme',
  notif_push       BOOLEAN DEFAULT TRUE,
  notif_email      BOOLEAN DEFAULT TRUE,
  notif_sms        BOOLEAN DEFAULT FALSE,
  rappel_mesure    BOOLEAN DEFAULT TRUE,
  heure_rappel     TIME DEFAULT '08:00:00',
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : disponibilites_medecin (créneaux cardiologue)
-- ============================================================
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

-- ============================================================
-- COMPTE ADMIN PAR DÉFAUT
-- (mot de passe : Admin@1234 — à changer en production)
-- ============================================================
INSERT INTO utilisateurs (uuid, nom, prenom, email, mot_de_passe, role_id, est_actif, email_verifie)
VALUES (
  UUID(),
  'Administrateur',
  'Système',
  'admin@hypertrack.com',
  '$2a$12$2VK4Z1G8eHfVk3Y5gQpR8.nWmXjL9sZt7uB0cDvA1eF6hI3kM5oP2',
  6,
  TRUE,
  TRUE
);
