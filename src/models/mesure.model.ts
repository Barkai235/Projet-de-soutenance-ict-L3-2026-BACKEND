import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { StatutTension } from '../utils/tension.utils';

export interface Mesure extends RowDataPacket {
  id:          number;
  patient_id:  number;
  prise_par:   number | null;
  systolique:  number;
  diastolique: number;
  pouls:       number | null;
  bras:        string;
  position:    string;
  contexte:    string;
  statut:      StatutTension;
  note:        string | null;
  date_mesure: string;
  source:      string;
  created_at:  string;
  // joins
  patient_nom:    string;
  patient_prenom: string;
  prise_par_nom:  string;
}

export interface CreateMesureDTO {
  patient_id:  number;
  prise_par?:  number;
  systolique:  number;
  diastolique: number;
  pouls?:      number;
  bras?:       string;
  position?:   string;
  contexte?:   string;
  statut:      StatutTension;
  note?:       string;
  date_mesure: string;
  source?:     string;
}

export interface FiltresMesure {
  patient_id?: number;
  statut?:     string;
  date_debut?: string;
  date_fin?:   string;
  limit?:      number;
  offset?:     number;
}

const MesureModel = {

  async create(data: CreateMesureDTO): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO mesures_tension
         (patient_id, prise_par, systolique, diastolique, pouls,
          bras, position, contexte, statut, note, date_mesure, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.patient_id,
        data.prise_par    ?? null,
        data.systolique,
        data.diastolique,
        data.pouls        ?? null,
        data.bras         ?? 'gauche',
        data.position     ?? 'assis',
        data.contexte     ?? 'repos',
        data.statut,
        data.note         ?? null,
        data.date_mesure,
        data.source       ?? 'manuel',
      ]
    );
    return result.insertId;
  },

  async findById(id: number): Promise<Mesure | null> {
    const [rows] = await pool.execute<Mesure[]>(
      `SELECT m.*,
              u.nom    AS patient_nom,
              u.prenom AS patient_prenom,
              p.nom    AS prise_par_nom
       FROM mesures_tension m
       JOIN utilisateurs u ON m.patient_id = u.id
       LEFT JOIN utilisateurs p ON m.prise_par = p.id
       WHERE m.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async findByPatient(filtres: FiltresMesure): Promise<Mesure[]> {
    let query = `
      SELECT m.*,
             u.nom    AS patient_nom,
             u.prenom AS patient_prenom
      FROM mesures_tension m
      JOIN utilisateurs u ON m.patient_id = u.id
      WHERE m.patient_id = ?
    `;
    const params: (string | number)[] = [filtres.patient_id!];

    if (filtres.statut) {
      query += ' AND m.statut = ?';
      params.push(filtres.statut);
    }
    if (filtres.date_debut) {
      query += ' AND m.date_mesure >= ?';
      params.push(filtres.date_debut);
    }
    if (filtres.date_fin) {
      query += ' AND m.date_mesure <= ?';
      params.push(filtres.date_fin);
    }

    query += ' ORDER BY m.date_mesure DESC';
    query += ` LIMIT ${filtres.limit ?? 50} OFFSET ${filtres.offset ?? 0}`;

    const [rows] = await pool.execute<Mesure[]>(query, params);
    return rows;
  },

  async countByPatient(patient_id: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM mesures_tension WHERE patient_id = ?',
      [patient_id]
    );
    return rows[0].total;
  },

  async delete(id: number, patient_id: number): Promise<boolean> {
    // Supprimer l'alerte liée d'abord (FK sans ON DELETE CASCADE)
    await pool.execute(
      'DELETE FROM alertes_tension WHERE mesure_id = ? AND patient_id = ?',
      [id, patient_id]
    );
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM mesures_tension WHERE id = ? AND patient_id = ?',
      [id, patient_id]
    );
    return result.affectedRows > 0;
  },

  async deleteAllByPatient(patient_id: number): Promise<number> {
    // 1. Supprimer les alertes liées aux mesures du patient (FK sans ON DELETE CASCADE)
    await pool.execute(
      `DELETE a FROM alertes_tension a
       JOIN mesures_tension m ON m.id = a.mesure_id
       WHERE m.patient_id = ?`,
      [patient_id]
    );
    // 2. Supprimer les mesures
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM mesures_tension WHERE patient_id = ?',
      [patient_id]
    );
    return result.affectedRows;
  },

  async getDerniereMesure(patient_id: number): Promise<Mesure | null> {
    const [rows] = await pool.execute<Mesure[]>(
      `SELECT * FROM mesures_tension
       WHERE patient_id = ?
       ORDER BY date_mesure DESC
       LIMIT 1`,
      [patient_id]
    );
    return rows[0] || null;
  },

  async getMoyennes(patient_id: number, jours: number = 30): Promise<RowDataPacket> {
    const safeJours = Math.max(1, Math.min(365, Number(jours) || 30));
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         ROUND(AVG(systolique),  1) AS moy_systolique,
         ROUND(AVG(diastolique), 1) AS moy_diastolique,
         ROUND(AVG(pouls),       1) AS moy_pouls,
         MAX(systolique)            AS max_systolique,
         MIN(systolique)            AS min_systolique,
         COUNT(*)                   AS total_mesures
       FROM mesures_tension
       WHERE patient_id = ?
         AND date_mesure >= DATE_SUB(NOW(), INTERVAL ${safeJours} DAY)`,
      [patient_id]
    );
    return rows[0];
  },

  async getStatistiquesStatuts(patient_id: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT statut, COUNT(*) AS total
       FROM mesures_tension
       WHERE patient_id = ?
       GROUP BY statut`,
      [patient_id]
    );
    return rows;
  },

  /** Vérifie l'existence d'une mesure identique (même patient, tension et date à la seconde près).
   *  Sert à rendre la synchro mobile idempotente (évite les doublons sur appels parallèles). */
  async existsIdentique(
    patient_id: number,
    systolique: number,
    diastolique: number,
    date_mesure?: string
  ): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM mesures_tension
       WHERE patient_id = ? AND systolique = ? AND diastolique = ?
         AND date_mesure = ? LIMIT 1`,
      [patient_id, systolique, diastolique, date_mesure ?? null]
    );
    return rows.length > 0;
  },

  // Pour le médecin : voir les mesures de ses patients
  async findByMedecin(medecin_id: number, limit = 20): Promise<Mesure[]> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    const [rows] = await pool.execute<Mesure[]>(
      `SELECT m.*,
              u.nom    AS patient_nom,
              u.prenom AS patient_prenom
       FROM mesures_tension m
       JOIN utilisateurs u ON m.patient_id = u.id
       JOIN profils_patients pp ON pp.utilisateur_id = m.patient_id
       WHERE pp.medecin_id = ?
       ORDER BY m.date_mesure DESC
       LIMIT ${safeLimit}`,
      [medecin_id]
    );
    return rows;
  },

  // Créer une alerte si tension critique
  async creerAlerte(
    mesure_id: number,
    patient_id: number,
    statut: StatutTension
  ): Promise<void> {
    if (statut !== 'crise' && statut !== 'hypertension_2') return;

    const type_alerte =
      statut === 'crise' ? 'crise_hypertensive' : 'hypertension_2';
    const niveau = statut === 'crise' ? 'critique' : 'danger';

    await pool.execute(
      `INSERT INTO alertes_tension
         (mesure_id, patient_id, type_alerte, niveau, notifie)
       VALUES (?, ?, ?, ?, FALSE)`,
      [mesure_id, patient_id, type_alerte, niveau]
    );

    const titre  = statut === 'crise' ? '🚨 Crise hypertensive détectée !' : '⚠️ Hypertension stade 2 détectée';
    const contenu = statut === 'crise'
      ? 'Votre tension est dangereusement élevée. Consultez immédiatement.'
      : 'Votre tension est très élevée. Contactez votre médecin.';

    // 1. Notifier le patient
    await pool.execute(
      `INSERT INTO notifications (utilisateur_id, titre, contenu, type) VALUES (?, ?, ?, 'critique')`,
      [patient_id, titre, contenu]
    );

    // 2. Notifier le médecin traitant
    const [ppRows] = await pool.execute<RowDataPacket[]>(
      `SELECT pp.medecin_id, u.prenom, u.nom
       FROM profils_patients pp
       JOIN utilisateurs u ON u.id = pp.utilisateur_id
       WHERE pp.utilisateur_id = ? AND pp.medecin_id IS NOT NULL`,
      [patient_id]
    );
    if (ppRows.length > 0) {
      const { medecin_id, prenom, nom } = ppRows[0];
      await pool.execute(
        `INSERT INTO notifications (utilisateur_id, titre, contenu, type, lien)
         VALUES (?, ?, ?, 'critique', '/mesures')`,
        [
          medecin_id,
          statut === 'crise' ? `🚨 Crise HTA — ${prenom} ${nom}` : `⚠️ HTA stade 2 — ${prenom} ${nom}`,
          `Tension critique enregistrée pour votre patient ${prenom} ${nom}. Action requise.`,
        ]
      );
    }

    // 3. Notifier les aidants autorisés (recoit_alertes) — table optionnelle si migration_suppression_roles
    try {
      const [aidants] = await pool.execute<RowDataPacket[]>(
        `SELECT aidant_id, u.prenom AS p_prenom, u.nom AS p_nom
         FROM aidants a
         JOIN utilisateurs u ON u.id = a.patient_id
         WHERE a.patient_id = ? AND a.recoit_alertes = TRUE`,
        [patient_id]
      );
      for (const a of aidants) {
        await pool.execute(
          `INSERT INTO notifications (utilisateur_id, titre, contenu, type) VALUES (?, ?, ?, 'critique')`,
          [
            a.aidant_id,
            statut === 'crise' ? `🚨 Alerte urgente — ${a.p_prenom} ${a.p_nom}` : `⚠️ Alerte — ${a.p_prenom} ${a.p_nom}`,
            `${a.p_prenom} ${a.p_nom} a une tension critique. Veuillez le/la contacter.`,
          ]
        );
      }
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e
        ? String((e as { code: string }).code) : '';
      if (code !== 'ER_NO_SUCH_TABLE') throw e;
    }
  },

  async resoudreAlerte(
    alerte_id: number,
    user_id: number,
    role: string
  ): Promise<boolean> {
    const query = role === 'administrateur'
      ? `UPDATE alertes_tension SET resolu = TRUE WHERE id = ? AND resolu = FALSE`
      : `UPDATE alertes_tension a
         JOIN profils_patients pp ON pp.utilisateur_id = a.patient_id
         SET a.resolu = TRUE
         WHERE a.id = ? AND a.resolu = FALSE AND pp.medecin_id = ?`;

    const params = role === 'administrateur'
      ? [alerte_id]
      : [alerte_id, user_id];

    const [result] = await pool.execute<ResultSetHeader>(query, params);
    return result.affectedRows > 0;
  },
};

export default MesureModel;