-- Aligner les demandes encore « acceptee » lorsque le profil patient n’a plus ce cardiologue assigné
-- (évite l’affichage « Acceptée » + bouton nouvelle demande après fin de suivi ou données héritées).
UPDATE demandes_assignation da
INNER JOIN profils_patients pp ON pp.utilisateur_id = da.patient_id
SET da.statut = 'annulee',
    da.motif_refus = 'fin_suivi',
    da.message_refus = 'Synchronisation : suivi non actif (profil sans ce cardiologue assigné).'
WHERE da.statut = 'acceptee'
  AND (pp.medecin_id IS NULL OR pp.medecin_id <> da.medecin_id);
