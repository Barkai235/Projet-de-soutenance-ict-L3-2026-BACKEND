import { Router } from 'express';
import { body }   from 'express-validator';
import RappelController from '../controllers/rappel.controller';
import { validate }     from '../middlewares/validation.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// Créer un rappel
router.post(
  '/',
  authorize('patient'),
  [
    body('medicament_id').isInt().withMessage('medicament_id requis'),
    body('heure_rappel').matches(/^\d{2}:\d{2}$/).withMessage('Format heure invalide (HH:MM)'),
  ],
  validate,
  RappelController.creer
);

// Lister rappels
router.get('/', RappelController.lister);

// Journal des prises
router.get('/journal', RappelController.journal);

// Supprimer tous les rappels (patient)
router.delete(
  '/tout',
  authorize('patient'),
  RappelController.supprimerTous
);

// Toggle actif/inactif
router.patch('/:id/toggle', RappelController.toggleActif);

// Marquer une prise
router.post(
  '/:id/prise',
  authorize('patient'),
  [body('statut').isIn(['pris','oublie','reporte']).withMessage('Statut invalide')],
  validate,
  RappelController.enregistrerPrise
);

// Supprimer un rappel
router.delete('/:id', authorize('patient', 'administrateur'), RappelController.supprimer);

export default router;