import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import GroqService from '../services/groq.service';
import { sendSuccess, sendError } from '../utils/response.utils';

const MAX_MESSAGE_LENGTH = 1000;

const ChatController = {
  /**
   * POST /api/patient/chat
   * Reçoit { message, history } et renvoie { reply }.
   * Réservé aux patients (authentification + rôle vérifiés par les middlewares).
   */
  async chat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const raw = req.body?.message;
      const message = typeof raw === 'string' ? raw.trim().slice(0, MAX_MESSAGE_LENGTH) : '';

      if (!message) {
        sendError(res, 'Message vide ou invalide', 400);
        return;
      }

      const rawHistory: unknown[] = Array.isArray(req.body?.history) ? req.body.history : [];
      const history: { role: 'user' | 'assistant'; content: string }[] = rawHistory
        .map((m: unknown) => {
          const role = (m as { role?: unknown }).role;
          const content = (m as { content?: unknown }).content;
          if (
            (role === 'user' || role === 'assistant') &&
            typeof content === 'string'
          ) {
            return { role: role as 'user' | 'assistant', content: content.slice(0, MAX_MESSAGE_LENGTH) };
          }
          return null;
        })
        .filter((m): m is { role: 'user' | 'assistant'; content: string } => m !== null)
        .slice(-20);

      if (!GroqService.isConfigured()) {
        sendError(
          res,
          'L’assistant est momentanément indisponible, réessayez dans quelques instants.',
          503
        );
        return;
      }

      const reply = await GroqService.repondre(message, history);
      sendSuccess(res, 'Réponse assistant', { reply });
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'GROQ_ERREUR';
      // Log serveur (sans détail sensible exposé au client)
      console.error('[chat.controller] Erreur Groq:', code);

      if (code === 'GROQ_QUOTA') {
        sendError(
          res,
          'L’assistant est momentanément indisponible (quota atteint), réessayez plus tard.',
          503
        );
        return;
      }
      if (code === 'GROQ_TIMEOUT') {
        sendError(
          res,
          'L’assistant met trop de temps à répondre, réessayez dans quelques instants.',
          504
        );
        return;
      }

      sendError(
        res,
        'L’assistant est momentanément indisponible, réessayez dans quelques instants.',
        503
      );
    }
  },
};

export default ChatController;
