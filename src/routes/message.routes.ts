import { Router } from 'express';
import { body }   from 'express-validator';
import MessageController from '../controllers/message.controller';
import { validate }      from '../middlewares/validation.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);
router.use(authorize('patient', 'cardiologue'));

// Rechercher un utilisateur par email (pour démarrer une conversation)
router.get('/rechercher', MessageController.rechercherUtilisateur);

// Envoyer un message
router.post(
  '/',
  [
    body('destinataire_id').isInt().withMessage('destinataire_id requis'),
    body('contenu').notEmpty().withMessage('Le contenu est requis'),
  ],
  validate,
  MessageController.envoyer
);

// Lister toutes les conversations
router.get('/', MessageController.getConversations);

// Compteur messages non lus
router.get('/non-lus', MessageController.countNonLus);

// Supprimer tous les messages (toutes conversations)
router.delete('/tout', MessageController.supprimerTout);

// Supprimer toute la conversation avec un utilisateur
router.delete('/conversation/:userId', MessageController.supprimerFil);

// Supprimer un message précis
router.delete('/message/:messageId', MessageController.supprimerMessage);

// Récupérer une conversation avec un utilisateur
router.get('/:userId', MessageController.getConversation);

export default router;