import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import AuthService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const AuthController = {
  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      sendSuccess(res, 'Compte créé avec succès', result, 201);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur serveur';
      sendError(res, msg, 400);
    }
  },

  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      sendSuccess(res, 'Connexion réussie', result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur serveur';
      sendError(res, msg, 401);
    }
  },

  async forgotPassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.forgotPassword(req.body.email);
      sendSuccess(res, 'Instructions envoyées', result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur serveur';
      sendError(res, msg, 400);
    }
  },

  async resetPassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.resetPassword(
        req.body.token,
        req.body.mot_de_passe
      );
      sendSuccess(res, result.message, null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur serveur';
      sendError(res, msg, 400);
    }
  },

  async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.getMe(req.user!.id);
      sendSuccess(res, 'Profil récupéré', result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur serveur';
      sendError(res, msg, 404);
    }
  },
};

export default AuthController;