import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import RappelService from '../services/rappel.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const RappelController = {

  async creer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await RappelService.creer({
        ...req.body,
        patient_id: req.user!.id,
      });
      sendSuccess(res, 'Rappel créé', result, 201);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async lister(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patient_id = req.user!.role === 'patient'
        ? req.user!.id
        : Number(req.query.patient_id);
      const result = await RappelService.lister(patient_id);
      sendSuccess(res, 'Rappels récupérés', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async toggleActif(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await RappelService.toggleActif(
        Number(req.params.id), req.user!.id
      );
      sendSuccess(res, result.message, { est_actif: result.est_actif });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async supprimer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await RappelService.supprimer(
        Number(req.params.id), req.user!.id
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 404);
    }
  },

  async supprimerTous(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'patient') {
        sendError(res, 'Réservé au patient', 403);
        return;
      }
      const result = await RappelService.supprimerTous(req.user!.id);
      sendSuccess(res, result.message, { count: result.count });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async enregistrerPrise(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await RappelService.enregistrerPrise({
        rappel_id:  Number(req.params.id),
        patient_id: req.user!.id,
        statut:     req.body.statut,
      });
      sendSuccess(res, result.message, result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async journal(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patient_id = req.user!.role === 'patient'
        ? req.user!.id
        : Number(req.query.patient_id);
      const jours  = req.query.jours ? Number(req.query.jours) : 7;
      const result = await RappelService.getJournal(patient_id, jours);
      sendSuccess(res, 'Journal récupéré', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default RappelController;