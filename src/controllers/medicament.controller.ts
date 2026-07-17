import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import MedicamentService from '../services/medicament.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const MedicamentController = {

  async lister(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MedicamentService.lister(req.query.search as string);
      sendSuccess(res, 'Médicaments récupérés', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async detail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MedicamentService.detail(Number(req.params.id));
      sendSuccess(res, 'Médicament récupéré', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur', 404);
    }
  },

  async creer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MedicamentService.creer(req.body);
      sendSuccess(res, 'Médicament créé', result, 201);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default MedicamentController;