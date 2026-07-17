import { Response }      from 'express';
import { AuthRequest }  from '../middlewares/auth.middleware';
import AssignationModel from '../models/assignation.model';
import UserModel        from '../models/user.model';
import { sendSuccess, sendError } from '../utils/response.utils';
import {
  notifierPatientDemandeEnregistree,
  notifierApresAcceptation,
  notifierApresRefus,
  notifierFinSuiviParCardiologue,
  notifierFinSuiviParPatient,
  notifierCardiologueNouvelleDemande,
} from '../services/assignation-notifications.service';

const AssignationController = {

  async listerCardiologues(req: AuthRequest, res: Response): Promise<void> {
    try {
      const deja = await AssignationModel.getMedecinIdPatient(req.user!.id);
      if (deja != null) {
        sendSuccess(
          res,
          'Vous avez déjà un cardiologue assigné. Aucune autre fiche n’est proposée tant que le suivi n’est pas terminé.',
          []
        );
        return;
      }
      const ville = typeof req.query.ville === 'string' ? req.query.ville : undefined;
      const disponible =
        req.query.disponible === '1' ||
        req.query.disponible === 'true';
      const cardiologues = await AssignationModel.listerCardiologues(req.user!.id, {
        ville,
        disponible_uniquement: disponible,
      });
      sendSuccess(res, 'Cardiologues récupérés', cardiologues);
    } catch (err: unknown) {
      console.error('[AssignationController.listerCardiologues]', err);
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 500);
    }
  },

  async detailCardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id) { sendError(res, 'Identifiant invalide', 400); return; }
      const assigne = await AssignationModel.getMedecinIdPatient(req.user!.id);
      if (assigne != null && assigne !== id) {
        sendError(
          res,
          'Vous ne pouvez consulter que la fiche de votre cardiologue assigné. Mettez fin au suivi pour en rechercher un autre.',
          403
        );
        return;
      }
      const rows = await AssignationModel.listerCardiologues(req.user!.id, {}, id);
      if (rows.length === 0) {
        sendError(res, 'Cardiologue introuvable', 404);
        return;
      }
      sendSuccess(res, 'Cardiologue récupéré', rows[0]);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 500);
    }
  },

  async monCardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cardiologue = await AssignationModel.monCardiologue(req.user!.id);
      sendSuccess(res, 'Cardiologue récupéré', cardiologue);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async mesDemandes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patient_id = req.user!.id;
      const [demandes, cardiologue_assigne] = await Promise.all([
        AssignationModel.mesDemandes(patient_id),
        AssignationModel.monCardiologue(patient_id),
      ]);
      sendSuccess(res, 'Demandes récupérées', {
        demandes,
        cardiologue_assigne,
      });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async envoyerDemande(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { medecin_id, cardiologue_id, motif, urgence, antecedents } = req.body;
      const cibleCardiologueId = Number(cardiologue_id ?? medecin_id);
      if (!cibleCardiologueId || !motif || !urgence) {
        sendError(res, 'cardiologue_id, motif et urgence sont requis', 400);
        return;
      }

      const id = await AssignationModel.creerDemande({
        patient_id:  req.user!.id,
        medecin_id:  cibleCardiologueId,
        motif,
        urgence,
        antecedents,
      });

      const urgenceLabel =
        urgence === 'urgente' ? '🔴 Urgente' :
        urgence === 'moderee' ? '🟠 Modérée' : '🟢 Routine';

      await notifierCardiologueNouvelleDemande(cibleCardiologueId, urgenceLabel, String(motif));

      const cardio = await UserModel.findByIdIncludingInactive(cibleCardiologueId);
      if (cardio) {
        await notifierPatientDemandeEnregistree(
          req.user!.id,
          cardio.prenom,
          cardio.nom
        );
      }

      sendSuccess(res, 'Demande envoyée avec succès', { id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      const code =
        msg.includes('quota') || msg.includes('déjà') || msg.includes('pas de nouvelles') ||
        msg.includes('déjà un cardiologue') || msg.includes('demande en attente')
          ? 400
          : 500;
      sendError(res, msg, code);
    }
  },

  async annulerDemande(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ok = await AssignationModel.annulerDemandeParPatient(
        Number(req.params.id),
        req.user!.id
      );
      if (!ok) {
        sendError(res, 'Demande introuvable ou non annulable', 404);
        return;
      }
      sendSuccess(res, 'Demande annulée', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async demandesCardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const demandes = await AssignationModel.demandesCardiologue(req.user!.id);
      sendSuccess(res, 'Demandes récupérées', demandes);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  /** Capacité patients / quota (pour l’écran d’acceptation des demandes). */
  async maCapacitePatients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { nb, quota } = await AssignationModel.getNbPatientsEtQuota(req.user!.id);
      sendSuccess(res, 'Capacité récupérée', {
        patients_actuels: nb,
        quota,
        places_restantes: Math.max(0, quota - nb),
      });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async accepterDemande(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id) {
        sendError(res, 'Identifiant de demande invalide', 400);
        return;
      }
      const result = await AssignationModel.accepterDemande(id, req.user!.id);
      if (!result) {
        sendError(
          res,
          'Demande introuvable, déjà traitée ou vous n’êtes pas le cardiologue destinataire.',
          404
        );
        return;
      }

      await notifierApresAcceptation(result.patient_id, req.user!.id);
      sendSuccess(res, 'Demande acceptée. Le patient est ajouté à votre liste de suivi.', {
        patient_id: result.patient_id,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      const code = msg.includes('déjà suivi')
        ? 409
        : msg.includes('quota') || msg.includes('Quota')
          ? 400
          : 500;
      sendError(res, msg, code);
    }
  },

  async refuserDemande(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { motif_refus, message_refus } = req.body;
      if (!motif_refus) { sendError(res, 'motif_refus est requis', 400); return; }

      const result = await AssignationModel.refuserDemande(
        Number(req.params.id),
        req.user!.id,
        motif_refus,
        message_refus
      );
      if (!result) { sendError(res, 'Demande introuvable ou déjà traitée', 404); return; }

      await notifierApresRefus(result.patient_id, motif_refus, message_refus);
      sendSuccess(res, 'Demande refusée', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async finSuivi(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { motif } = req.body;
      const patient_id = Number(req.params.id);

      const ok = await AssignationModel.finSuivi(req.user!.id, patient_id);
      if (!ok) { sendError(res, 'Patient non assigné à ce cardiologue', 404); return; }

      await notifierFinSuiviParCardiologue(req.user!.id, patient_id, motif);
      sendSuccess(res, 'Suivi terminé', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async finMonSuivi(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AssignationModel.finSuiviParPatient(req.user!.id);
      if (!result) {
        sendError(res, 'Aucun cardiologue assigné', 404);
        return;
      }

      await notifierFinSuiviParPatient(result.medecin_id, req.user!.id);
      sendSuccess(res, 'Suivi terminé', null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default AssignationController;
