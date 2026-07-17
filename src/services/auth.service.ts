import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import UserModel, { CreateUserDTO, User } from '../models/user.model';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.utils';
import {
  sendAdminCardiologuePendingEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
} from '../utils/email.utils';
import crypto from 'crypto';
import { normalizeStructureType } from '../utils/register.utils';

export interface RegisterDTO {
  // Compte
  nom:             string;
  prenom:          string;
  email:           string;
  mot_de_passe:    string;
  telephone?:      string;
  role:            string;
  // Identité
  date_naissance?: string;
  sexe?:           string;
  nationalite?:    string;
  ville?:          string;
  quartier?:       string;
  situation_maritale?: string;
  /** Adresse postale (patient) ou adresse professionnelle (cardiologue) */
  adresse?:        string;
  // Patient — médical
  groupe_sanguin?:          string;
  taille_cm?:               number;
  poids_kg?:                number;
  antecedents_medicaux?:    string;
  antecedents_familiaux?:   string;
  allergies?:               string;
  traitements_cours?:       string;
  activite_physique?:       string;
  tabac?:                   string;
  alcool?:                  string;
  // Patient — contact urgence
  contact_urgence_nom?:  string;
  contact_urgence_lien?: string;
  contact_urgence_tel?:  string;
  // Cardiologue — professionnel
  ordre_medical?:      string;
  specialite?:         string;
  titre?:              string;
  annees_experience?:  number;
  structure_nom?:      string;
  structure_type?:     string;
  departement?:        string;
  langues?:            string;
  biography?:          string;
  tarif_fcfa?:         number;
  accepte_video?:      boolean;
  // Cardiologue — disponibilités
  jours_consultation?: string;
  heure_debut?:        string;
  heure_fin?:          string;
  duree_consultation?: number;
  max_patients_jour?:  number;
  quota_patients?:     number;
}

export interface LoginDTO {
  email:        string;
  mot_de_passe: string;
}

const AuthService = {

  /* ── REGISTER ─────────────────────────────────────────── */
  async register(data: RegisterDTO) {
    const existing = await UserModel.findByEmail(data.email);
    if (existing) throw new Error('Cet email est déjà utilisé');

    const roleId = await UserModel.getRoleId(data.role);
    if (!roleId) throw new Error('Rôle invalide');

    const hashedPassword = await hashPassword(data.mot_de_passe);
    const uuid = uuidv4();

    // ── Créer l'utilisateur de base ──────────────────────
    const createData: CreateUserDTO = {
      uuid,
      nom:            data.nom,
      prenom:         data.prenom,
      email:          data.email,
      mot_de_passe:   hashedPassword,
      telephone:      data.telephone,
      date_naissance: data.date_naissance,
      sexe:           data.sexe,
      role_id:        roleId,
    };

    if (data.role === 'cardiologue') {
      createData.est_actif = false;
    }

    const userId = await UserModel.create(createData);

    // ── Champs étendus dans utilisateurs ────────────────
    const champsExtra: string[] = [];
    const valeursExtra: (string | number | null)[] = [];
    if (data.nationalite)        { champsExtra.push('nationalite = ?');        valeursExtra.push(data.nationalite); }
    if (data.ville)              { champsExtra.push('ville = ?');              valeursExtra.push(data.ville); }
    if (data.quartier)           { champsExtra.push('quartier = ?');           valeursExtra.push(data.quartier); }
    if (data.situation_maritale) { champsExtra.push('situation_maritale = ?'); valeursExtra.push(data.situation_maritale); }
    if (data.adresse && data.role === 'patient') {
      champsExtra.push('adresse = ?');
      valeursExtra.push(data.adresse);
    }
    if (data.adresse && data.role === 'cardiologue') {
      champsExtra.push('adresse = ?');
      valeursExtra.push(data.adresse);
    }
    if (champsExtra.length > 0) {
      const sql = `UPDATE utilisateurs SET ${champsExtra.join(', ')} WHERE id = ?`;
      await pool.execute(sql, [...valeursExtra, userId]);
    }

    // ── Profil patient étendu ────────────────────────────
    if (data.role === 'patient') {
      const numeroDossier = `HT-PAT-${String(userId).padStart(5, '0')}`;
      await pool.execute(
        `INSERT INTO profils_patients
           (utilisateur_id, numero_dossier, groupe_sanguin, taille_cm, poids_kg,
            antecedents_medicaux, antecedents_familiaux, allergies, traitements_cours,
            activite_physique, tabac, alcool,
            contact_urgence_nom, contact_urgence_lien, contact_urgence_tel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, numeroDossier,
          data.groupe_sanguin       || null,
          data.taille_cm            || null,
          data.poids_kg             || null,
          data.antecedents_medicaux || null,
          data.antecedents_familiaux|| null,
          data.allergies            || null,
          data.traitements_cours    || null,
          data.activite_physique    || null,
          data.tabac                || null,
          data.alcool               || null,
          data.contact_urgence_nom  || null,
          data.contact_urgence_lien || null,
          data.contact_urgence_tel  || null,
        ]
      );
    }

    // ── Profil cardiologue étendu ────────────────────────
    if (data.role === 'cardiologue') {
      const structureType =
        normalizeStructureType(data.structure_type) ?? 'cabinet_liberal';
      await pool.execute(
        `INSERT INTO profils_cardiologues
           (utilisateur_id, specialite, hopital, ville, biography, quota_patients,
            ordre_medical, titre, annees_experience, structure_nom, structure_type,
            departement, langues, tarif_fcfa, accepte_video,
            jours_consultation, heure_debut, heure_fin, duree_consultation, max_patients_jour,
            statut_validation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')
         ON DUPLICATE KEY UPDATE
           specialite         = VALUES(specialite),
           hopital            = VALUES(hopital),
           ville              = VALUES(ville),
           biography          = VALUES(biography),
           quota_patients     = VALUES(quota_patients),
           ordre_medical      = VALUES(ordre_medical),
           titre              = VALUES(titre),
           annees_experience  = VALUES(annees_experience),
           structure_nom      = VALUES(structure_nom),
           structure_type     = VALUES(structure_type),
           departement        = VALUES(departement),
           langues            = VALUES(langues),
           tarif_fcfa         = VALUES(tarif_fcfa),
           accepte_video      = VALUES(accepte_video),
           jours_consultation = VALUES(jours_consultation),
           heure_debut        = VALUES(heure_debut),
           heure_fin          = VALUES(heure_fin),
           duree_consultation = VALUES(duree_consultation),
           max_patients_jour  = VALUES(max_patients_jour)`,
        [
          userId,
          data.specialite          || 'Cardiologie générale',
          data.adresse             || null,
          data.ville               || null,
          data.biography           || null,
          data.quota_patients      ?? 50,
          data.ordre_medical       || null,
          data.titre               || null,
          data.annees_experience   ?? null,
          data.structure_nom       || null,
          structureType,
          data.departement         || null,
          data.langues             || null,
          data.tarif_fcfa          ?? null,
          data.accepte_video !== undefined ? data.accepte_video : true,
          data.jours_consultation  || null,
          data.heure_debut         || null,
          data.heure_fin           || null,
          data.duree_consultation  ?? 30,
          data.max_patients_jour   ?? 10,
        ]
      );
    }

    await UserModel.createDefaultParams(userId);

    // ── Cardiologue : retour sans JWT (en attente validation) ──
    if (data.role === 'cardiologue') {
      sendWelcomeEmail(data.email, data.prenom, data.role).catch(() => {});
      if (process.env.ADMIN_EMAIL) {
        sendAdminCardiologuePendingEmail(
          process.env.ADMIN_EMAIL,
          `${data.prenom} ${data.nom}`,
          data.email
        ).catch(() => {});
      }
      return { pending: true, message: 'Votre dossier a été soumis. Vous recevrez un email après validation par l\'administrateur.' };
    }

    // ── Patient : connexion immédiate ───────────────────
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('Erreur lors de la création du compte');

    sendWelcomeEmail(user.email, user.prenom, data.role).catch(() => {});

    const payload = {
      id:     user.id,
      uuid:   user.uuid,
      roleId: user.role_id,
      role:   user.role_nom,
      email:  user.email,
    };

    return {
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
      user: {
        id:     user.id,
        uuid:   user.uuid,
        nom:    user.nom,
        prenom: user.prenom,
        email:  user.email,
        role:   user.role_nom,
        photo:  user.photo_profil,
      },
    };
  },

  /* ── LOGIN ────────────────────────────────────────────── */
  async login(data: LoginDTO) {
    type LoginUser = User & { cardio_statut?: string | null };
    const [rows] = await pool.execute<LoginUser[]>(
      `SELECT u.*, r.nom AS role_nom,
              pc.statut_validation AS cardio_statut
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN profils_cardiologues pc
         ON pc.utilisateur_id = u.id AND r.nom = 'cardiologue'
       WHERE u.email = ?`,
      [data.email]
    );
    const user = rows[0] || null;
    if (!user) throw new Error('Email ou mot de passe incorrect');

    const isValid = await comparePassword(data.mot_de_passe, user.mot_de_passe);
    if (!isValid) throw new Error('Email ou mot de passe incorrect');

    if (!user.est_actif && user.role_nom === 'cardiologue') {
      if (user.cardio_statut === 'en_attente') {
        throw new Error('Votre compte est en attente de validation par l\'administrateur.');
      }
      if (user.cardio_statut === 'rejetee') {
        throw new Error(
          'Votre demande d\'inscription cardiologue a été refusée. ' +
            'Pour toute question, contactez l\'administrateur de la plateforme.'
        );
      }
      throw new Error('Votre compte a été désactivé.');
    }

    if (!user.est_actif) throw new Error('Votre compte a été désactivé.');

    await UserModel.updateLastLogin(user.id);

    const payload = {
      id:     user.id,
      uuid:   user.uuid,
      roleId: user.role_id,
      role:   user.role_nom,
      email:  user.email,
    };

    return {
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
      user: {
        id:     user.id,
        uuid:   user.uuid,
        nom:    user.nom,
        prenom: user.prenom,
        email:  user.email,
        role:   user.role_nom,
        photo:  user.photo_profil,
      },
    };
  },

  /* ── FORGOT PASSWORD ──────────────────────────────────── */
  async forgotPassword(email: string) {
    if (!email || typeof email !== 'string') {
      return {
        message:
          'Si cet e-mail existe dans notre système, vous recevrez un message.',
      };
    }

    const user = await UserModel.findByEmailForPasswordReset(email);
    if (!user) {
      return {
        message:
          'Si cet e-mail existe dans notre système, vous recevrez un message.',
      };
    }

    const token      = crypto.randomBytes(32).toString('hex');
    const expiration = new Date(Date.now() + 3600000);

    await UserModel.updateResetTokenByUserId(user.id, token, expiration);
    try {
      await sendResetPasswordEmail(
        user.email,
        user.prenom || 'Utilisateur',
        token
      );
    } catch (err) {
      console.error('[forgotPassword] envoi e-mail', err);
      throw new Error(
        "Impossible d'envoyer l'e-mail. Vérifiez la configuration SMTP " +
          '(MAIL_USER, MAIL_PASS, MAIL_HOST) ou réessayez plus tard.'
      );
    }

    return { message: 'Instructions envoyées à votre adresse e-mail.' };
  },

  /* ── RESET PASSWORD ───────────────────────────────────── */
  async resetPassword(token: string, newPassword: string) {
    const t = typeof token === 'string' ? token.trim() : '';
    if (!t) throw new Error('Token requis');

    const user = await UserModel.findByResetToken(t);
    if (!user) throw new Error('Token invalide ou expiré');

    const hashedPassword = await hashPassword(newPassword);
    await UserModel.updatePassword(user.id, hashedPassword);

    return { message: 'Mot de passe réinitialisé avec succès.' };
  },

  /* ── GET ME ───────────────────────────────────────────── */
  async getMe(userId: number) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('Utilisateur introuvable');

    return {
      id:                 user.id,
      uuid:               user.uuid,
      nom:                user.nom,
      prenom:             user.prenom,
      email:              user.email,
      telephone:          user.telephone,
      date_naissance:     user.date_naissance,
      sexe:               user.sexe,
      adresse:            user.adresse,
      photo:              user.photo_profil,
      role:               user.role_nom,
      email_verifie:      user.email_verifie,
      derniere_connexion: user.derniere_connexion,
    };
  },
};

export default AuthService;
