import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Message extends RowDataPacket {
  id:               number;
  expediteur_id:    number;
  destinataire_id:  number;
  contenu:          string;
  est_lu:           boolean;
  piece_jointe:     string | null;
  created_at:       string;
  // joins
  expediteur_nom:    string;
  expediteur_prenom: string;
  expediteur_photo:  string;
  destinataire_nom:    string;
  destinataire_prenom: string;
  destinataire_photo:  string;
}

export interface Conversation extends RowDataPacket {
  interlocuteur_id:     number;
  interlocuteur_nom:    string;
  interlocuteur_prenom: string;
  interlocuteur_photo:  string;
  interlocuteur_role:   string;
  dernier_message:      string;
  derniere_date:        string;
  non_lus:              number;
}

const MessageModel = {

  async envoyer(data: {
    expediteur_id:   number;
    destinataire_id: number;
    contenu:         string;
    piece_jointe?:   string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO messages
         (expediteur_id, destinataire_id, contenu, piece_jointe)
       VALUES (?, ?, ?, ?)`,
      [
        data.expediteur_id,
        data.destinataire_id,
        data.contenu,
        data.piece_jointe ?? null,
      ]
    );
    return result.insertId;
  },

  async getConversation(
    userId: number,
    interlocuteurId: number,
    limit = 50
  ): Promise<Message[]> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const [rows] = await pool.execute<Message[]>(
      `SELECT m.*,
              e.nom    AS expediteur_nom,
              e.prenom AS expediteur_prenom,
              e.photo_profil AS expediteur_photo,
              d.nom    AS destinataire_nom,
              d.prenom AS destinataire_prenom,
              d.photo_profil AS destinataire_photo
       FROM messages m
       JOIN utilisateurs e ON m.expediteur_id   = e.id
       JOIN utilisateurs d ON m.destinataire_id = d.id
       WHERE (m.expediteur_id = ? AND m.destinataire_id = ?)
          OR (m.expediteur_id = ? AND m.destinataire_id = ?)
       ORDER BY m.created_at ASC
       LIMIT ${safeLimit}`,
      [userId, interlocuteurId, interlocuteurId, userId]
    );
    return rows;
  },

  async getConversations(userId: number): Promise<Conversation[]> {
    const [rows] = await pool.execute<Conversation[]>(
      `SELECT
         interlocuteur.id     AS interlocuteur_id,
         interlocuteur.nom    AS interlocuteur_nom,
         interlocuteur.prenom AS interlocuteur_prenom,
         interlocuteur.photo_profil AS interlocuteur_photo,
         r.nom                AS interlocuteur_role,
         dernierMsg.contenu   AS dernier_message,
         dernierMsg.created_at AS derniere_date,
         COUNT(CASE WHEN m2.est_lu = FALSE
               AND m2.destinataire_id = ? THEN 1 END) AS non_lus
       FROM messages m
       JOIN utilisateurs interlocuteur ON (
         interlocuteur.id = CASE
           WHEN m.expediteur_id = ? THEN m.destinataire_id
           ELSE m.expediteur_id
         END
       )
       JOIN roles r ON interlocuteur.role_id = r.id
       JOIN messages dernierMsg ON dernierMsg.id = (
         SELECT id FROM messages
         WHERE (expediteur_id = ? AND destinataire_id = interlocuteur.id)
            OR (expediteur_id = interlocuteur.id AND destinataire_id = ?)
         ORDER BY created_at DESC LIMIT 1
       )
       LEFT JOIN messages m2 ON (
         (m2.expediteur_id = interlocuteur.id AND m2.destinataire_id = ?)
       )
       WHERE m.expediteur_id = ? OR m.destinataire_id = ?
       GROUP BY interlocuteur.id, interlocuteur.nom, interlocuteur.prenom,
                interlocuteur.photo_profil, r.nom,
                dernierMsg.contenu, dernierMsg.created_at
       ORDER BY dernierMsg.created_at DESC`,
      [userId, userId, userId, userId, userId, userId, userId]
    );
    return rows;
  },

  async marquerLus(
    expediteur_id:   number,
    destinataire_id: number
  ): Promise<void> {
    await pool.execute(
      `UPDATE messages
       SET est_lu = TRUE
       WHERE expediteur_id = ?
         AND destinataire_id = ?
         AND est_lu = FALSE`,
      [expediteur_id, destinataire_id]
    );
  },

  async countNonLus(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM messages
       WHERE destinataire_id = ? AND est_lu = FALSE`,
      [userId]
    );
    return rows[0].total;
  },

  /** Messages non lus dont l'expéditeur fait partie des interlocuteurs autorisés. */
  async countNonLusDepuisExpediteurs(
    destinataireId: number,
    expediteurIds: number[]
  ): Promise<number> {
    if (expediteurIds.length === 0) return 0;
    const ph = expediteurIds.map(() => '?').join(',');
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM messages
       WHERE destinataire_id = ?
         AND est_lu = FALSE
         AND expediteur_id IN (${ph})`,
      [destinataireId, ...expediteurIds]
    );
    return Number(rows[0]?.total ?? 0);
  },

  async findById(id: number): Promise<Message | null> {
    const [rows] = await pool.execute<Message[]>(
      `SELECT m.*,
              e.nom    AS expediteur_nom,
              e.prenom AS expediteur_prenom,
              d.nom    AS destinataire_nom,
              d.prenom AS destinataire_prenom
       FROM messages m
       JOIN utilisateurs e ON m.expediteur_id   = e.id
       JOIN utilisateurs d ON m.destinataire_id = d.id
       WHERE m.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async supprimerMessage(id: number, userId: number): Promise<boolean> {
    const m = await MessageModel.findById(id);
    if (!m || (m.expediteur_id !== userId && m.destinataire_id !== userId)) return false;
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM messages WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  async supprimerFil(userId: number, interlocuteurId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM messages
       WHERE (expediteur_id = ? AND destinataire_id = ?)
          OR (expediteur_id = ? AND destinataire_id = ?)`,
      [userId, interlocuteurId, interlocuteurId, userId]
    );
    return result.affectedRows;
  },

  async supprimerToutPourUtilisateur(userId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM messages
       WHERE expediteur_id = ? OR destinataire_id = ?`,
      [userId, userId]
    );
    return result.affectedRows;
  },
};

export default MessageModel;