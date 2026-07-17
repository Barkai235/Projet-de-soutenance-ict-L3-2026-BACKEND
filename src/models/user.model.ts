import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface User extends RowDataPacket {
  id:                 number;
  uuid:               string;
  nom:                string;
  prenom:             string;
  email:              string;
  mot_de_passe:       string;
  telephone:          string;
  date_naissance:     string;
  sexe:               string;
  adresse:            string;
  photo_profil:       string;
  role_id:            number;
  role_nom:           string;
  est_actif:          boolean;
  email_verifie:      boolean;
  token_reset:        string;
  token_expiration:   string;
  derniere_connexion: string;
  created_at:         string;
}

export interface CreateUserDTO {
  uuid:           string;
  nom:            string;
  prenom:         string;
  email:          string;
  mot_de_passe:   string;
  telephone?:     string;
  date_naissance?: string;
  sexe?:          string;
  role_id:        number;
  /** Si omis, le compte est créé actif (true). */
  est_actif?:     boolean;
}

const UserModel = {
  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.execute<User[]>(
      `SELECT u.*, r.nom AS role_nom
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ? AND u.est_actif = TRUE`,
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Réinitialisation mot de passe : même compte que login, mais sans filtre est_actif
   * et comparaison e-mail insensible à la casse / espaces.
   */
  async findByEmailForPasswordReset(email: string): Promise<User | null> {
    const e = email.trim().toLowerCase();
    const [rows] = await pool.execute<User[]>(
      `SELECT u.*, r.nom AS role_nom
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(TRIM(u.email)) = ?`,
      [e]
    );
    return rows[0] || null;
  },

  async findById(id: number): Promise<User | null> {
    const [rows] = await pool.execute<User[]>(
      `SELECT u.*, r.nom AS role_nom
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.est_actif = TRUE`,
      [id]
    );
    return rows[0] || null;
  },

  /** Utilisateur par id même si est_actif = false (emails admin, scripts). */
  async findByIdIncludingInactive(id: number): Promise<User | null> {
    const [rows] = await pool.execute<User[]>(
      `SELECT u.*, r.nom AS role_nom
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data: CreateUserDTO): Promise<number> {
    const est_actif = data.est_actif === undefined ? true : data.est_actif;
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO utilisateurs
         (uuid, nom, prenom, email, mot_de_passe, telephone, date_naissance, sexe, role_id, est_actif)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.nom,
        data.prenom,
        data.email,
        data.mot_de_passe,
        data.telephone || null,
        data.date_naissance || null,
        data.sexe || null,
        data.role_id,
        est_actif,
      ]
    );
    return result.insertId;
  },

  async createPatientProfile(utilisateur_id: number, numero_dossier: string): Promise<void> {
    await pool.execute(
      `INSERT INTO profils_patients (utilisateur_id, numero_dossier) VALUES (?, ?)`,
      [utilisateur_id, numero_dossier]
    );
  },

  async createDefaultParams(utilisateur_id: number): Promise<void> {
    await pool.execute(
      `INSERT INTO parametres_utilisateurs (utilisateur_id) VALUES (?)`,
      [utilisateur_id]
    );
  },

  async updateLastLogin(id: number): Promise<void> {
    await pool.execute(
      `UPDATE utilisateurs SET derniere_connexion = NOW() WHERE id = ?`,
      [id]
    );
  },

  async updateResetTokenByUserId(
    userId: number,
    token: string,
    expiration: Date
  ): Promise<void> {
    await pool.execute(
      `UPDATE utilisateurs SET token_reset = ?, token_expiration = ? WHERE id = ?`,
      [token, expiration, userId]
    );
  },

  async findByResetToken(token: string): Promise<User | null> {
    const t = token.trim();
    const [rows] = await pool.execute<User[]>(
      `SELECT * FROM utilisateurs
       WHERE TRIM(token_reset) = ? AND token_expiration > NOW()`,
      [t]
    );
    return rows[0] || null;
  },

  async updatePassword(id: number, newPasswordHash: string): Promise<void> {
    await pool.execute(
      `UPDATE utilisateurs
       SET mot_de_passe = ?, token_reset = NULL, token_expiration = NULL
       WHERE id = ?`,
      [newPasswordHash, id]
    );
  },

  async getRoleId(roleName: string): Promise<number | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM roles WHERE nom = ?`,
      [roleName]
    );
    return rows[0]?.id || null;
  },
};

export default UserModel;