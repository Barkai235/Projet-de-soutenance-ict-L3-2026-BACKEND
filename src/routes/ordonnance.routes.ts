import { Router } from 'express';
import { body }   from 'express-validator';
import OrdonnanceController from '../controllers/ordonnance.controller';
import { validate }         from '../middlewares/validation.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// Créer une ordonnance (médecin)
router.post(
  '/',
  authorize('cardiologue'),
  [
    body('patient_id').isInt().withMessage('patient_id requis'),
    body('date_emission').notEmpty().withMessage('Date d\'émission requise'),
    body('lignes').isArray({ min: 1 }).withMessage('Au moins un médicament requis'),
  ],
  validate,
  OrdonnanceController.creer
);

// Liste des ordonnances du patient connecté
router.get(
  '/mes-ordonnances',
  authorize('patient', 'cardiologue', 'administrateur'),
  OrdonnanceController.listPatient
);

// Liste des ordonnances émises par le cardiologue
router.get(
  '/cardiologue',
  authorize('cardiologue'),
  OrdonnanceController.listCardiologue
);

// Patient : supprimer toutes ses ordonnances (historique)
router.delete(
  '/tout',
  authorize('patient'),
  OrdonnanceController.supprimerToutesPatient
);

// Détail d'une ordonnance
router.get(
  '/:id',
  authorize('patient', 'cardiologue', 'administrateur'),
  OrdonnanceController.detail
);

// Annuler une ordonnance
router.patch(
  '/:id/annuler',
  authorize('cardiologue', 'administrateur'),
  OrdonnanceController.annuler
);

// Patient : retirer une ordonnance de son espace
router.delete(
  '/:id',
  authorize('patient'),
  OrdonnanceController.supprimerPatient
);

export default router;