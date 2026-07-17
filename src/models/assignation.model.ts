import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { profilsCardiologuesHasAccepteNouvellesDemandes } from '../utils/schemaCompat.utils';

export interface Cardiologue extends RowDataPacket {
  id:               number;
  nom:              string;
  prenom:           string;
  email:            string;
  telephone:        string | null;
  photo_profil:     string | null;
  specialite:       string;
  hopital:          string | null;
  ville:            string | null;
  biography:        string | null;
  quota_patients:   number;
  note_moyenne:     number;
  nb_patients:      number;
  disponible:       number; // 0 | 1
  a_demande_active: number; // 0 | 1
  accepte_nouvelles_demandes?: number; // 0 | 1
  /** Champs profil pro (inscription / fiche cardiologue) */
  titre?:                 string | null;
  annees_experience?:     number | null;
  structure_nom?:         string | null;
  structure_type?:        string | null;
  departement?:           string | null;
  langues?:               string | null;
  ordre_medical?:         string | null;
  jours_consultation?:    string | null;
  heure_debut?:           string | null;
  heure_fin?:             string | null;
  duree_consultation?:    number | null;
  max_patients_jour?:     number | null;
  accepte_video?:         number | boolean | null;
  tarif_fcfa?:            number | null;
}

export interface DemandeAssignation extends RowDataPacket {
  id:                   number;
  patient_id:           number;
  medecin_id:           number;
  motif:                string;
  urgence:              'routine' | 'moderee' | 'urgente';
  antecedents:          string | null;
  statut:               'en_attente' | 'acceptee' | 'refusee' | 'annulee';
  motif_refus:          string | null;
  message_refus:        string | null;
  created_at:           string;
  updated_at:           string;
  // Champs joints
  patient_nom?:         string;
  patient_prenom?:      string;
  patient_email?:       string;
  patient_telephone?:   string;
  patient_naissance?:   string;
  niveau_risque?:       string;
  antecedents_dossier?: string;
  groupe_sanguin?:      string;
  nb_mesures?:          number;
  medecin_nom?:         string;
  medecin_prenom?:      string;
  specialite?:          string;
  hopital?:             string;
}

const AssignationModel = {
  async estPatientDuCardiologue(patient_id: number, medecin_id: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1
       FROM profils_patients
       WHERE utilisateur_id = ? AND medecin_id = ?
       LIMIT 1`,
      [patient_id, medecin_id]
    );
    return rows.length > 0;
  },

  /** Cardiologue assigné au patient (messagerie patient → cardio). */
  async getMedecinIdPatient(patient_id: number): Promise<number | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT medecin_id FROM profils_patients WHERE utilisateur_id = ? LIMIT 1`,
      [patient_id]
    );
    const mid = rows[0]?.medecin_id;
    return mid != null ? Number(mid) : null;
  },

  /** Patients actuellement suivis par ce cardiologue. */
  async listerPatientIdsDuCardiologue(cardiologue_id: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT utilisateur_id FROM profils_patients WHERE medecin_id = ?`,
      [cardiologue_id]
    );
    return rows.map(r => Number(r.utilisateur_id));
  },

  async getNbPatientsEtQuota(cardiologue_id: number): Promise<{ nb: number; quota: number }> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(pp.utilisateur_id)        AS nb,
         COALESCE(MAX(pc.quota_patients), 50) AS quota
       FROM utilisateurs u
       LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
       LEFT JOIN profils_patients pp ON pp.medecin_id = u.id
       WHERE u.id = ?
       GROUP BY u.id`,
      [cardiologue_id]
    );
    const row = rows[0];
    return {
      nb:    Number(row?.nb ?? 0),
      quota: Number(row?.quota ?? 50),
    };
  },

  async annulerDemandeParPatient(demande_id: number, patient_id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE demandes_assignation SET statut = 'annulee'
       WHERE id = ? AND patient_id = ? AND statut = 'en_attente'`,
      [demande_id, patient_id]
    );
    return result.affectedRows > 0;
  },

  async estCardiologueActif(medecin_id: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1
       FROM utilisateurs u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.est_actif = TRUE AND r.nom = 'cardiologue'
       LIMIT 1`,
      [medecin_id]
    );
    return rows.length > 0;
  },

  /* ── Cardiologues (liste ou fiche pour le patient) ─────── */
  async listerCardiologues(
    patient_id: number,
    opts?: { ville?: string; disponible_uniquement?: boolean },
    cardiologue_id_unique?: number
  ): Promise<Cardiologue[]> {
    const cond: string[] = [`r.nom = 'cardiologue'`, `u.est_actif = TRUE`];
    const params: (string | number)[] = [patient_id];

    if (cardiologue_id_unique) {
      cond.push('u.id = ?');
      params.push(cardiologue_id_unique);
    }
    const ville = opts?.ville?.trim();
    if (ville) {
      cond.push('(COALESCE(pc.ville, \'\') LIKE ? OR COALESCE(u.ville, \'\') LIKE ?)');
      const like = `%${ville}%`;
      params.push(like, like);
    }

    let having = '';
    if (opts?.disponible_uniquement) {
      having = `HAVING (COUNT(DISTINCT pp.utilisateur_id) < COALESCE(MAX(pc.quota_patients), 50))`;
    }

    const hasAccepteCol = await profilsCardiologuesHasAccepteNouvellesDemandes();
    const accepteSelect = hasAccepteCol
      ? 'COALESCE(pc.accepte_nouvelles_demandes, TRUE) AS accepte_nouvelles_demandes'
      : 'TRUE AS accepte_nouvelles_demandes';
    const groupByAccepte = hasAccepteCol ? ', pc.accepte_nouvelles_demandes' : '';

    const [rows] = await pool.execute<Cardiologue[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.email, u.telephone, u.photo_profil,
         COALESCE(pc.specialite,     'Cardiologie') AS specialite,
         COALESCE(pc.hopital,        '')             AS hopital,
         COALESCE(pc.ville,          '')             AS ville,
         COALESCE(pc.biography,      '')             AS biography,
         COALESCE(pc.quota_patients, 50)             AS quota_patients,
         COALESCE(pc.note_moyenne,   0)              AS note_moyenne,
         COUNT(DISTINCT pp.utilisateur_id)           AS nb_patients,
         (COUNT(DISTINCT pp.utilisateur_id) < COALESCE(pc.quota_patients, 50)) AS disponible,
         EXISTS(
           SELECT 1 FROM demandes_assignation da2
           WHERE da2.patient_id = ? AND da2.medecin_id = u.id
             AND da2.statut = 'en_attente'
         ) AS a_demande_active,
         pc.titre,
         pc.annees_experience,
         pc.structure_nom,
         pc.structure_type,
         pc.departement,
         pc.langues,
         pc.ordre_medical,
         pc.jours_consultation,
         pc.heure_debut,
         pc.heure_fin,
         pc.duree_consultation,
         pc.max_patients_jour,
         COALESCE(pc.accepte_video, TRUE) AS accepte_video,
         pc.tarif_fcfa,
         ${accepteSelect}
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
       LEFT JOIN profils_patients pp ON pp.medecin_id = u.id
       WHERE ${cond.join(' AND ')}
       GROUP BY u.id, u.nom, u.prenom, u.email, u.telephone, u.photo_profil,
                pc.specialite, pc.hopital, pc.ville, pc.biography,
                pc.quota_patients, pc.note_moyenne,
                pc.titre, pc.annees_experience, pc.structure_nom, pc.structure_type,
                pc.departement, pc.langues, pc.ordre_medical,
                pc.jours_consultation, pc.heure_debut, pc.heure_fin,
                pc.duree_consultation, pc.max_patients_jour, pc.accepte_video, pc.tarif_fcfa
                ${groupByAccepte}
       ${having}
       ORDER BY disponible DESC, nb_patients ASC, u.nom ASC`,
      params
    );
    return rows;
  },

  /* ── Mon cardiologue actuel (patient) ─────────────────── */
  async monCardiologue(patient_id: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.nom, u.prenom, u.email, u.telephone, u.photo_profil,
         COALESCE(pc.specialite, 'Cardiologie') AS specialite,
         COALESCE(pc.hopital, '')               AS hopital,
         COALESCE(pc.ville, '')                 AS ville
       FROM profils_patients pp
       JOIN utilisateurs u ON u.id = pp.medecin_id
       LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
       WHERE pp.utilisateur_id = ?`,
      [patient_id]
    );
    return rows[0] ?? null;
  },

  /* ── Créer une demande ────────────────────────────────── */
  async creerDemande(data: {
    patient_id:   number;
    medecin_id:   number;
    motif:        string;
    urgence:      string;
    antecedents?: string;
  }): Promise<number> {
    const deja = await AssignationModel.getMedecinIdPatient(data.patient_id);
    if (deja != null) {
      throw new Error(
        'Vous avez déjà un cardiologue assigné. Mettez fin au suivi actuel avant une nouvelle demande.'
      );
    }

    if (await profilsCardiologuesHasAccepteNouvellesDemandes()) {
      const [accRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(pc.accepte_nouvelles_demandes, TRUE) AS ok
         FROM utilisateurs u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
         WHERE u.id = ? AND r.nom = 'cardiologue' AND u.est_actif = TRUE`,
        [data.medecin_id]
      );
      if (accRows.length === 0) {
        throw new Error('Cardiologue introuvable ou inactif');
      }
      if (!accRows[0].ok) {
        throw new Error('Ce cardiologue ne prend pas de nouvelles demandes pour le moment.');
      }
    } else {
      const [exist] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 AS ok
         FROM utilisateurs u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND r.nom = 'cardiologue' AND u.est_actif = TRUE`,
        [data.medecin_id]
      );
      if (exist.length === 0) {
        throw new Error('Cardiologue introuvable ou inactif');
      }
    }

    const [dup] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM demandes_assignation
       WHERE patient_id = ? AND medecin_id = ? AND statut = 'en_attente' LIMIT 1`,
      [data.patient_id, data.medecin_id]
    );
    if (dup.length > 0) {
      throw new Error('Vous avez déjà une demande en attente auprès de ce cardiologue.');
    }

    const [quota] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(pc.quota_patients, 50) AS quota,
         COUNT(pp.utilisateur_id)        AS nb
       FROM utilisateurs u
       LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
       LEFT JOIN profils_patients pp ON pp.medecin_id = u.id
       WHERE u.id = ?
       GROUP BY u.id, pc.quota_patients`,
      [data.medecin_id]
    );
    if (quota[0] && Number(quota[0].nb) >= Number(quota[0].quota)) {
      throw new Error('Ce cardiologue a atteint son quota de patients');
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO demandes_assignation
         (patient_id, medecin_id, motif, urgence, antecedents)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.patient_id,
        data.medecin_id,
        data.motif,
        data.urgence,
        data.antecedents ?? null,
      ]
    );
    return result.insertId;
  },

  /* ── Mes demandes (patient) ───────────────────────────── */
  async mesDemandes(patient_id: number): Promise<DemandeAssignation[]> {
    const [rows] = await pool.execute<DemandeAssignation[]>(
      `SELECT da.*,
              u.nom    AS medecin_nom,
              u.prenom AS medecin_prenom,
              COALESCE(pc.specialite, 'Cardiologie') AS specialite,
              COALESCE(pc.hopital,    '')             AS hopital
       FROM demandes_assignation da
       JOIN utilisateurs u ON u.id = da.medecin_id
       LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = da.medecin_id
       WHERE da.patient_id = ?
       ORDER BY da.created_at DESC`,
      [patient_id]
    );
    return rows;
  },

  /* ── Demandes reçues (cardiologue) ────────────────────── */
  async demandesCardiologue(medecin_id: number): Promise<DemandeAssignation[]> {
    const [rows] = await pool.execute<DemandeAssignation[]>(
      `SELECT da.*,
              u.nom          AS patient_nom,
              u.prenom       AS patient_prenom,
              u.email        AS patient_email,
              u.telephone    AS patient_telephone,
              u.date_naissance AS patient_naissance,
              pp.niveau_risque,
              pp.antecedents_medicaux AS antecedents_dossier,
              pp.groupe_sanguin,
              (SELECT COUNT(*) FROM mesures_tension m WHERE m.patient_id = da.patient_id) AS nb_mesures
       FROM demandes_assignation da
       JOIN utilisateurs u ON u.id = da.patient_id
       LEFT JOIN profils_patients pp ON pp.utilisateur_id = da.patient_id
       WHERE da.medecin_id = ? AND da.statut = 'en_attente'
       ORDER BY
         CASE da.urgence
           WHEN 'urgente'  THEN 0
           WHEN 'moderee'  THEN 1
           ELSE 2
         END,
         da.created_at ASC`,
      [medecin_id]
    );
    return rows;
  },

  /* ── Compter demandes en attente (pour badge) ─────────── */
  async countDemandesEnAttente(medecin_id: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM demandes_assignation
       WHERE medecin_id = ? AND statut = 'en_attente'`,
      [medecin_id]
    );
    return rows[0]?.total ?? 0;
  },

  /* ── Accepter une demande ─────────────────────────────── */
  async accepterDemande(
    id: number,
    medecin_id: number
  ): Promise<{ patient_id: number } | null> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute<DemandeAssignation[]>(
        `SELECT * FROM demandes_assignation
         WHERE id = ? AND medecin_id = ? AND statut = 'en_attente'`,
        [id, medecin_id]
      );
      if (rows.length === 0) { await conn.rollback(); return null; }
      const demande = rows[0];

      const [ppRows] = await conn.execute<RowDataPacket[]>(
        `SELECT medecin_id FROM profils_patients WHERE utilisateur_id = ? FOR UPDATE`,
        [demande.patient_id]
      );
      const mid = ppRows[0]?.medecin_id;
      if (mid != null && Number(mid) !== 0) {
        await conn.rollback();
        throw new Error('Ce patient est déjà suivi par un autre cardiologue.');
      }

      const [cntRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM profils_patients WHERE medecin_id = ?`,
        [medecin_id]
      );
      const nbPatients = Number(cntRows[0]?.c ?? 0);
      const [qRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COALESCE(pc.quota_patients, 50) AS q
         FROM utilisateurs u
         LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
         WHERE u.id = ? LIMIT 1`,
        [medecin_id]
      );
      const quotaMax = Number(qRows[0]?.q ?? 50);
      if (nbPatients >= quotaMax) {
        await conn.rollback();
        throw new Error(
          'Votre quota de patients est atteint. Libérez une place (fin de suivi) ou augmentez votre quota avant d’accepter une nouvelle demande.'
        );
      }

      // Ancienne ligne encore « acceptee » (ex. fin de suivi sans mise à jour) : évite doublon
      // si l’index uq_demande_active existe encore, et clarifie l’historique côté patient.
      await conn.execute(
        `UPDATE demandes_assignation
         SET statut = 'annulee',
             motif_refus = 'Ancienne période de suivi',
             message_refus = 'Remplacée par une nouvelle acceptation.'
         WHERE patient_id = ? AND medecin_id = ? AND statut = 'acceptee' AND id != ?`,
        [demande.patient_id, medecin_id, id]
      );

      // Accepter cette demande
      await conn.execute(
        `UPDATE demandes_assignation SET statut = 'acceptee' WHERE id = ?`,
        [id]
      );
      // Annuler les autres demandes en attente du même patient
      await conn.execute(
        `UPDATE demandes_assignation SET statut = 'annulee'
         WHERE patient_id = ? AND id != ? AND statut = 'en_attente'`,
        [demande.patient_id, id]
      );
      // Assigner le médecin dans profils_patients
      await conn.execute(
        `UPDATE profils_patients SET medecin_id = ? WHERE utilisateur_id = ?`,
        [medecin_id, demande.patient_id]
      );

      await conn.commit();
      return { patient_id: demande.patient_id };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /* ── Refuser une demande ──────────────────────────────── */
  async refuserDemande(
    id: number,
    medecin_id: number,
    motif_refus: string,
    message_refus?: string
  ): Promise<{ patient_id: number } | null> {
    const [rows] = await pool.execute<DemandeAssignation[]>(
      `SELECT * FROM demandes_assignation
       WHERE id = ? AND medecin_id = ? AND statut = 'en_attente'`,
      [id, medecin_id]
    );
    if (rows.length === 0) return null;

    await pool.execute(
      `UPDATE demandes_assignation
       SET statut = 'refusee', motif_refus = ?, message_refus = ?
       WHERE id = ?`,
      [motif_refus, message_refus ?? null, id]
    );
    return { patient_id: rows[0].patient_id };
  },

  /* ── Fin de suivi (cardiologue) ───────────────────────── */
  async finSuivi(medecin_id: number, patient_id: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM profils_patients
       WHERE utilisateur_id = ? AND medecin_id = ?`,
      [patient_id, medecin_id]
    );
    if (rows.length === 0) return false;

    await pool.execute(
      `UPDATE demandes_assignation
       SET statut = 'annulee', motif_refus = 'fin_suivi',
           message_refus = 'Période de suivi terminée.'
       WHERE patient_id = ? AND medecin_id = ? AND statut = 'acceptee'`,
      [patient_id, medecin_id]
    );
    await pool.execute(
      `UPDATE profils_patients SET medecin_id = NULL WHERE utilisateur_id = ?`,
      [patient_id]
    );
    await pool.execute(
      `UPDATE demandes_assignation SET statut = 'annulee'
       WHERE patient_id = ? AND statut = 'en_attente'`,
      [patient_id]
    );
    return true;
  },

  async finSuiviParPatient(patient_id: number): Promise<{ medecin_id: number } | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT medecin_id FROM profils_patients
       WHERE utilisateur_id = ? AND medecin_id IS NOT NULL`,
      [patient_id]
    );
    if (rows.length === 0 || !rows[0].medecin_id) return null;

    const medecin_id = Number(rows[0].medecin_id);
    await pool.execute(
      `UPDATE demandes_assignation
       SET statut = 'annulee', motif_refus = 'fin_suivi',
           message_refus = 'Période de suivi terminée.'
       WHERE patient_id = ? AND medecin_id = ? AND statut = 'acceptee'`,
      [patient_id, medecin_id]
    );
    await pool.execute(
      `UPDATE profils_patients SET medecin_id = NULL WHERE utilisateur_id = ?`,
      [patient_id]
    );
    await pool.execute(
      `UPDATE demandes_assignation SET statut = 'annulee'
       WHERE patient_id = ? AND statut = 'en_attente'`,
      [patient_id]
    );
    return { medecin_id };
  },
};

export default AssignationModel;
