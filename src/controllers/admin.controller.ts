import { Response }    from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import AdminService    from '../services/admin.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const AdminController = {

  async getUtilisateurs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.getUtilisateurs({
        role:   req.query.role   as string,
        search: req.query.search as string,
        actif:  req.query.actif  as string,
        limit:  req.query.limit  ? Number(req.query.limit)  : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      });
      sendSuccess(res, 'Utilisateurs récupérés', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async getCardiologues(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.getCardiologues();
      sendSuccess(res, 'Cardiologues récupérés', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async getCardiologuesEnAttente(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.getCardiologuesEnAttente();
      sendSuccess(res, 'Cardiologues en attente récupérés', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async getAlertes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.getAlertes(req.query.resolu as string);
      sendSuccess(res, 'Alertes récupérées', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async getMedicaments(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.getMedicaments();
      sendSuccess(res, 'Médicaments récupérés', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async getStatsAvancees(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.getStatsAvancees();
      sendSuccess(res, 'Statistiques récupérées', result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async toggleActif(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      if (!userId) { sendError(res, 'ID utilisateur invalide', 400); return; }
      const result = await AdminService.toggleActif(userId);
      sendSuccess(res, result.message, result);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      if (!userId) { sendError(res, 'ID utilisateur invalide', 400); return; }
      const result = await AdminService.deleteUser(userId, req.user!.id);
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, msg.includes('propre compte') ? 400 : 500);
    }
  },

  async creerUtilisateur(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AdminService.creerUtilisateur(req.body);
      sendSuccess(res, 'Utilisateur créé', result, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, msg.includes('déjà utilisé') || msg.includes('invalide') ? 400 : 500);
    }
  },

  async assignerCardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = Number(req.params.id);
      const cardiologueId = Number(req.body.cardiologue_id);
      if (!patientId || !cardiologueId) {
        sendError(res, 'patient id et cardiologue_id requis', 400);
        return;
      }
      const result = await AdminService.assignerCardiologue(patientId, cardiologueId);
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async traiterValidationCardiologue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cardiologueId = Number(req.params.id);
      const decision = req.body.decision as 'accepte' | 'refuse';
      const motifRefus = req.body.motif_refus as string | undefined;

      if (!cardiologueId || !['accepte', 'refuse'].includes(decision)) {
        sendError(res, 'Paramètres invalides', 400);
        return;
      }

      const result = await AdminService.traiterValidationCardiologue(
        cardiologueId,
        decision,
        motifRefus
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, msg.includes('introuvable') ? 404 : 500);
    }
  },
};

export default AdminController;
