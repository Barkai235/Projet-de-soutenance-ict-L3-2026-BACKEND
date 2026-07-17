import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import OrdonnanceService from '../services/ordonnance.service';
import AssignationModel from '../models/assignation.model';
import { sendSuccess, sendError } from '../utils/response.utils';

const OrdonnanceController = {

  async creer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = Number(req.body.patient_id);
      if (!patientId) {
        sendError(res, 'patient_id requis', 400);
        return;
      }

      const estPatientAssigne = await AssignationModel.estPatientDuCardiologue(patientId, req.user!.id);
      if (!estPatientAssigne) {
        sendError(res, 'Accès refusé : patient non assigné', 403);
        return;
      }

      const data = {
        ...req.body,
        patient_id: patientId,
        medecin_id: req.user!.id,
      };
      const result = await OrdonnanceService.creer(data);
      sendSuccess(res, 'Ordonnance créée', result, 201);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async detail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await OrdonnanceService.detail(Number(req.params.id));
      const user = req.user!;

      if (user.role === 'patient' && result.patient_id !== user.id) {
        sendError(res, 'Accès refusé', 403);
        return;
      }
      if (user.role === 'cardiologue' && result.medecin_id !== user.id) {
        sendError(res, 'Accès refusé', 403);
        return;
      }

      sendSuccess(res, 'Ordonnance récupérée', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 404);
    }
  },

  async listPatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const patient_id = user.role === 'patient'
        ? user.id
        : Number(req.query.patient_id);

      if (!patient_id) {
        sendError(res, 'patient_id requis', 400);
        return;
      }

      if (user.role === 'cardiologue') {
        const estPatientAssigne = await AssignationModel.estPatientDuCardiologue(patient_id, user.id);
        if (!estPatientAssigne) {
          sendError(res, 'Accès refusé : patient non assigné', 403);
          return;
        }
      }

      const result = await OrdonnanceService.listPatient(patient_id);
      sendSuccess(res, 'Ordonnances récupérées', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async listCardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await OrdonnanceService.listCardiologue(req.user!.id);
      sendSuccess(res, 'Ordonnances récupérées', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async listInfirmier(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await OrdonnanceService.listInfirmier();
      sendSuccess(res, 'Ordonnances actives récupérées', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async annuler(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ordonnance = await OrdonnanceService.detail(Number(req.params.id));
      if (
        req.user!.role === 'cardiologue' &&
        ordonnance.medecin_id !== req.user!.id
      ) {
        sendError(res, 'Accès refusé', 403);
        return;
      }
      const result = await OrdonnanceService.annuler(ordonnance.id);
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 404);
    }
  },

  async supprimerPatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'patient') {
        sendError(res, 'Réservé au patient', 403);
        return;
      }
      const result = await OrdonnanceService.supprimerPourPatient(
        Number(req.params.id),
        req.user!.id
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 404);
    }
  },

  async supprimerToutesPatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'patient') {
        sendError(res, 'Réservé au patient', 403);
        return;
      }
      const result = await OrdonnanceService.supprimerToutesPourPatient(req.user!.id);
      sendSuccess(res, result.message, { count: result.count });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default OrdonnanceController;