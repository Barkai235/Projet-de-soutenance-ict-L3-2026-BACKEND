import { Response }    from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import TelemedicineModel, { type RendezVous } from '../models/telemedicine.model';
import NotificationModel from '../models/notification.model';
import AssignationModel  from '../models/assignation.model';
import { genererTokensAgora } from '../config/agora';
import { sendSuccess, sendError } from '../utils/response.utils';

/** Ne pas exposer les numéros dans la liste RDV (consultations téléphoniques retirées). */
function listeRdvPourClient(rows: RendezVous[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o = { ...(r as object) } as Record<string, unknown>;
    delete o.patient_telephone;
    delete o.medecin_telephone;
    return o;
  });
}

const TelemedicineController = {

  // Patient : uniquement le cardiologue assigné (cohérent avec création RDV / assignation)
  async listerCardiologues(req: AuthRequest, res: Response): Promise<void> {
    try {
      const row = await AssignationModel.monCardiologue(req.user!.id);
      if (!row?.id) {
        sendSuccess(res, 'Cardiologues récupérés', []);
        return;
      }
      sendSuccess(res, 'Cardiologues récupérés', [
        { id: row.id, nom: row.nom, prenom: row.prenom },
      ]);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Patient : liste ses propres RDV
  async listerRdv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rdvs = await TelemedicineModel.listerParPatient(req.user!.id);
      sendSuccess(res, 'Rendez-vous récupérés', listeRdvPourClient(rdvs));
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  /** Patient : nombre de demandes en attente (badges, sans charger toute la liste). */
  async countEnAttentePatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const en_attente = await TelemedicineModel.countEnAttenteParPatient(req.user!.id);
      sendSuccess(res, 'Compteur RDV', { en_attente });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Cardiologue : liste ses propres RDV
  async listerRdvCardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rdvs = await TelemedicineModel.listerParMedecin(req.user!.id);
      sendSuccess(res, 'Rendez-vous récupérés', listeRdvPourClient(rdvs));
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async supprimerHistorique(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ok = await TelemedicineModel.supprimerHistorique(
        Number(req.params.id),
        req.user!.id,
        req.user!.role
      );
      if (!ok) {
        sendError(
          res,
          'Impossible de supprimer ce rendez-vous (vérifiez le statut : un RDV confirmé doit d\'abord être annulé)',
          400
        );
        return;
      }
      sendSuccess(res, 'Rendez-vous retiré de l\'historique', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async supprimerToutHistorique(req: AuthRequest, res: Response): Promise<void> {
    try {
      const role = req.user!.role;
      if (role !== 'patient' && role !== 'cardiologue') {
        sendError(res, 'Accès refusé', 403);
        return;
      }
      const n = await TelemedicineModel.supprimerToutHistorique(req.user!.id, role);
      sendSuccess(res, `${n} rendez-vous supprimé(s) de l'historique`, { count: n });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Patient : créer une demande de RDV avec un cardiologue
  async creerRdv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { cardiologue_id, date_rdv, type, motif } = req.body;
      const cardiologueId = Number(cardiologue_id);
      if (!cardiologueId) {
        sendError(res, 'cardiologue_id invalide', 400);
        return;
      }

      const medecinAssigne = await AssignationModel.getMedecinIdPatient(req.user!.id);
      if (medecinAssigne == null) {
        sendError(
          res,
          'Aucun cardiologue assigné. Vous devez d’abord être accepté en suivi avant de prendre un rendez-vous.',
          403
        );
        return;
      }
      if (medecinAssigne !== cardiologueId) {
        sendError(
          res,
          'Les demandes de rendez-vous sont réservées à votre cardiologue assigné.',
          403
        );
        return;
      }

      const estCardiologueActif = await AssignationModel.estCardiologueActif(cardiologueId);
      if (!estCardiologueActif) {
        sendError(res, 'Cardiologue introuvable ou inactif', 404);
        return;
      }

      const id = await TelemedicineModel.creer({
        patient_id: req.user!.id,
        medecin_id: cardiologueId,
        date_rdv,
        type,
        motif,
      });

      // Notifier le cardiologue
      NotificationModel.creer({
        utilisateur_id: cardiologueId,
        titre:   '📅 Nouvelle demande de rendez-vous',
        contenu: `Un patient a soumis une demande de rendez-vous pour le ${date_rdv}.`,
        type:    'info',
        lien:    '/rendez-vous',
      }).catch(() => {});

      sendSuccess(res, 'Demande de rendez-vous envoyée', { id }, 201);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Cardiologue : confirmer un RDV
  async confirmerRdv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rdv = await TelemedicineModel.findById(Number(req.params.id));
      if (!rdv) {
        sendError(res, 'Rendez-vous introuvable', 404);
        return;
      }
      if (rdv.medecin_id !== req.user!.id) {
        sendError(res, 'Accès refusé', 403);
        return;
      }

      const ok = await TelemedicineModel.changerStatut(rdv.id, 'confirme');
      if (!ok) {
        sendError(res, 'Impossible de confirmer ce rendez-vous', 400);
        return;
      }

      // Notifier le patient
      NotificationModel.creer({
        utilisateur_id: rdv.patient_id,
        titre:   '✅ Rendez-vous confirmé',
        contenu: `Votre rendez-vous du ${rdv.date_rdv} a été confirmé par le cardiologue.`,
        type:    'succes',
        lien:    '/rendez-vous',
      }).catch(() => {});

      sendSuccess(res, 'Rendez-vous confirmé', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Cardiologue : refuser un RDV
  async refuserRdv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rdv = await TelemedicineModel.findById(Number(req.params.id));
      if (!rdv) {
        sendError(res, 'Rendez-vous introuvable', 404);
        return;
      }
      if (rdv.medecin_id !== req.user!.id) {
        sendError(res, 'Accès refusé', 403);
        return;
      }

      const ok = await TelemedicineModel.changerStatut(rdv.id, 'annule');
      if (!ok) {
        sendError(res, 'Impossible de refuser ce rendez-vous', 400);
        return;
      }

      // Notifier le patient
      NotificationModel.creer({
        utilisateur_id: rdv.patient_id,
        titre:   '❌ Rendez-vous refusé',
        contenu: `Votre demande de rendez-vous du ${rdv.date_rdv} a été refusée par le cardiologue.`,
        type:    'alerte',
        lien:    '/rendez-vous',
      }).catch(() => {});

      sendSuccess(res, 'Rendez-vous refusé', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Patient ou Cardiologue : annuler un RDV
  async annulerRdv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ok = await TelemedicineModel.annuler(
        Number(req.params.id),
        req.user!.id
      );
      if (!ok) {
        sendError(res, 'Impossible d\'annuler ce rendez-vous', 400);
        return;
      }
      sendSuccess(res, 'Rendez-vous annulé', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Patient ou Cardiologue : rejoindre l'appel vidéo
  async rejoindreRdv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rdv = await TelemedicineModel.findById(Number(req.params.id));
      if (!rdv) {
        sendError(res, 'Rendez-vous introuvable', 404);
        return;
      }

      const userId = req.user!.id;
      const estParticipant = rdv.patient_id === userId || rdv.medecin_id === userId;
      if (!estParticipant) {
        sendError(res, 'Accès refusé', 403);
        return;
      }

      if (rdv.statut !== 'confirme') {
        sendError(res, 'Le rendez-vous doit être confirmé pour rejoindre l\'appel', 400);
        return;
      }

      if (rdv.type === 'telephonique') {
        sendError(
          res,
          'Les consultations uniquement par téléphone ne sont plus proposées. Choisissez une visioconférence ou un rendez-vous au cabinet.',
          400
        );
        return;
      }

      if (rdv.type === 'cabinet') {
        sendError(
          res,
          'Les consultations au cabinet n’utilisent pas l’appel vidéo. Retrouvez les informations dans le détail du rendez-vous.',
          400
        );
        return;
      }

      const canal = `rdv_${rdv.id}`;
      const tokens = genererTokensAgora(canal, rdv.patient_id, rdv.medecin_id);

      // Sauvegarder le lien vidéo si pas encore fait
      if (!rdv.lien_video) {
        await TelemedicineModel.sauvegarderLienVideo(rdv.id, canal);
      }

      const monToken = userId === rdv.patient_id
        ? tokens.tokenPatient
        : tokens.tokenMedecin;

      sendSuccess(res, 'Accès à l\'appel vidéo', {
        appId:    tokens.appId,
        canal,
        token:    monToken,
        uid:      userId,
        expireAt: tokens.expireAt,
      });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Cardiologue : terminer un RDV et ajouter compte rendu
  async terminerRdv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rdv = await TelemedicineModel.findById(Number(req.params.id));
      if (!rdv) {
        sendError(res, 'Rendez-vous introuvable', 404);
        return;
      }
      if (rdv.medecin_id !== req.user!.id) {
        sendError(res, 'Accès refusé', 403);
        return;
      }

      const ok = await TelemedicineModel.terminer(
        rdv.id,
        req.user!.id,
        req.body.compte_rendu
      );
      if (!ok) {
        sendError(res, 'Impossible de terminer ce rendez-vous (statut incorrect ?)', 400);
        return;
      }

      // Notifier le patient
      NotificationModel.creer({
        utilisateur_id: rdv.patient_id,
        titre:   '🏥 Consultation terminée',
        contenu: 'Votre consultation avec le cardiologue est terminée. Un compte rendu a été ajouté.',
        type:    'info',
        lien:    '/rendez-vous',
      }).catch(() => {});

      sendSuccess(res, 'Rendez-vous terminé', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default TelemedicineController;
