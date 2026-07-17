import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface DossierCliniqueUpdate {
  organes_cibles_atteints?:   string | null;
  type_hypertension?:         string | null;
  complications_cliniques?:   string | null;
  ta_cible_texte?:            string | null;
}

const PatientsModel = {

  async listerPourMedecin(medecin_id: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.telephone, u.email, u.created_at,
         pp.niveau_risque, pp.numero_dossier,
         (SELECT systolique FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_systolique,
         (SELECT diastolique FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_diastolique,
         (SELECT statut FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS dernier_statut,
         (SELECT date_mesure FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_mesure_date,
         (SELECT COUNT(*) FROM alertes_tension
          WHERE patient_id = u.id AND resolu = FALSE
         ) AS alertes_actives,
         (SELECT COUNT(*) FROM messages
          WHERE destinataire_id = u.id AND est_lu = FALSE
         ) AS messages_non_lus
       FROM profils_patients pp
       JOIN utilisateurs u ON pp.utilisateur_id = u.id
       WHERE pp.medecin_id = ?
       ORDER BY alertes_actives DESC, u.nom ASC`,
      [medecin_id]
    );
    return rows;
  },

  async listerTousPatients(medecin_id: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.telephone, u.email, u.created_at,
         pp.niveau_risque, pp.numero_dossier,
         (pp.medecin_id = ?) AS est_mon_patient,
         COALESCE(med.nom, '') AS medecin_nom,
         COALESCE(med.prenom, '') AS medecin_prenom,
         (SELECT systolique FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_systolique,
         (SELECT diastolique FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_diastolique,
         (SELECT statut FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS dernier_statut,
         (SELECT date_mesure FROM mesures_tension
          WHERE patient_id = u.id
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_mesure_date,
         (SELECT COUNT(*) FROM alertes_tension
          WHERE patient_id = u.id AND resolu = FALSE
         ) AS alertes_actives
       FROM profils_patients pp
       JOIN utilisateurs u ON pp.utilisateur_id = u.id
       LEFT JOIN utilisateurs med ON pp.medecin_id = med.id
       ORDER BY est_mon_patient DESC, alertes_actives DESC, u.nom ASC`,
      [medecin_id]
    );
    return rows;
  },

  async getDossierPatient(patient_id: number, medecin_id: number): Promise<{
    profil:      RowDataPacket | null;
    mesures:     RowDataPacket[];
    alertes:     RowDataPacket[];
    ordonnances: RowDataPacket[];
    rdvs:        RowDataPacket[];
  }> {
    const [profilRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.email, u.telephone, u.date_naissance,
         pp.numero_dossier, pp.groupe_sanguin, pp.taille_cm, pp.poids_kg,
         pp.antecedents_medicaux, pp.allergies, pp.niveau_risque,
         pp.organes_cibles_atteints, pp.type_hypertension,
         pp.complications_cliniques, pp.ta_cible_texte, pp.enrichi_clinique_le,
         pp.created_at AS date_prise_en_charge
       FROM utilisateurs u
       JOIN profils_patients pp ON pp.utilisateur_id = u.id
       WHERE u.id = ? AND pp.medecin_id = ?`,
      [patient_id, medecin_id]
    );

    if (profilRows.length === 0) {
      return {
        profil: null,
        mesures: [],
        alertes: [],
        ordonnances: [],
        rdvs: [],
      };
    }

    const [[mesureRows], [alerteRows], [ordoRows], [rdvRows]] = await Promise.all([
      pool.execute<RowDataPacket[]>(
        `SELECT id, systolique, diastolique, pouls, statut, contexte, note, date_mesure
         FROM mesures_tension
         WHERE patient_id = ?
         ORDER BY date_mesure DESC
         LIMIT 30`,
        [patient_id]
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT a.id, a.type_alerte, a.niveau, a.resolu, a.created_at,
                m.systolique, m.diastolique, m.date_mesure
         FROM alertes_tension a
         JOIN mesures_tension m ON a.mesure_id = m.id
         WHERE a.patient_id = ?
         ORDER BY a.created_at DESC
         LIMIT 10`,
        [patient_id]
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT o.id, o.date_emission, o.statut, o.instructions,
                u.nom AS medecin_nom, u.prenom AS medecin_prenom
         FROM ordonnances o
         JOIN utilisateurs u ON o.medecin_id = u.id
         WHERE o.patient_id = ? AND o.medecin_id = ?
         ORDER BY o.date_emission DESC
         LIMIT 10`,
        [patient_id, medecin_id]
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT rv.id, rv.date_rdv, rv.type, rv.motif, rv.statut, rv.compte_rendu
         FROM rendez_vous rv
         WHERE rv.patient_id = ? AND rv.medecin_id = ?
         ORDER BY rv.date_rdv DESC
         LIMIT 10`,
        [patient_id, medecin_id]
      ),
    ]);

    return {
      profil:      profilRows[0] ?? null,
      mesures:     mesureRows,
      alertes:     alerteRows,
      ordonnances: ordoRows,
      rdvs:        rdvRows,
    };
  },

  async updateDossierClinique(
    patient_id: number,
    medecin_id: number,
    data: DossierCliniqueUpdate
  ): Promise<boolean> {
    const [check] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 AS ok FROM profils_patients
       WHERE utilisateur_id = ? AND medecin_id = ? LIMIT 1`,
      [patient_id, medecin_id]
    );
    if (check.length === 0) return false;

    await pool.execute(
      `UPDATE profils_patients SET
         organes_cibles_atteints   = ?,
         type_hypertension         = ?,
         complications_cliniques   = ?,
         ta_cible_texte            = ?,
         enrichi_clinique_le       = NOW()
       WHERE utilisateur_id = ? AND medecin_id = ?`,
      [
        data.organes_cibles_atteints ?? null,
        data.type_hypertension ?? null,
        data.complications_cliniques ?? null,
        data.ta_cible_texte ?? null,
        patient_id,
        medecin_id,
      ]
    );
    return true;
  },
};

export default PatientsModel;
