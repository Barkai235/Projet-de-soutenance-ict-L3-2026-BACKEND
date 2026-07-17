-- Corrige : Duplicate entry '…-…-acceptee' for key 'uq_demande_active'
-- L’index UNIQUE(patient_id, medecin_id, statut) n’autorisait qu’une seule ligne
-- 'acceptee' par couple. Après fin de suivi, l’ancienne ligne restait 'acceptee' ;
-- une nouvelle demande acceptée créait un second tuple identique → erreur MySQL.
--
-- Exécution : intégré à run_migrations.js (dropIndexSafe) ou manuellement :
--   ALTER TABLE demandes_assignation DROP INDEX uq_demande_active;

ALTER TABLE demandes_assignation DROP INDEX uq_demande_active;
