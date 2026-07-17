import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

const DashboardModel = {

  /* ── PATIENT ────────────────────────────────────────── */

  async getStatsPatient(patient_id: number): Promise<RowDataPacket> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         -- Mesures
         (SELECT COUNT(*) FROM mesures_tension
          WHERE patient_id = ?) AS total_mesures,
         (SELECT COUNT(*) FROM mesures_tension
          WHERE patient_id = ?
            AND date_mesure >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         ) AS mesures_30j,
         -- Dernière mesure
         (SELECT systolique FROM mesures_tension
          WHERE patient_id = ?
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_systolique,
         (SELECT diastolique FROM mesures_tension
          WHERE patient_id = ?
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_diastolique,
         (SELECT statut FROM mesures_tension
          WHERE patient_id = ?
          ORDER BY date_mesure DESC LIMIT 1
         ) AS dernier_statut,
         (SELECT date_mesure FROM mesures_tension
          WHERE patient_id = ?
          ORDER BY date_mesure DESC LIMIT 1
         ) AS derniere_date,
         -- Rappels actifs
         (SELECT COUNT(*) FROM rappels_medicaments
          WHERE patient_id = ? AND est_actif = TRUE
         ) AS rappels_actifs,
         -- Observance 30j
         (SELECT ROUND(SUM(statut='pris') / COUNT(*) * 100, 1)
          FROM prises_medicaments
          WHERE patient_id = ?
            AND date_prise >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         ) AS taux_observance,
         -- Ordonnances actives
         (SELECT COUNT(*) FROM ordonnances
          WHERE patient_id = ? AND statut = 'active'
         ) AS ordonnances_actives,
         -- Alertes non résolues
         (SELECT COUNT(*) FROM alertes_tension
          WHERE patient_id = ? AND resolu = FALSE
         ) AS alertes_actives,
         -- Messages non lus
         (SELECT COUNT(*) FROM messages
          WHERE destinataire_id = ? AND est_lu = FALSE
         ) AS messages_non_lus,
         -- Notifications non lues
         (SELECT COUNT(*) FROM notifications
          WHERE utilisateur_id = ? AND est_lu = FALSE
         ) AS notifications_non_lues`,
      Array(12).fill(patient_id)
    );
    return rows[0];
  },

  async getMoyennesPatient(
    patient_id: number,
    jours: number
  ): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE(date_mesure)          AS jour,
         ROUND(AVG(systolique),  1) AS moy_sys,
         ROUND(AVG(diastolique), 1) AS moy_dia,
         ROUND(AVG(pouls),       1) AS moy_pouls,
         COUNT(*)                   AS nb_mesures
       FROM mesures_tension
       WHERE patient_id = ?
         AND date_mesure >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(date_mesure)
       ORDER BY jour ASC`,
      [patient_id, jours]
    );
    return rows;
  },

  async getRappelsDuJour(patient_id: number): Promise<RowDataPacket[]> {
    const jourSemaine = new Date().getDay() || 7; // 1=Lun…7=Dim
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, m.nom AS medicament_nom, m.dosage
       FROM rappels_medicaments r
       JOIN medicaments m ON r.medicament_id = m.id
       WHERE r.patient_id = ?
         AND r.est_actif  = TRUE
         AND FIND_IN_SET(?, r.jours_semaine) > 0
       ORDER BY r.heure_rappel ASC`,
      [patient_id, String(jourSemaine)]
    );
    return rows;
  },

  async getAlertesPatientsActives(patient_id: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*,
              m.systolique, m.diastolique, m.date_mesure
       FROM alertes_tension a
       JOIN mesures_tension m ON a.mesure_id = m.id
       WHERE a.patient_id = ? AND a.resolu = FALSE
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [patient_id]
    );
    return rows;
  },

  /* ── MÉDECIN ────────────────────────────────────────── */

  async getStatsMedecin(medecin_id: number): Promise<RowDataPacket> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM profils_patients
          WHERE medecin_id = ?) AS total_patients,
         (SELECT COUNT(DISTINCT a.patient_id)
          FROM alertes_tension a
          JOIN profils_patients pp ON pp.utilisateur_id = a.patient_id
          WHERE pp.medecin_id = ? AND a.resolu = FALSE
         ) AS patients_en_alerte,
         (SELECT COUNT(*) FROM ordonnances
          WHERE medecin_id = ?
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         ) AS ordonnances_ce_mois,
         (SELECT COUNT(*) FROM messages
          WHERE destinataire_id = ? AND est_lu = FALSE
         ) AS messages_non_lus`,
      [medecin_id, medecin_id, medecin_id, medecin_id]
    );
    return rows[0];
  },

  async getPatientsEnAlerte(medecin_id: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.telephone,
         a.type_alerte, a.niveau, a.created_at AS alerte_date,
         m.systolique, m.diastolique, m.date_mesure
       FROM alertes_tension a
       JOIN utilisateurs u ON a.patient_id = u.id
       JOIN mesures_tension m ON a.mesure_id = m.id
       JOIN profils_patients pp ON pp.utilisateur_id = u.id
       WHERE pp.medecin_id = ? AND a.resolu = FALSE
       ORDER BY a.created_at DESC
       LIMIT 10`,
      [medecin_id]
    );
    return rows;
  },

  async getMesPatients(medecin_id: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.telephone, u.created_at,
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
         ) AS alertes_actives
       FROM profils_patients pp
       JOIN utilisateurs u ON pp.utilisateur_id = u.id
       WHERE pp.medecin_id = ?
       ORDER BY alertes_actives DESC, u.nom ASC`,
      [medecin_id]
    );
    return rows;
  },

  /* ── ADMIN ──────────────────────────────────────────── */

  async getStatsAdmin(): Promise<RowDataPacket> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM utilisateurs WHERE est_actif = TRUE) AS total_utilisateurs,
         (SELECT COUNT(*) FROM utilisateurs
          WHERE est_actif = TRUE
            AND role_id = (SELECT id FROM roles WHERE nom='patient')
         ) AS total_patients,
         (SELECT COUNT(*) FROM utilisateurs
          WHERE est_actif = TRUE
            AND role_id = (SELECT id FROM roles WHERE nom='cardiologue')
         ) AS total_medecins,
         (SELECT COUNT(*) FROM mesures_tension
          WHERE date_mesure >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ) AS mesures_semaine,
         (SELECT COUNT(*) FROM mesures_tension
          WHERE created_at >= CURDATE()
         ) AS mesures_aujourd_hui,
         (SELECT COUNT(*) FROM alertes_tension
          WHERE resolu = FALSE
         ) AS alertes_actives,
         (SELECT COUNT(*) FROM messages
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ) AS messages_semaine,
         (SELECT COUNT(*) FROM utilisateurs
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         ) AS nouveaux_ce_mois`
    );
    return rows[0];
  },

  async getActiviteGlobale(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE(date_mesure)  AS jour,
         COUNT(*)           AS nb_mesures,
         SUM(statut = 'crise')          AS crises,
         SUM(statut = 'hypertension_2') AS hta2
       FROM mesures_tension
       WHERE date_mesure >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(date_mesure)
       ORDER BY jour ASC`
    );
    return rows;
  },

  async getRepartitionRoles(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.nom AS role, COUNT(u.id) AS total
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE u.est_actif = TRUE
       GROUP BY r.nom
       ORDER BY total DESC`
    );
    return rows;
  },

  /* ── RAPPORT PATIENT ────────────────────────────────── */

  async getDonneesRapport(patient_id: number): Promise<{
    patient:   RowDataPacket;
    mesures:   RowDataPacket[];
    stats:     RowDataPacket;
    rappels:   RowDataPacket[];
    alertes:   RowDataPacket[];
  }> {
    const [[patientRows], [mesureRows], [statsRows], [rappelRows], [alerteRows]] =
      await Promise.all([
        pool.execute<RowDataPacket[]>(
          `SELECT u.*, r.nom AS role_nom, pp.numero_dossier,
                  pp.groupe_sanguin, pp.taille_cm, pp.poids_kg,
                  pp.antecedents_medicaux, pp.allergies, pp.niveau_risque,
                  med.nom AS medecin_nom, med.prenom AS medecin_prenom
           FROM utilisateurs u
           JOIN roles r ON u.role_id = r.id
           JOIN profils_patients pp ON pp.utilisateur_id = u.id
           LEFT JOIN utilisateurs med ON pp.medecin_id = med.id
           WHERE u.id = ?`,
          [patient_id]
        ),
        pool.execute<RowDataPacket[]>(
          `SELECT * FROM mesures_tension
           WHERE patient_id = ?
             AND date_mesure >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           ORDER BY date_mesure DESC`,
          [patient_id]
        ),
        pool.execute<RowDataPacket[]>(
          `SELECT
             COUNT(*) AS total,
             ROUND(AVG(systolique),  1) AS moy_sys,
             ROUND(AVG(diastolique), 1) AS moy_dia,
             ROUND(AVG(pouls),       1) AS moy_pouls,
             MAX(systolique)            AS max_sys,
             MIN(systolique)            AS min_sys,
             SUM(statut='normal')           AS nb_normal,
             SUM(statut='pre_hypertension') AS nb_pre_hta,
             SUM(statut='hypertension_1')   AS nb_hta1,
             SUM(statut='hypertension_2')   AS nb_hta2,
             SUM(statut='crise')            AS nb_crise
           FROM mesures_tension
           WHERE patient_id = ?
             AND date_mesure >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [patient_id]
        ),
        pool.execute<RowDataPacket[]>(
          `SELECT r.heure_rappel, r.jours_semaine, r.est_actif,
                  m.nom AS medicament_nom, m.dosage
           FROM rappels_medicaments r
           JOIN medicaments m ON r.medicament_id = m.id
           WHERE r.patient_id = ?`,
          [patient_id]
        ),
        pool.execute<RowDataPacket[]>(
          `SELECT a.type_alerte, a.niveau, a.created_at,
                  mt.systolique, mt.diastolique
           FROM alertes_tension a
           JOIN mesures_tension mt ON a.mesure_id = mt.id
           WHERE a.patient_id = ?
           ORDER BY a.created_at DESC
           LIMIT 10`,
          [patient_id]
        ),
      ]);

    return {
      patient: patientRows[0],
      mesures: mesureRows,
      stats:   statsRows[0],
      rappels: rappelRows,
      alertes: alerteRows,
    };
  },
};

export default DashboardModel;