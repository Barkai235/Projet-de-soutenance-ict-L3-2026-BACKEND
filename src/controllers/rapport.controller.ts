import { Response }    from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import RapportService  from '../services/rapport.service';
import { sendError }   from '../utils/response.utils';

const RapportController = {

  async exporterHTML(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patient_id = req.user!.role === 'patient'
        ? req.user!.id
        : Number(req.params.patientId);

      const html = await RapportService.genererRapportHTML(patient_id);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="rapport-hypertrack-${patient_id}.html"`
      );
      res.send(html);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  // Prévisualiser dans le navigateur (sans téléchargement)
  async previsualiser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patient_id = req.user!.role === 'patient'
        ? req.user!.id
        : Number(req.params.patientId);

      const html = await RapportService.genererRapportHTML(patient_id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default RapportController;