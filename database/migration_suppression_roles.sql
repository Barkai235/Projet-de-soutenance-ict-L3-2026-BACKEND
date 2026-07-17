-- ============================================================
-- MIGRATION : Suppression des rôles médecin, infirmier,
--             pharmacien, aidant et de leurs données
-- ============================================================

USE hypertension_db;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- ÉTAPE 1 : Supprimer les tables propres aux acteurs supprimés
-- ============================================================

-- Table de télé-expertise (fonctionnalité supprimée)
DROP TABLE IF EXISTS tele_expertises;

-- Table de lien patient-aidant (acteur supprimé)
DROP TABLE IF EXISTS aidants;

-- Table de profils médecins (acteur supprimé)
DROP TABLE IF EXISTS profils_medecins;

-- ============================================================
-- ÉTAPE 2 : Nettoyer les données liées aux utilisateurs supprimés
-- ============================================================

-- Ordonnances créées par des médecins (lignes d'ordonnance)
DELETE om FROM ordonnances_medicaments om
INNER JOIN ordonnances o ON o.id = om.ordonnance_id
INNER JOIN utilisateurs u ON u.id = o.medecin_id
INNER JOIN roles r ON r.id = u.role_id
WHERE r.nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant');

-- Ordonnances créées par des médecins
DELETE o FROM ordonnances o
INNER JOIN utilisateurs u ON u.id = o.medecin_id
INNER JOIN roles r ON r.id = u.role_id
WHERE r.nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant');

-- Rappels liés à des patients dont le médecin est supprimé
-- (les rappels patients eux-mêmes restent — ON DELETE CASCADE du patient_id)

-- Mesures prises par des infirmiers → remettre prise_par à NULL
UPDATE mesures_tension mt
INNER JOIN utilisateurs u ON u.id = mt.prise_par
INNER JOIN roles r ON r.id = u.role_id
SET mt.prise_par = NULL
WHERE r.nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant');

-- Messages envoyés ou reçus par les utilisateurs supprimés
DELETE FROM messages
WHERE expediteur_id IN (
  SELECT u.id FROM (
    SELECT u2.id FROM utilisateurs u2
    INNER JOIN roles r ON r.id = u2.role_id
    WHERE r.nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant')
  ) u
)
OR destinataire_id IN (
  SELECT u.id FROM (
    SELECT u2.id FROM utilisateurs u2
    INNER JOIN roles r ON r.id = u2.role_id
    WHERE r.nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant')
  ) u
);

-- Notifications des utilisateurs supprimés
DELETE n FROM notifications n
INNER JOIN utilisateurs u ON u.id = n.utilisateur_id
INNER JOIN roles r ON r.id = u.role_id
WHERE r.nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant');

-- Alertes tension liées aux patients dont le médecin est supprimé
-- (les alertes des patients restent — elles appartiennent aux patients)

-- Réinitialiser le médecin assigné aux patients (la colonne reste mais vaut NULL)
UPDATE profils_patients pp
INNER JOIN utilisateurs u ON u.id = pp.medecin_id
INNER JOIN roles r ON r.id = u.role_id
SET pp.medecin_id = NULL
WHERE r.nom = 'medecin';

-- ============================================================
-- ÉTAPE 3 : Supprimer les utilisateurs avec les rôles supprimés
-- (CASCADE supprime automatiquement : profils_patients si patient,
--  parametres_utilisateurs, rappels_medicaments, prises_medicaments)
-- ============================================================

DELETE u FROM utilisateurs u
INNER JOIN roles r ON r.id = u.role_id
WHERE r.nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant');

-- ============================================================
-- ÉTAPE 4 : Supprimer les rôles inutiles
-- ============================================================

DELETE FROM roles
WHERE nom IN ('medecin', 'infirmier', 'pharmacien', 'aidant');

-- ============================================================
-- ÉTAPE 5 : Mettre à jour la description du rôle cardiologue
-- ============================================================

UPDATE roles
SET description = 'Cardiologue spécialiste, suit les patients à distance via télémédecine'
WHERE nom = 'cardiologue';

-- ============================================================
-- ÉTAPE 6 : Nettoyer l'ENUM source de mesures_tension
--           (supprimer la valeur 'infirmier' devenue obsolète)
-- ============================================================

ALTER TABLE mesures_tension
MODIFY COLUMN source ENUM('manuel', 'iot') DEFAULT 'manuel';

-- ============================================================
-- ÉTAPE 7 : Vérification finale
-- ============================================================

SELECT '✅ Rôles restants :' AS info;
SELECT id, nom, description FROM roles;

SELECT '✅ Utilisateurs par rôle :' AS info;
SELECT r.nom AS role, COUNT(u.id) AS nb_utilisateurs
FROM roles r
LEFT JOIN utilisateurs u ON u.role_id = r.id
GROUP BY r.id, r.nom;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
