import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { profilsCardiologuesHasAccepteNouvellesDemandes } from '../utils/schemaCompat.utils';

export interface ProfilComplet extends RowDataPacket {
  id:                number;
  uuid:              string;
  nom:               string;
  prenom:            string;
  email:             string;
  telephone:         string;
  date_naissance:    string;
  sexe:              string;
  adresse:           string;
  photo_profil:      string;
  role_nom:          string;
  email_verifie:     boolean;
  derniere_connexion:string;
  created_at:        string;
  // Champs communs inscription
  nationalite?:        string;
  ville?:              string;
  quartier?:           string;
  situation_maritale?: string;
  // Paramètres
  langue:            string;
  theme:             string;
  notif_push:        boolean;
  notif_email:       boolean;
  notif_sms:         boolean;
  rappel_mesure:     boolean;
  heure_rappel:      string;
  // Profil patient
  numero_dossier?:       string;
  groupe_sanguin?:       string;
  taille_cm?:            number;
  poids_kg?:             number;
  antecedents_medicaux?: string;
  antecedents_familiaux?: string;
  traitements_cours?:    string;
  allergies?:            string;
  niveau_risque?:        string;
  activite_physique?:    string;
  tabac?:                string;
  alcool?:               string;
  contact_urgence_nom?:   string;
  contact_urgence_lien?:  string;
  contact_urgence_tel?:   string;
  medecin_traitant_nom?:    string;
  medecin_traitant_prenom?: string;
  // Profil cardiologue
  specialite?:         string;
  ordre_medical?:      string;
  titre?:              string;
  annees_experience?:  number;
  biography?:          string;
  langues?:            string;
  hopital_lieu?:       string;
  structure_nom?:      string;
  structure_type?:     string;
  departement?:        string;
  jours_consultation?: string;
  heure_debut?:        string;
  heure_fin?:          string;
  duree_consultation?: number;
  max_patients_jour?:  number;
  quota_patients?:     number;
  accepte_video?:      boolean;
  accepte_nouvelles_demandes?: boolean;
  tarif_fcfa?:         number | null;
  cabinet_ville?:      string | null;
  /** Synthèse clinique renseignée par le cardiologue (lecture patient) */
  organes_cibles_atteints?:   string | null;
  type_hypertension?:         string | null;
  complications_cliniques?:   string | null;
  ta_cible_texte?:            string | null;
  enrichi_clinique_le?:       string | null;
}

export interface UpdateProfilDTO {
  nom?:                 string;
  prenom?:              string;
  telephone?:           string;
  date_naissance?:      string;
  sexe?:                string;
  adresse?:             string;
  nationalite?:         string;
  ville?:               string;
  quartier?:            string;
  situation_maritale?:  string;
}

export interface UpdatePatientDTO {
  groupe_sanguin?:        string;
  taille_cm?:             number;
  poids_kg?:              number;
  antecedents_medicaux?:  string;
  antecedents_familiaux?: string;
  traitements_cours?:     string;
  allergies?:             string;
  activite_physique?:     string;
  tabac?:                 string;
  alcool?:                string;
  contact_urgence_nom?:   string;
  contact_urgence_lien?:  string;
  contact_urgence_tel?:   string;
}

export interface UpdateCardiologueDTO {
  specialite?:                 string;
  ordre_medical?:              string;
  titre?:                      string;
  annees_experience?:          number;
  biography?:                  string;
  langues?:                    string;
  hopital?:                    string;
  ville?:                      string;
  structure_nom?:              string;
  structure_type?:             string;
  departement?:                string;
  jours_consultation?:         string;
  heure_debut?:                string;
  heure_fin?:                  string;
  duree_consultation?:         number;
  max_patients_jour?:          number;
  quota_patients?:             number;
  accepte_video?:              boolean;
  accepte_nouvelles_demandes?: boolean;
  tarif_fcfa?:                 number | null;
}

export interface UpdateParametresDTO {
  langue?:        string;
  theme?:         string;
  notif_push?:    boolean;
  notif_email?:   boolean;
  notif_sms?:     boolean;
  rappel_mesure?: boolean;
  heure_rappel?:  string;
}

const ProfilModel = {

  async getProfilComplet(userId: number): Promise<ProfilComplet | null> {
    const accepteExpr = (await profilsCardiologuesHasAccepteNouvellesDemandes())
      ? 'COALESCE(pc.accepte_nouvelles_demandes, TRUE) AS accepte_nouvelles_demandes'
      : 'TRUE AS accepte_nouvelles_demandes';
    const [rows] = await pool.execute<ProfilComplet[]>(
      `SELECT
         u.id, u.uuid, u.nom, u.prenom, u.email,
         u.telephone, u.date_naissance, u.sexe, u.adresse,
         u.photo_profil, u.email_verifie,
         u.derniere_connexion, u.created_at,
         u.nationalite, u.ville, u.quartier, u.situation_maritale,
         r.nom AS role_nom,
         COALESCE(pu.langue,        'fr')      AS langue,
         COALESCE(pu.theme,         'systeme') AS theme,
         COALESCE(pu.notif_push,    TRUE)      AS notif_push,
         COALESCE(pu.notif_email,   TRUE)      AS notif_email,
         COALESCE(pu.notif_sms,     FALSE)     AS notif_sms,
         COALESCE(pu.rappel_mesure, TRUE)      AS rappel_mesure,
         COALESCE(pu.heure_rappel,  '08:00:00')AS heure_rappel,
         pp.numero_dossier, pp.groupe_sanguin,
         pp.taille_cm, pp.poids_kg,
         pp.antecedents_medicaux, pp.antecedents_familiaux, pp.traitements_cours,
         pp.allergies,
         pp.niveau_risque,
         pp.activite_physique, pp.tabac, pp.alcool,
         pp.contact_urgence_nom, pp.contact_urgence_lien, pp.contact_urgence_tel,
         pp.organes_cibles_atteints, pp.type_hypertension,
         pp.complications_cliniques, pp.ta_cible_texte, pp.enrichi_clinique_le,
         med.nom     AS medecin_traitant_nom,
         med.prenom  AS medecin_traitant_prenom,
         pc.specialite, pc.ordre_medical, pc.titre, pc.annees_experience,
         pc.biography, pc.langues, pc.hopital AS hopital_lieu,
         pc.structure_nom, pc.structure_type, pc.departement,
         pc.jours_consultation, pc.heure_debut, pc.heure_fin,
         pc.duree_consultation, pc.max_patients_jour, pc.quota_patients,
         pc.accepte_video, pc.tarif_fcfa,
         NULLIF(TRIM(pc.ville), '') AS cabinet_ville,
         ${accepteExpr}
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN parametres_utilisateurs pu    ON pu.utilisateur_id = u.id
       LEFT JOIN profils_patients pp           ON pp.utilisateur_id = u.id
       LEFT JOIN utilisateurs med              ON med.id = pp.medecin_id
       LEFT JOIN profils_cardiologues pc       ON pc.utilisateur_id = u.id
       WHERE u.id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async updateProfil(userId: number, data: UpdateProfilDTO): Promise<void> {
    const champs = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => `${k} = ?`);
    const valeurs = Object.values(data).filter(v => v !== undefined);

    if (champs.length === 0) return;

    await pool.execute(
      `UPDATE utilisateurs SET ${champs.join(', ')} WHERE id = ?`,
      [...valeurs, userId]
    );
  },

  async updatePhoto(userId: number, photoUrl: string): Promise<void> {
    await pool.execute(
      `UPDATE utilisateurs SET photo_profil = ? WHERE id = ?`,
      [photoUrl, userId]
    );
  },

  async updateProfilPatient(
    userId: number,
    data: UpdatePatientDTO
  ): Promise<void> {
    const champs  = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => `${k} = ?`);
    const valeurs = Object.values(data).filter(v => v !== undefined);

    if (champs.length === 0) return;

    await pool.execute(
      `UPDATE profils_patients SET ${champs.join(', ')}
       WHERE utilisateur_id = ?`,
      [...valeurs, userId]
    );
  },

  async updateProfilCardiologue(
    userId: number,
    data: UpdateCardiologueDTO
  ): Promise<void> {
    let payload: UpdateCardiologueDTO = { ...data };
    if (!(await profilsCardiologuesHasAccepteNouvellesDemandes())) {
      const { accepte_nouvelles_demandes: _a, ...rest } = payload;
      payload = rest;
    }
    const champs  = Object.entries(payload)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => `${k} = ?`);
    const valeurs = Object.values(payload).filter(v => v !== undefined);

    if (champs.length === 0) return;

    await pool.execute(
      `UPDATE profils_cardiologues SET ${champs.join(', ')}
       WHERE utilisateur_id = ?`,
      [...valeurs, userId]
    );
  },

  async updateParametres(
    userId: number,
    data: UpdateParametresDTO
  ): Promise<void> {
    // Upsert : crée si inexistant, met à jour sinon
    await pool.execute(
      `INSERT INTO parametres_utilisateurs
         (utilisateur_id, langue, theme, notif_push, notif_email,
          notif_sms, rappel_mesure, heure_rappel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         langue        = COALESCE(VALUES(langue),        langue),
         theme         = COALESCE(VALUES(theme),         theme),
         notif_push    = COALESCE(VALUES(notif_push),    notif_push),
         notif_email   = COALESCE(VALUES(notif_email),   notif_email),
         notif_sms     = COALESCE(VALUES(notif_sms),     notif_sms),
         rappel_mesure = COALESCE(VALUES(rappel_mesure), rappel_mesure),
         heure_rappel  = COALESCE(VALUES(heure_rappel),  heure_rappel)`,
      [
        userId,
        data.langue        ?? null,
        data.theme         ?? null,
        data.notif_push    ?? null,
        data.notif_email   ?? null,
        data.notif_sms     ?? null,
        data.rappel_mesure ?? null,
        data.heure_rappel  ?? null,
      ]
    );
  },

  async changerMotDePasse(
    userId: number,
    newHash: string
  ): Promise<void> {
    await pool.execute(
      `UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?`,
      [newHash, userId]
    );
  },

  async getMotDePasseHash(userId: number): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT mot_de_passe FROM utilisateurs WHERE id = ?`,
      [userId]
    );
    return rows[0]?.mot_de_passe ?? null;
  },

  /** Désactive le compte (patient uniquement). */
  async deactivatePatientAccount(userId: number): Promise<void> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.nom AS role_nom FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [userId]
    );
    if (!rows[0] || rows[0].role_nom !== 'patient') {
      throw new Error('Cette action est réservée aux comptes patient');
    }
    await pool.execute(
      `UPDATE utilisateurs SET est_actif = FALSE WHERE id = ?`,
      [userId]
    );
  },
};

export default ProfilModel;