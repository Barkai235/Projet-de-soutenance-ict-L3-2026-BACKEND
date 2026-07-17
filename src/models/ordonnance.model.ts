import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

export interface Ordonnance extends RowDataPacket {
  id:              number;
  uuid:            string;
  patient_id:      number;
  medecin_id:      number;
  date_emission:   string;
  date_expiration: string;
  instructions:    string;
  statut:          string;
  created_at:      string;
  patient_nom:     string;
  patient_prenom:  string;
  medecin_nom:     string;
  medecin_prenom:  string;
}

export interface LigneOrdonnance extends RowDataPacket {
  id:             number;
  ordonnance_id:  number;
  medicament_id:  number;
  medicament_nom: string;
  dci:            string;
  classe:         string;
  dose:           string;
  frequence:      string;
  duree:          string;
  instructions:   string;
}

export interface CreateOrdonnanceDTO {
  patient_id:      number;
  medecin_id:      number;
  date_emission:   string;
  date_expiration?: string;
  instructions?:   string;
  lignes: {
    medicament_id: number;
    dose?:         string;
    frequence?:    string;
    duree?:        string;
    instructions?: string;
  }[];
}

const OrdonnanceModel = {

  async create(data: CreateOrdonnanceDTO): Promise<number> {
    const uuid = uuidv4();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ordonnances
         (uuid, patient_id, medecin_id, date_emission, date_expiration, instructions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        data.patient_id,
        data.medecin_id,
        data.date_emission,
        data.date_expiration ?? null,
        data.instructions    ?? null,
      ]
    );
    const ordonnanceId = result.insertId;

    // Insérer les lignes
    for (const ligne of data.lignes) {
      await pool.execute(
        `INSERT INTO ordonnances_medicaments
           (ordonnance_id, medicament_id, dose, frequence, duree, instructions)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ordonnanceId,
          ligne.medicament_id,
          ligne.dose         ?? null,
          ligne.frequence    ?? null,
          ligne.duree        ?? null,
          ligne.instructions ?? null,
        ]
      );
    }
    return ordonnanceId;
  },

  async findById(id: number): Promise<Ordonnance | null> {
    const [rows] = await pool.execute<Ordonnance[]>(
      `SELECT o.*,
              p.nom    AS patient_nom,   p.prenom AS patient_prenom,
              m.nom    AS medecin_nom,   m.prenom AS medecin_prenom
       FROM ordonnances o
       JOIN utilisateurs p ON o.patient_id  = p.id
       JOIN utilisateurs m ON o.medecin_id  = m.id
       WHERE o.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async getLignes(ordonnance_id: number): Promise<LigneOrdonnance[]> {
    const [rows] = await pool.execute<LigneOrdonnance[]>(
      `SELECT om.*, med.nom AS medicament_nom, med.dci, med.classe
       FROM ordonnances_medicaments om
       JOIN medicaments med ON om.medicament_id = med.id
       WHERE om.ordonnance_id = ?`,
      [ordonnance_id]
    );
    return rows;
  },

  async findByPatient(patient_id: number): Promise<Ordonnance[]> {
    const [rows] = await pool.execute<Ordonnance[]>(
      `SELECT o.*,
              m.nom    AS medecin_nom,
              m.prenom AS medecin_prenom
       FROM ordonnances o
       JOIN utilisateurs m ON o.medecin_id = m.id
       WHERE o.patient_id = ?
       ORDER BY o.date_emission DESC`,
      [patient_id]
    );
    return rows;
  },

  async findByMedecin(medecin_id: number): Promise<Ordonnance[]> {
    const [rows] = await pool.execute<Ordonnance[]>(
      `SELECT o.*,
              p.nom    AS patient_nom,
              p.prenom AS patient_prenom
       FROM ordonnances o
       JOIN utilisateurs p ON o.patient_id = p.id
       WHERE o.medecin_id = ?
       ORDER BY o.date_emission DESC`,
      [medecin_id]
    );
    return rows;
  },

  async findActives(): Promise<Ordonnance[]> {
    const [rows] = await pool.execute<Ordonnance[]>(
      `SELECT o.*,
              p.nom    AS patient_nom,
              p.prenom AS patient_prenom,
              m.nom    AS medecin_nom,
              m.prenom AS medecin_prenom
       FROM ordonnances o
       JOIN utilisateurs p ON o.patient_id  = p.id
       JOIN utilisateurs m ON o.medecin_id  = m.id
       WHERE o.statut = 'active'
       ORDER BY o.date_emission DESC`
    );
    return rows;
  },

  async updateStatut(id: number, statut: string): Promise<void> {
    await pool.execute(
      `UPDATE ordonnances SET statut = ? WHERE id = ?`,
      [statut, id]
    );
  },

  async deleteForPatient(id: number, patient_id: number): Promise<boolean> {
    const o = await OrdonnanceModel.findById(id);
    if (!o || o.patient_id !== patient_id) return false;
    await pool.execute(
      'UPDATE rappels_medicaments SET ordonnance_id = NULL WHERE ordonnance_id = ?',
      [id]
    );
    await pool.execute(
      'DELETE FROM ordonnances_medicaments WHERE ordonnance_id = ?',
      [id]
    );
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM ordonnances WHERE id = ? AND patient_id = ?',
      [id, patient_id]
    );
    return result.affectedRows > 0;
  },

  async deleteAllForPatient(patient_id: number): Promise<number> {
    const rows = await OrdonnanceModel.findByPatient(patient_id);
    let n = 0;
    for (const o of rows) {
      if (await OrdonnanceModel.deleteForPatient(o.id, patient_id)) n += 1;
    }
    return n;
  },
};

export default OrdonnanceModel;