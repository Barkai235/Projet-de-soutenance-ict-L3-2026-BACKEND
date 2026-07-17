import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface RendezVous extends RowDataPacket {
  /* téléphones renseignés par les jointures (voir lister* / findById) */
  id:              number;
  patient_id:      number;
  medecin_id:      number;
  patient_nom:     string;
  patient_prenom:  string;
  medecin_nom:     string;
  medecin_prenom:  string;
  specialite:      string;
  date_rdv:        string;
  statut:          'confirme' | 'en_attente' | 'annule' | 'termine';
  type:            'video' | 'telephonique' | 'cabinet';
  motif:           string;
  lien_video:      string | null;
  compte_rendu:    string | null;
  created_at:      string;
  patient_telephone?:  string | null;
  medecin_telephone?: string | null;
}

export interface CreateRdvDTO {
  patient_id:  number;
  medecin_id:  number;
  date_rdv:    string;
  type:        'video' | 'cabinet';
  motif:       string;
}

const TelemedicineModel = {

  async creer(data: CreateRdvDTO): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO rendez_vous (patient_id, medecin_id, date_rdv, type, motif, statut)
       VALUES (?, ?, ?, ?, ?, 'en_attente')`,
      [data.patient_id, data.medecin_id, data.date_rdv, data.type, data.motif]
    );
    return result.insertId;
  },

  async findById(id: number): Promise<RendezVous | null> {
    const [rows] = await pool.execute<RendezVous[]>(
      `SELECT rv.*,
              p.nom    AS patient_nom,   p.prenom AS patient_prenom,
              p.telephone AS patient_telephone,
              m.nom    AS medecin_nom,   m.prenom AS medecin_prenom,
              m.telephone AS medecin_telephone
       FROM rendez_vous rv
       JOIN utilisateurs p  ON p.id = rv.patient_id
       JOIN utilisateurs m  ON m.id = rv.medecin_id
       WHERE rv.id = ?`,
      [id]
    );
    return rows[0] ?? null;
  },

  async listerParPatient(patient_id: number): Promise<RendezVous[]> {
    const [rows] = await pool.execute<RendezVous[]>(
      `SELECT rv.*,
              p.nom    AS patient_nom,   p.prenom AS patient_prenom,
              p.telephone AS patient_telephone,
              m.nom    AS medecin_nom,   m.prenom AS medecin_prenom,
              m.telephone AS medecin_telephone
       FROM rendez_vous rv
       JOIN utilisateurs p  ON p.id = rv.patient_id
       JOIN utilisateurs m  ON m.id = rv.medecin_id
       WHERE rv.patient_id = ?
       ORDER BY rv.date_rdv DESC`,
      [patient_id]
    );
    return rows;
  },

  /** Compteur léger pour badges / barre de navigation (évite de charger toute la liste RDV). */
  async countEnAttenteParPatient(patient_id: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS n
       FROM rendez_vous
       WHERE patient_id = ? AND statut = 'en_attente'`,
      [patient_id]
    );
    return Number(rows[0]?.n) || 0;
  },

  async listerParMedecin(medecin_id: number): Promise<RendezVous[]> {
    const [rows] = await pool.execute<RendezVous[]>(
      `SELECT rv.*,
              p.nom    AS patient_nom,   p.prenom AS patient_prenom,
              p.telephone AS patient_telephone,
              m.nom    AS medecin_nom,   m.prenom AS medecin_prenom,
              m.telephone AS medecin_telephone
       FROM rendez_vous rv
       JOIN utilisateurs p  ON p.id = rv.patient_id
       JOIN utilisateurs m  ON m.id = rv.medecin_id
       WHERE rv.medecin_id = ?
       ORDER BY rv.date_rdv DESC`,
      [medecin_id]
    );
    return rows;
  },

  async changerStatut(id: number, statut: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE rendez_vous SET statut = ? WHERE id = ?',
      [statut, id]
    );
    return result.affectedRows > 0;
  },

  async annuler(id: number, user_id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE rendez_vous SET statut = 'annule'
       WHERE id = ? AND (patient_id = ? OR medecin_id = ?)
         AND statut IN ('confirme','en_attente')`,
      [id, user_id, user_id]
    );
    return result.affectedRows > 0;
  },

  /** Retire un RDV de l'historique (suppression BDD). Patient : en_attente, annulé, terminé. Cardiologue : annulé, terminé uniquement. Jamais un RDV confirmé à venir. */
  async supprimerHistorique(id: number, user_id: number, role: string): Promise<boolean> {
    const rdv = await TelemedicineModel.findById(id);
    if (!rdv) return false;
    const isPatient = rdv.patient_id === user_id;
    const isMed     = rdv.medecin_id === user_id;
    if (!isPatient && !isMed) return false;
    if (rdv.statut === 'confirme') return false;
    if (rdv.statut === 'en_attente' && role !== 'patient') return false;

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM rendez_vous WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  async supprimerToutHistorique(user_id: number, role: string): Promise<number> {
    if (role === 'patient') {
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM rendez_vous
         WHERE patient_id = ?
           AND statut IN ('en_attente','annule','termine')`,
        [user_id]
      );
      return result.affectedRows;
    }
    if (role === 'cardiologue') {
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM rendez_vous
         WHERE medecin_id = ?
           AND statut IN ('annule','termine')`,
        [user_id]
      );
      return result.affectedRows;
    }
    return 0;
  },

  async sauvegarderLienVideo(id: number, lien_video: string): Promise<void> {
    await pool.execute(
      'UPDATE rendez_vous SET lien_video = ? WHERE id = ?',
      [lien_video, id]
    );
  },

  async terminer(id: number, medecin_id: number, compte_rendu?: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE rendez_vous SET statut = 'termine', compte_rendu = ?
       WHERE id = ? AND medecin_id = ? AND statut = 'confirme'`,
      [compte_rendu ?? null, id, medecin_id]
    );
    return result.affectedRows > 0;
  },

  // Pour le scheduler : RDV dans les 10 prochaines minutes
  async listerImminents(): Promise<RendezVous[]> {
    const [rows] = await pool.execute<RendezVous[]>(
      `SELECT rv.*,
              p.nom AS patient_nom, p.prenom AS patient_prenom,
              m.nom AS medecin_nom, m.prenom AS medecin_prenom
       FROM rendez_vous rv
       JOIN utilisateurs p ON p.id = rv.patient_id
       JOIN utilisateurs m ON m.id = rv.medecin_id
       WHERE rv.statut = 'confirme'
         AND rv.date_rdv BETWEEN DATE_ADD(NOW(), INTERVAL 29 MINUTE) AND DATE_ADD(NOW(), INTERVAL 31 MINUTE)
         AND rv.date_rdv > NOW()`,
      []
    );
    return rows;
  },
};

export default TelemedicineModel;
