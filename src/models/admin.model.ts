import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface UtilisateurAdmin extends RowDataPacket {
  id:                 number;
  uuid:               string;
  nom:                string;
  prenom:             string;
  email:              string;
  telephone:          string;
  role_nom:           string;
  role_id:            number;
  est_actif:          boolean;
  email_verifie:      boolean;
  derniere_connexion: string;
  created_at:         string;
  // stats
  nb_mesures:         number;
  nb_messages:        number;
  medecin_nom?:       string;
  medecin_prenom?:    string;
}

export interface AlerteAdmin extends RowDataPacket {
  id:             number;
  patient_id:     number;
  patient_nom:    string;
  patient_prenom: string;
  type_alerte:    string;
  niveau:         string;
  notifie:        boolean;
  resolu:         boolean;
  created_at:     string;
  systolique:     number;
  diastolique:    number;
  date_mesure:    string;
  medecin_nom?:   string;
  medecin_prenom?:string;
}

const AdminModel = {

  /* ── UTILISATEURS ──────────────────────────────── */

  async getAllUsers(
    role?:    string,
    search?:  string,
    actif?:   boolean,
    limit  = 50,
    offset = 0
  ): Promise<UtilisateurAdmin[]> {
    let query = `
      SELECT
        u.id, u.uuid, u.nom, u.prenom, u.email, u.telephone,
        u.est_actif, u.email_verifie,
        u.derniere_connexion, u.created_at,
        r.nom  AS role_nom,
        r.id   AS role_id,
        (SELECT COUNT(*) FROM mesures_tension
         WHERE patient_id = u.id) AS nb_mesures,
        (SELECT COUNT(*) FROM messages
         WHERE expediteur_id = u.id) AS nb_messages,
        med.nom    AS medecin_nom,
        med.prenom AS medecin_prenom
      FROM utilisateurs u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN profils_patients pp ON pp.utilisateur_id = u.id
      LEFT JOIN utilisateurs med ON pp.medecin_id = med.id
      WHERE 1=1
    `;
    const params: (string | number | boolean)[] = [];

    if (role) {
      query += ' AND r.nom = ?';
      params.push(role);
    }
    if (search) {
      query += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (actif !== undefined) {
      query += ' AND u.est_actif = ?';
      params.push(actif);
    }

    query += ` ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await pool.execute<UtilisateurAdmin[]>(query, params);
    return rows;
  },

  async countUsers(
    role?:   string,
    search?: string,
    actif?:  boolean
  ): Promise<number> {
    let query = `
      SELECT COUNT(*) AS total
      FROM utilisateurs u
      JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const params: (string | boolean)[] = [];

    if (role)   { query += ' AND r.nom = ?'; params.push(role); }
    if (search) {
      query += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (actif !== undefined) { query += ' AND u.est_actif = ?'; params.push(actif); }

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return rows[0].total;
  },

  async toggleActif(userId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT est_actif FROM utilisateurs WHERE id = ?', [userId]
    );
    if (!rows[0]) throw new Error('Utilisateur introuvable');
    const nouvelEtat = !rows[0].est_actif;
    await pool.execute(
      'UPDATE utilisateurs SET est_actif = ? WHERE id = ?',
      [nouvelEtat, userId]
    );
    return nouvelEtat;
  },

  async deleteUser(userId: number): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Prises de médicaments (dépend de rappels_medicaments)
      await conn.execute(
        `DELETE pm FROM prises_medicaments pm
         JOIN rappels_medicaments r ON pm.rappel_id = r.id
         WHERE r.patient_id = ?`,
        [userId]
      );

      // 2. Rappels médicaments
      await conn.execute('DELETE FROM rappels_medicaments WHERE patient_id = ?', [userId]);

      // 3. Lignes d'ordonnances (dépend de ordonnances)
      await conn.execute(
        `DELETE om FROM ordonnances_medicaments om
         JOIN ordonnances o ON om.ordonnance_id = o.id
         WHERE o.patient_id = ? OR o.medecin_id = ?`,
        [userId, userId]
      );

      // 4. Ordonnances
      await conn.execute(
        'DELETE FROM ordonnances WHERE patient_id = ? OR medecin_id = ?',
        [userId, userId]
      );

      // 5. Alertes tension (dépend de mesures_tension)
      await conn.execute('DELETE FROM alertes_tension WHERE patient_id = ?', [userId]);

      // 6. Mesures tension
      await conn.execute(
        'DELETE FROM mesures_tension WHERE patient_id = ? OR prise_par = ?',
        [userId, userId]
      );

      // 7. Télé-expertises (table absente si migration_suppression_roles a été appliquée)
      try {
        await conn.execute(
          'DELETE FROM tele_expertises WHERE patient_id = ? OR medecin_id = ? OR cardiologue_id = ?',
          [userId, userId, userId]
        );
      } catch (e: unknown) {
        const code = e && typeof e === 'object' && 'code' in e
          ? String((e as { code: string }).code) : '';
        if (code !== 'ER_NO_SUCH_TABLE') throw e;
      }

      // 8. Messages
      await conn.execute(
        'DELETE FROM messages WHERE expediteur_id = ? OR destinataire_id = ?',
        [userId, userId]
      );

      // 9. Notifications
      await conn.execute('DELETE FROM notifications WHERE utilisateur_id = ?', [userId]);

      // 10. Liens aidants (table optionnelle)
      try {
        await conn.execute(
          'DELETE FROM aidants WHERE patient_id = ? OR aidant_id = ?',
          [userId, userId]
        );
      } catch (e: unknown) {
        const code = e && typeof e === 'object' && 'code' in e
          ? String((e as { code: string }).code) : '';
        if (code !== 'ER_NO_SUCH_TABLE') throw e;
      }

      // 11. Dé-assigner ce médecin de ses patients (sans supprimer le patient)
      await conn.execute(
        'UPDATE profils_patients SET medecin_id = NULL WHERE medecin_id = ?',
        [userId]
      );

      // 12. Profil patient
      await conn.execute('DELETE FROM profils_patients WHERE utilisateur_id = ?', [userId]);

      // 13. Profil médecin (table optionnelle)
      try {
        await conn.execute('DELETE FROM profils_medecins WHERE utilisateur_id = ?', [userId]);
      } catch (e: unknown) {
        const code = e && typeof e === 'object' && 'code' in e
          ? String((e as { code: string }).code) : '';
        if (code !== 'ER_NO_SUCH_TABLE') throw e;
      }

      // 14. Paramètres utilisateur
      await conn.execute('DELETE FROM parametres_utilisateurs WHERE utilisateur_id = ?', [userId]);

      // 15. Disponibilités (médecin / cardiologue) — table optionnelle selon migrations
      try {
        await conn.execute(
          'DELETE FROM disponibilites_medecin WHERE medecin_id = ?',
          [userId]
        );
      } catch (e: unknown) {
        const code = e && typeof e === 'object' && 'code' in e
          ? String((e as { code: string }).code) : '';
        if (code !== 'ER_NO_SUCH_TABLE') throw e;
      }

      // 16. Utilisateur (enfin)
      await conn.execute('DELETE FROM utilisateurs WHERE id = ?', [userId]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async getCardiologuesLegacyAlias(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.nom, u.prenom, u.email
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE r.nom = 'cardiologue' AND u.est_actif = TRUE
       ORDER BY u.nom ASC`
    );
    return rows;
  },

  async assignerMedecin(
    patientId: number,
    medecinId: number
  ): Promise<void> {
    await pool.execute(
      `UPDATE profils_patients
       SET medecin_id = ?
       WHERE utilisateur_id = ?`,
      [medecinId, patientId]
    );
  },

  async getCardiologues(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.nom, u.prenom, u.email
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE r.nom = 'cardiologue' AND u.est_actif = TRUE
       ORDER BY u.nom ASC`
    );
    return rows;
  },

  async getCardiologuesEnAttente(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.email, u.telephone, u.created_at,
         pc.specialite, pc.ordre_medical, pc.titre, pc.annees_experience,
         pc.structure_nom, pc.structure_type, pc.departement, pc.langues,
         pc.statut_validation
       FROM utilisateurs u
       JOIN roles r ON r.id = u.role_id
       JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
       WHERE r.nom = 'cardiologue'
         AND pc.statut_validation = 'en_attente'
       ORDER BY u.created_at ASC`
    );
    return rows;
  },

  async traiterValidationCardiologue(
    cardiologueId: number,
    decision: 'accepte' | 'refuse'
  ): Promise<boolean> {
    const statutDb = decision === 'accepte' ? 'validee' : 'rejetee';
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT u.id
         FROM utilisateurs u
         JOIN roles r ON r.id = u.role_id
         JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
         WHERE u.id = ?
           AND r.nom = 'cardiologue'
           AND pc.statut_validation = 'en_attente'
         LIMIT 1`,
        [cardiologueId]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return false;
      }

      await conn.execute(
        `UPDATE profils_cardiologues SET statut_validation = ? WHERE utilisateur_id = ?`,
        [statutDb, cardiologueId]
      );
      await conn.execute(
        `UPDATE utilisateurs SET est_actif = ? WHERE id = ?`,
        [decision === 'accepte', cardiologueId]
      );

      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  async assignerCardiologue(
    patientId:     number,
    cardiologueId: number
  ): Promise<void> {
    await pool.execute(
      `UPDATE profils_patients
       SET medecin_id = ?
       WHERE utilisateur_id = ?`,
      [cardiologueId, patientId]
    );
  },

  /* ── ALERTES ───────────────────────────────────── */

  async getAllAlertes(resolu?: boolean): Promise<AlerteAdmin[]> {
    let query = `
      SELECT
        a.*,
        u.nom    AS patient_nom,
        u.prenom AS patient_prenom,
        m.systolique, m.diastolique, m.date_mesure,
        med.nom    AS medecin_nom,
        med.prenom AS medecin_prenom
      FROM alertes_tension a
      JOIN utilisateurs u ON a.patient_id = u.id
      JOIN mesures_tension m ON a.mesure_id = m.id
      LEFT JOIN profils_patients pp ON pp.utilisateur_id = u.id
      LEFT JOIN utilisateurs med ON pp.medecin_id = med.id
      WHERE 1=1
    `;
    const params: boolean[] = [];

    if (resolu !== undefined) {
      query += ' AND a.resolu = ?';
      params.push(resolu);
    }
    query += ' ORDER BY a.created_at DESC LIMIT 100';

    const [rows] = await pool.execute<AlerteAdmin[]>(query, params);
    return rows;
  },

  async resoudreAlerte(id: number): Promise<void> {
    await pool.execute(
      'UPDATE alertes_tension SET resolu = TRUE WHERE id = ?',
      [id]
    );
  },

  /* ── MÉDICAMENTS ───────────────────────────────── */

  async getAllMedicaments(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.*,
         (SELECT COUNT(*) FROM ordonnances_medicaments
          WHERE medicament_id = m.id) AS nb_prescriptions,
         (SELECT COUNT(*) FROM rappels_medicaments
          WHERE medicament_id = m.id) AS nb_rappels
       FROM medicaments m
       ORDER BY m.classe, m.nom`
    );
    return rows;
  },

  async deleteMedicament(id: number): Promise<void> {
    await pool.execute(
      'DELETE FROM medicaments WHERE id = ?',
      [id]
    );
  },

  async createMedicament(data: {
    nom: string; dci?: string; classe?: string;
    forme?: string; dosage?: string; description?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO medicaments (nom, dci, classe, forme, dosage, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.nom,
        data.dci         ?? null,
        data.classe      ?? null,
        data.forme       ?? null,
        data.dosage      ?? null,
        data.description ?? null,
      ]
    );
    return result.insertId;
  },

  /* ── STATS AVANCÉES ─────────────────────────────── */

  async getStatsAvancees(): Promise<RowDataPacket> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         -- Utilisateurs
         (SELECT COUNT(*) FROM utilisateurs WHERE est_actif = TRUE)  AS actifs,
         (SELECT COUNT(*) FROM utilisateurs WHERE est_actif = FALSE) AS inactifs,
         (SELECT COUNT(*) FROM utilisateurs
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))       AS new_7j,
         -- Mesures
         (SELECT COUNT(*) FROM mesures_tension)                      AS total_mesures,
         (SELECT COUNT(*) FROM mesures_tension
          WHERE created_at >= CURDATE())                             AS mesures_today,
         (SELECT COUNT(*) FROM mesures_tension
          WHERE statut IN ('hypertension_2','crise'))                AS mesures_critiques,
         -- Alertes
         (SELECT COUNT(*) FROM alertes_tension WHERE resolu = FALSE) AS alertes_actives,
         (SELECT COUNT(*) FROM alertes_tension WHERE resolu = TRUE)  AS alertes_resolues,
         -- Ordonnances
         (SELECT COUNT(*) FROM ordonnances WHERE statut='active')    AS ordonnances_actives,
         -- Rappels
         (SELECT COUNT(*) FROM rappels_medicaments WHERE est_actif=TRUE) AS rappels_actifs,
         -- Prises
         (SELECT ROUND(SUM(statut='pris')/COUNT(*)*100,1)
          FROM prises_medicaments
          WHERE date_prise >= DATE_SUB(NOW(), INTERVAL 30 DAY))     AS observance_globale,
         -- Messages
         (SELECT COUNT(*) FROM messages
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))      AS messages_7j`
    );
    return rows[0];
  },

  async getEvolutionInscriptions(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS mois,
         COUNT(*)                          AS total,
         SUM(role_id = (SELECT id FROM roles WHERE nom='patient'))  AS patients,
         SUM(role_id = (SELECT id FROM roles WHERE nom='cardiologue'))  AS medecins
       FROM utilisateurs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY mois ASC`
    );
    return rows;
  },
};

export default AdminModel;