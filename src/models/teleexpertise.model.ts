import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface TeleExpertise extends RowDataPacket {
  id:               number;
  patient_id:       number;
  medecin_id:       number;
  cardiologue_id:   number | null;
  motif:            string;
  statut:           'demande' | 'en_cours' | 'cloturee';
  avis_cardiologue: string | null;
  created_at:       string;
  // joins
  patient_nom:       string;
  patient_prenom:    string;
  medecin_nom:       string;
  medecin_prenom:    string;
  cardiologue_nom?:  string;
  cardiologue_prenom?:string;
}

const TeleExpertiseModel = {

  async create(data: {
    patient_id:  number;
    medecin_id:  number;
    motif:       string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO tele_expertises
         (patient_id, medecin_id, motif)
       VALUES (?, ?, ?)`,
      [data.patient_id, data.medecin_id, data.motif]
    );
    return result.insertId;
  },

  async findById(id: number): Promise<TeleExpertise | null> {
    const [rows] = await pool.execute<TeleExpertise[]>(
      `SELECT te.*,
              p.nom    AS patient_nom,   p.prenom AS patient_prenom,
              m.nom    AS medecin_nom,   m.prenom AS medecin_prenom,
              c.nom    AS cardiologue_nom, c.prenom AS cardiologue_prenom
       FROM tele_expertises te
       JOIN utilisateurs p ON te.patient_id    = p.id
       JOIN utilisateurs m ON te.medecin_id    = m.id
       LEFT JOIN utilisateurs c ON te.cardiologue_id = c.id
       WHERE te.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async findByMedecin(medecin_id: number): Promise<TeleExpertise[]> {
    const [rows] = await pool.execute<TeleExpertise[]>(
      `SELECT te.*,
              p.nom    AS patient_nom,   p.prenom AS patient_prenom,
              c.nom    AS cardiologue_nom, c.prenom AS cardiologue_prenom
       FROM tele_expertises te
       JOIN utilisateurs p ON te.patient_id = p.id
       LEFT JOIN utilisateurs c ON te.cardiologue_id = c.id
       WHERE te.medecin_id = ?
       ORDER BY te.created_at DESC`,
      [medecin_id]
    );
    return rows;
  },

  async findByCardiologue(cardiologue_id: number): Promise<TeleExpertise[]> {
    const [rows] = await pool.execute<TeleExpertise[]>(
      `SELECT te.*,
              p.nom    AS patient_nom,   p.prenom AS patient_prenom,
              m.nom    AS medecin_nom,   m.prenom AS medecin_prenom
       FROM tele_expertises te
       JOIN utilisateurs p ON te.patient_id = p.id
       JOIN utilisateurs m ON te.medecin_id = m.id
       WHERE te.cardiologue_id = ?
       ORDER BY te.created_at DESC`,
      [cardiologue_id]
    );
    return rows;
  },

  async inviterCardiologue(
    id:            number,
    cardiologue_id:number
  ): Promise<void> {
    await pool.execute(
      `UPDATE tele_expertises
       SET cardiologue_id = ?, statut = 'en_cours'
       WHERE id = ?`,
      [cardiologue_id, id]
    );
  },

  async donnerAvis(
    id:   number,
    avis: string
  ): Promise<void> {
    await pool.execute(
      `UPDATE tele_expertises
       SET avis_cardiologue = ?, statut = 'cloturee'
       WHERE id = ?`,
      [avis, id]
    );
  },

  async getCardiologues(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.nom, u.prenom, u.email,
              pc.specialite, pc.hopital
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
       WHERE r.nom = 'cardiologue' AND u.est_actif = TRUE
       ORDER BY u.nom ASC`
    );
    return rows;
  },
};

export default TeleExpertiseModel;