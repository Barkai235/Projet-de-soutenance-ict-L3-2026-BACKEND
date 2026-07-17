import { Response }      from 'express';
import { AuthRequest }   from '../middlewares/auth.middleware';
import DashboardService  from '../services/dashboard.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const DashboardController = {

  async patient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patient_id = req.user!.role === 'patient'
        ? req.user!.id
        : Number(req.query.patient_id);

      if (!patient_id) { sendError(res, 'patient_id requis', 400); return; }

      const data = await DashboardService.getDashboardPatient(patient_id);
      sendSuccess(res, 'Dashboard patient récupéré', data);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async cardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await DashboardService.getDashboardCardiologue(req.user!.id);
      sendSuccess(res, 'Dashboard cardiologue récupéré', data);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async admin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await DashboardService.getDashboardAdmin();
      sendSuccess(res, 'Dashboard admin récupéré', data);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default DashboardController;