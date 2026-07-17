import { Response }     from 'express';
import { AuthRequest }  from '../middlewares/auth.middleware';
import MessageService   from '../services/message.service';
import { sendSuccess, sendError } from '../utils/response.utils';

function statusMessagerie(msg: string): number {
  if (msg.includes('introuvable')) return 404;
  if (
    msg.includes('ne pouvez') ||
    msg.includes('pas disponible') ||
    msg.includes('pas assigné') ||
    msg.includes('qui vous suit') ||
    msg.includes('qu\'avec votre') ||
    msg.includes('qu\'avec vos patients')
  ) {
    return 403;
  }
  return 400;
}

const MessageController = {

  async envoyer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MessageService.envoyer({
        expediteur_id:   req.user!.id,
        expediteur_role: req.user!.role,
        destinataire_id: Number(req.body.destinataire_id),
        contenu:         req.body.contenu,
        piece_jointe:    req.body.piece_jointe,
      });
      sendSuccess(res, 'Message envoyé', result, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, statusMessagerie(msg));
    }
  },

  async getConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const interlocuteurId = Number(req.params.userId);
      const result = await MessageService.getConversation(
        req.user!.id,
        req.user!.role,
        interlocuteurId
      );
      sendSuccess(res, 'Conversation récupérée', result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, statusMessagerie(msg));
    }
  },

  async getConversations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MessageService.getConversations(req.user!.id, req.user!.role);
      sendSuccess(res, 'Conversations récupérées', result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, 500);
    }
  },

  async countNonLus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const total = await MessageService.countNonLus(req.user!.id, req.user!.role);
      sendSuccess(res, 'Compteur récupéré', { total });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, 500);
    }
  },

  async rechercherUtilisateur(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = String(req.query.email ?? '').trim();
      if (!email) { sendError(res, 'Email requis', 400); return; }
      const result = await MessageService.rechercherParEmail(
        email,
        req.user!.id,
        req.user!.role
      );
      sendSuccess(res, 'Utilisateur trouvé', result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, statusMessagerie(msg));
    }
  },

  async supprimerMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MessageService.supprimerMessage(
        Number(req.params.messageId),
        req.user!.id
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, 404);
    }
  },

  async supprimerFil(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MessageService.supprimerFil(
        req.user!.id,
        req.user!.role,
        Number(req.params.userId)
      );
      sendSuccess(res, result.message, { count: result.count });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, statusMessagerie(msg));
    }
  },

  async supprimerTout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MessageService.supprimerTout(req.user!.id, req.user!.role);
      sendSuccess(res, result.message, { count: result.count });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, 500);
    }
  },
};

export default MessageController;
