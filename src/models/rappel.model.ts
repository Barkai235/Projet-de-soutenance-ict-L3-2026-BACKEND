import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Rappel extends RowDataPacket {
  id:             number;
  patient_id:     number;
  medicament_id:  number;
  ordonnance_id:  number | null;
  heure_rappel:   string;
  jours_semaine:  string;
  est_actif:      boolean;
  created_at:     string;
  medicament_nom: string;
  dci:            string;
  classe:         string;
  dosage:         string;
}

export interface Prise extends RowDataPacket {
  id:             number;
  rappel_id:      number;
  patient_id:     number;
  date_prise:     string;
  statut:         string;
  medicament_nom: string;
  heure_rappel:   string;
}

export interface CreateRappelDTO {
  patient_id:    number;
  medicament_id: number;
  ordonnance_id?: number;
  heure_rappel:  string;
  jours_semaine?: string;
}

const RappelModel = {

  async create(data: CreateRappelDTO): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO rappels_medicaments
         (patient_id, medicament_id, ordonnance_id, heure_rappel, jours_semaine)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.patient_id,
        data.medicament_id,
        data.ordonnance_id ?? null,
        data.heure_rappel,
        data.jours_semaine ?? '1,2,3,4,5,6,7', // tous les jours par défaut
      ]
    );
    return result.insertId;
  },

  async findByPatient(patient_id: number): Promise<Rappel[]> {
    const [rows] = await pool.execute<Rappel[]>(
      `SELECT r.*,
              m.nom    AS medicament_nom,
              m.dci,
              m.classe,
              m.dosage
       FROM rappels_medicaments r
       JOIN medicaments m ON r.medicament_id = m.id
       WHERE r.patient_id = ?
       ORDER BY r.heure_rappel ASC`,
      [patient_id]
    );
    return rows;
  },

  async findById(id: number): Promise<Rappel | null> {
    const [rows] = await pool.execute<Rappel[]>(
      `SELECT r.*, m.nom AS medicament_nom, m.dci, m.classe, m.dosage
       FROM rappels_medicaments r
       JOIN medicaments m ON r.medicament_id = m.id
       WHERE r.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async toggleActif(id: number, patient_id: number): Promise<boolean> {
    const rappel = await RappelModel.findById(id);
    if (!rappel) return false;
    const nouvelEtat = !rappel.est_actif;
    await pool.execute(
      `UPDATE rappels_medicaments
       SET est_actif = ?
       WHERE id = ? AND patient_id = ?`,
      [nouvelEtat, id, patient_id]
    );
    return nouvelEtat;
  },

  async delete(id: number, patient_id: number): Promise<boolean> {
    await pool.execute(
      `DELETE pm FROM prises_medicaments pm
       INNER JOIN rappels_medicaments r ON pm.rappel_id = r.id
       WHERE r.id = ? AND r.patient_id = ?`,
      [id, patient_id]
    );
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM rappels_medicaments
       WHERE id = ? AND patient_id = ?`,
      [id, patient_id]
    );
    return result.affectedRows > 0;
  },

  async deleteAllByPatient(patient_id: number): Promise<{ rappels: number }> {
    await pool.execute(
      `DELETE pm FROM prises_medicaments pm
       INNER JOIN rappels_medicaments r ON pm.rappel_id = r.id
       WHERE r.patient_id = ?`,
      [patient_id]
    );
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM rappels_medicaments WHERE patient_id = ?`,
      [patient_id]
    );
    return { rappels: result.affectedRows };
  },

  // Journal des prises
  async enregistrerPrise(data: {
    rappel_id:  number;
    patient_id: number;
    date_prise: string;
    statut:     'pris' | 'oublie' | 'reporte';
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO prises_medicaments
         (rappel_id, patient_id, date_prise, statut)
       VALUES (?, ?, ?, ?)`,
      [data.rappel_id, data.patient_id, data.date_prise, data.statut]
    );
    return result.insertId;
  },

  async getPrises(patient_id: number, jours = 7): Promise<Prise[]> {
    const [rows] = await pool.execute<Prise[]>(
      `SELECT pm.*,
              m.nom AS medicament_nom,
              r.heure_rappel
       FROM prises_medicaments pm
       JOIN rappels_medicaments r ON pm.rappel_id   = r.id
       JOIN medicaments         m ON r.medicament_id = m.id
       WHERE pm.patient_id = ?
         AND pm.date_prise >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY pm.date_prise DESC`,
      [patient_id, jours]
    );
    return rows;
  },

  async getStatsPrises(patient_id: number): Promise<RowDataPacket> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*)                                          AS total,
         SUM(statut = 'pris')                             AS prises,
         SUM(statut = 'oublie')                           AS oublies,
         ROUND(SUM(statut='pris') / COUNT(*) * 100, 1)   AS taux_observance
       FROM prises_medicaments
       WHERE patient_id = ?
         AND date_prise >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [patient_id]
    );
    return rows[0];
  },
};

export default RappelModel;