import { Response }    from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import AssistantService from '../services/assistant.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const AssistantController = {
  async message(req: AuthRequest, res: Response): Promise<void> {
    try {
      const raw = req.body?.message;
      const message = typeof raw === 'string' ? raw : '';
      const reply = AssistantService.repondre(message);
      sendSuccess(res, 'Réponse assistant', { reply });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default AssistantController;
