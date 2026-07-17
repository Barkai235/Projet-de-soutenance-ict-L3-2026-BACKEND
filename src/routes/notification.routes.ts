import { Router }            from 'express';
import NotificationController from '../controllers/notification.controller';
import { authenticate }      from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// Lister les notifications
router.get('/', NotificationController.lister);

// Compteur non lues
router.get('/non-lues', NotificationController.countNonLues);

// Badges par onglet (notifications non lues, hors type message)
router.get('/badges-navigation', NotificationController.badgesNavigation);

// Marquer comme lues les notifs d’une rubrique (badges navigation)
router.patch('/lire-section', NotificationController.marquerLuesParSection);

// Tout marquer comme lues
router.patch('/tout-lire', NotificationController.toutMarquerLues);

// Supprimer toutes les notifications
router.delete('/tout', NotificationController.toutSupprimer);

// Marquer une notification comme lue
router.patch('/:id/lire', NotificationController.marquerLue);

// Supprimer une notification
router.delete('/:id', NotificationController.supprimer);

export default router;