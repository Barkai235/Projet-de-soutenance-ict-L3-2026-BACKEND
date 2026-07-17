import { Response }    from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import ProfilService   from '../services/profil.service';
import { sendSuccess, sendError } from '../utils/response.utils';
import pool from '../config/database';

const ProfilController = {

  async getProfil(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await ProfilService.getProfil(req.user!.id);
      sendSuccess(res, 'Profil récupéré', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async updateProfil(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        nom, prenom, telephone, date_naissance, sexe, adresse,
        nationalite, ville, quartier, situation_maritale,
        groupe_sanguin, taille_cm, poids_kg,
        antecedents_medicaux, antecedents_familiaux, traitements_cours,
        allergies, activite_physique, tabac, alcool,
        contact_urgence_nom, contact_urgence_lien, contact_urgence_tel,
        specialite, ordre_medical, titre, biography, langues,
        hopital_lieu, cabinet_ville, structure_nom, structure_type, departement,
        jours_consultation, heure_debut, heure_fin,
        annees_experience, duree_consultation, max_patients_jour,
        accepte_video, tarif_fcfa,
        quota_patients, accepte_nouvelles_demandes,
      } = req.body;

      const result = await ProfilService.updateProfil(
        req.user!.id,
        {
          nom, prenom, telephone, date_naissance, sexe, adresse,
          nationalite, ville, quartier, situation_maritale,
        },
        req.user!.role === 'patient'
          ? {
              groupe_sanguin, taille_cm, poids_kg,
              antecedents_medicaux, antecedents_familiaux, traitements_cours,
              allergies, activite_physique, tabac, alcool,
              contact_urgence_nom, contact_urgence_lien, contact_urgence_tel,
            }
          : undefined,
        req.user!.role === 'cardiologue'
          ? {
              specialite,
              ordre_medical,
              titre,
              biography,
              langues,
              hopital: hopital_lieu,
              ville: cabinet_ville,
              structure_nom,
              structure_type,
              departement,
              jours_consultation,
              heure_debut,
              heure_fin,
              annees_experience,
              duree_consultation,
              max_patients_jour,
              accepte_video:
                accepte_video === undefined ? undefined : Boolean(accepte_video),
              tarif_fcfa,
              quota_patients:
                quota_patients !== undefined && quota_patients !== ''
                  ? Number(quota_patients)
                  : undefined,
              accepte_nouvelles_demandes:
                accepte_nouvelles_demandes === undefined
                  ? undefined
                  : Boolean(accepte_nouvelles_demandes),
            }
          : undefined
      );
      sendSuccess(res, 'Profil mis à jour', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async uploadPhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'Aucun fichier envoyé', 400);
        return;
      }
      const result = await ProfilService.updatePhoto(
        req.user!.id, req.file.filename
      );
      sendSuccess(res, 'Photo mise à jour', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async updateParametres(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await ProfilService.updateParametres(
        req.user!.id, req.body
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async changerMotDePasse(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
      const result = await ProfilService.changerMotDePasse(
        req.user!.id, ancien_mot_de_passe, nouveau_mot_de_passe
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async desactiverCompte(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'patient') {
        sendError(res, 'Réservé aux comptes patient', 403);
        return;
      }
      const result = await ProfilService.desactiverComptePatient(req.user!.id);
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async saveFcmToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { fcm_token } = req.body;
      if (!fcm_token) {
        sendError(res, 'fcm_token requis', 400);
        return;
      }
      await pool.execute(
        'UPDATE utilisateurs SET fcm_token = ? WHERE id = ?',
        [fcm_token, req.user!.id]
      );
      sendSuccess(res, 'Token FCM enregistré');
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 500);
    }
  },

  // GET /api/profil/cardiologues — liste les cardiologues (accessible à tout utilisateur connecté)
  async listerCardiologues(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const [rows] = await pool.execute<import('mysql2').RowDataPacket[]>(
        `SELECT u.id, u.nom, u.prenom, u.photo_profil,
                COALESCE(pc.specialite, 'Cardiologie') AS specialite
         FROM utilisateurs u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN profils_cardiologues pc ON pc.utilisateur_id = u.id
         WHERE r.nom = 'cardiologue' AND u.est_actif = TRUE
         ORDER BY u.nom, u.prenom`
      );
      sendSuccess(res, 'Cardiologues récupérés', rows);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 500);
    }
  },
};

export default ProfilController;