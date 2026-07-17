import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import ChatController from '../controllers/chat.controller';
import { validate } from '../middlewares/validation.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Authentification requise, puis rôle patient strictement.
router.use(authenticate);
router.use(authorize('patient'));

// Anti-abus : 20 requêtes / heure / IP (clé de débit côté route patient).
const chatRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez dans quelques minutes.',
  },
});

// POST /api/patient/chat
router.post(
  '/chat',
  chatRateLimit,
  [
    body('message')
      .isString()
      .withMessage('Le message est requis')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Le message doit faire entre 1 et 1000 caractères'),
    body('history')
      .optional()
      .isArray()
      .withMessage('history doit être un tableau'),
    body('history.*.role')
      .optional()
      .isIn(['user', 'assistant'])
      .withMessage('Rôle d’historique invalide'),
    body('history.*.content')
      .optional()
      .isString()
      .withMessage('Contenu d’historique invalide'),
  ],
  validate,
  ChatController.chat
);

export default router;
