import { Response }          from 'express';
import { AuthRequest }       from '../middlewares/auth.middleware';
import NotificationService   from '../services/notification.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const NotificationController = {

  async lister(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit  = req.query.limit ? Number(req.query.limit) : 30;
      const result = await NotificationService.lister(req.user!.id, limit);
      sendSuccess(res, 'Notifications récupérées', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async marquerLue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await NotificationService.marquerLue(
        Number(req.params.id), req.user!.id
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async toutMarquerLues(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await NotificationService.toutMarquerLues(req.user!.id);
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async supprimer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await NotificationService.supprimer(
        Number(req.params.id), req.user!.id
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async toutSupprimer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await NotificationService.toutSupprimer(req.user!.id);
      sendSuccess(res, result.message, { count: result.count });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async countNonLues(req: AuthRequest, res: Response): Promise<void> {
    try {
      const total = await NotificationService.countNonLues(req.user!.id);
      sendSuccess(res, 'Compteur récupéré', { total });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async badgesNavigation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await NotificationService.badgesNavigation(req.user!.id);
      sendSuccess(res, 'Badges navigation', data);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async marquerLuesParSection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const section = String(req.body?.section ?? '').trim();
      const allowed = new Set([
        'mesures', 'ordonnances', 'rendez_vous', 'demandes',
        'patients', 'rappels', 'accueil',
      ]);
      if (!allowed.has(section)) {
        sendError(res, 'section invalide', 400);
        return;
      }
      const result = await NotificationService.marquerLuesParSection(req.user!.id, section);
      sendSuccess(res, result.message, { count: result.count });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default NotificationController;