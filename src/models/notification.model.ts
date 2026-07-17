import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Notification extends RowDataPacket {
  id:             number;
  utilisateur_id: number;
  titre:          string;
  contenu:        string;
  type:           'alerte' | 'rappel' | 'message' | 'info' | 'critique';
  est_lu:         boolean;
  lien:           string | null;
  created_at:     string;
}

const NotificationModel = {

  async creer(data: {
    utilisateur_id: number;
    titre:          string;
    contenu?:       string;
    type?:          string;
    lien?:          string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO notifications
         (utilisateur_id, titre, contenu, type, lien)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.utilisateur_id,
        data.titre,
        data.contenu  ?? null,
        data.type     ?? 'info',
        data.lien     ?? null,
      ]
    );
    return result.insertId;
  },

  async findByUser(
    utilisateur_id: number,
    limit = 30
  ): Promise<Notification[]> {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
    const [rows] = await pool.execute<Notification[]>(
      `SELECT * FROM notifications
       WHERE utilisateur_id = ?
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
      [utilisateur_id]
    );
    return rows;
  },

  async marquerLue(id: number, utilisateur_id: number): Promise<void> {
    await pool.execute(
      `UPDATE notifications
       SET est_lu = TRUE
       WHERE id = ? AND utilisateur_id = ?`,
      [id, utilisateur_id]
    );
  },

  async toutMarquerLues(utilisateur_id: number): Promise<void> {
    await pool.execute(
      `UPDATE notifications
       SET est_lu = TRUE
       WHERE utilisateur_id = ?`,
      [utilisateur_id]
    );
  },

  async countNonLues(utilisateur_id: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE utilisateur_id = ? AND est_lu = FALSE AND type != 'message'`,
      [utilisateur_id]
    );
    return rows[0].total;
  },

  /** Compteurs non lus par onglet de navigation (chaque notification comptée une fois). */
  async countNonLuesParOnglet(utilisateur_id: number): Promise<{
    mesures: number;
    rappels: number;
    ordonnances: number;
    rendez_vous: number;
    demandes: number;
    patients: number;
    accueil: number;
  }> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN cat = 'mesures'     THEN 1 ELSE 0 END), 0) AS mesures,
         COALESCE(SUM(CASE WHEN cat = 'rappels'     THEN 1 ELSE 0 END), 0) AS rappels,
         COALESCE(SUM(CASE WHEN cat = 'ordonnances' THEN 1 ELSE 0 END), 0) AS ordonnances,
         COALESCE(SUM(CASE WHEN cat = 'rendez_vous' THEN 1 ELSE 0 END), 0) AS rendez_vous,
         COALESCE(SUM(CASE WHEN cat = 'demandes'    THEN 1 ELSE 0 END), 0) AS demandes,
         COALESCE(SUM(CASE WHEN cat = 'patients'    THEN 1 ELSE 0 END), 0) AS patients,
         COALESCE(SUM(CASE WHEN cat = 'accueil'     THEN 1 ELSE 0 END), 0) AS accueil
       FROM (
         SELECT
           CASE
             WHEN est_lu = TRUE THEN NULL
             WHEN type = 'message' THEN 'skip'
             WHEN COALESCE(lien, '') LIKE '%ordonnance%' THEN 'ordonnances'
             WHEN COALESCE(lien, '') LIKE '%rendez-vous%' THEN 'rendez_vous'
             WHEN COALESCE(lien, '') LIKE '%demande%' THEN 'demandes'
             WHEN COALESCE(lien, '') LIKE '%patients%' THEN 'patients'
             WHEN type = 'rappel' THEN 'rappels'
             WHEN type IN ('critique', 'alerte') THEN 'mesures'
             ELSE 'accueil'
           END AS cat
         FROM notifications
         WHERE utilisateur_id = ?
       ) t
       WHERE cat IS NOT NULL AND cat != 'skip'`,
      [utilisateur_id]
    );
    const r = rows[0] ?? {};
    return {
      mesures:     Number(r.mesures)     || 0,
      rappels:     Number(r.rappels)     || 0,
      ordonnances: Number(r.ordonnances) || 0,
      rendez_vous: Number(r.rendez_vous) || 0,
      demandes:    Number(r.demandes)    || 0,
      patients:    Number(r.patients)    || 0,
      accueil:     Number(r.accueil)     || 0,
    };
  },

  async supprimer(id: number, utilisateur_id: number): Promise<void> {
    await pool.execute(
      `DELETE FROM notifications
       WHERE id = ? AND utilisateur_id = ?`,
      [id, utilisateur_id]
    );
  },

  async toutSupprimer(utilisateur_id: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM notifications WHERE utilisateur_id = ?`,
      [utilisateur_id]
    );
    return result.affectedRows;
  },

  /**
   * Marque comme lues les notifications comptées dans `countNonLuesParOnglet` pour une section donnée
   * (visite d’un onglet = considérer les alertes de cette rubrique comme vues).
   */
  async marquerLuesParSection(
    utilisateur_id: number,
    section: string
  ): Promise<number> {
    let extra = '';
    switch (section) {
      case 'mesures':
        extra = `type IN ('critique', 'alerte')`;
        break;
      case 'ordonnances':
        extra = `COALESCE(lien,'') LIKE '%ordonnance%'`;
        break;
      case 'rendez_vous':
        extra = `COALESCE(lien,'') LIKE '%rendez-vous%'`;
        break;
      case 'demandes':
        extra = `COALESCE(lien,'') LIKE '%demande%'`;
        break;
      case 'patients':
        extra = `COALESCE(lien,'') LIKE '%patients%'`;
        break;
      case 'rappels':
        extra = `type = 'rappel'`;
        break;
      case 'accueil':
        extra = `type NOT IN ('critique', 'alerte', 'rappel')
          AND COALESCE(lien,'') NOT LIKE '%ordonnance%'
          AND COALESCE(lien,'') NOT LIKE '%rendez-vous%'
          AND COALESCE(lien,'') NOT LIKE '%demande%'
          AND COALESCE(lien,'') NOT LIKE '%patients%'`;
        break;
      default:
        return 0;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notifications SET est_lu = TRUE
       WHERE utilisateur_id = ? AND est_lu = FALSE AND type != 'message'
       AND (${extra})`,
      [utilisateur_id]
    );
    return result.affectedRows;
  },
};

export default NotificationModel;